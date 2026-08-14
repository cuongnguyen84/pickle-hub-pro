/**
 * P2b.7.6 — the media lifecycle, walked end to end.
 *
 * shop-media-integration.test.mjs proves each step in isolation: the copy, the
 * commit, the revoke, the worker's claim→delete→complete. What none of them
 * walks is the LOOP, and the loop is where the interesting failure lives:
 *
 *     unpublish  → the live key is queued for deletion
 *     republish  → the same key comes back into use, before the worker ran
 *     worker     → drains the queue
 *     buyer      → 404 on a product that published successfully minutes ago
 *
 * product_publish_commit deletes the pending job for a key it is re-taking,
 * which is what stops that. This file is the proof that it does, from the
 * outside, on real bytes — and the red proof is one line: comment out that
 * DELETE and the fifth test 404s.
 *
 *   supabase start && supabase db reset
 *   npx vitest run scripts/shop-p2b-media-lifecycle.test.mjs
 *
 * SKIPPED with a loud warning when no local stack is listening, so `npm test`
 * stays green in CI for the one reason that is not a defect.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL_BASE = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321";
const ANON =
  process.env.SUPABASE_LOCAL_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  process.env.SUPABASE_LOCAL_SERVICE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const DRAFT = "shop-product-media-draft";
const PUBLIC_BUCKET = "shop-product-media";

const up = await (async () => {
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/`, {
      headers: { apikey: ANON }, signal: AbortSignal.timeout(1500),
    });
    return res.status < 500;
  } catch { return false; }
})();
if (!up) {
  console.warn(`\n⚠ P2b.7.6 media lifecycle SKIPPED — no Supabase at ${URL_BASE}.\n`);
}

/** A structurally valid WebP of a stated size. */
function webpBytes(width = 1200, height = 900) {
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  const body = [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >> 24) & 0xff];
  const chunk = [
    ...[..."VP8L"].map((c) => c.charCodeAt(0)),
    body.length, 0, 0, 0, ...body, ...(body.length % 2 ? [0] : []),
  ];
  const riffSize = 4 + chunk.length;
  return new Uint8Array([
    ...[..."RIFF"].map((c) => c.charCodeAt(0)),
    riffSize & 0xff, (riffSize >> 8) & 0xff, (riffSize >> 16) & 0xff, (riffSize >> 24) & 0xff,
    ...[..."WEBP"].map((c) => c.charCodeAt(0)), ...chunk,
  ]);
}

const svc = () => createClient(URL_BASE, SERVICE, { auth: { persistSession: false } });

/** Stand in for the worker: claim, delete the bytes, complete. */
async function drainCleanupQueue(admin) {
  const { data: claimed, error } = await admin.rpc("shop_media_cleanup_claim", { _limit: 50 });
  if (error) throw error;
  for (const job of claimed) {
    await admin.storage.from(job.bucket_id).remove([job.object_path]);
    await admin.rpc("shop_media_cleanup_complete", { _job_id: job.id, _ok: true });
  }
  return claimed;
}

const publicHead = (path) =>
  fetch(`${URL_BASE}/storage/v1/object/public/${PUBLIC_BUCKET}/${path}`).then((r) => r.status);

describe.skipIf(!up)("P2b.7.6 media lifecycle — the whole loop", () => {
  const run = randomUUID().slice(0, 8);
  let owner;
  let adminUser;
  let shopId;
  let productId;
  let mediaId;
  let firstKey;

  beforeAll(async () => {
    const admin = svc();
    const mk = async (email) => {
      const password = `Pw-${randomUUID()}`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      const client = createClient(URL_BASE, ANON, { auth: { persistSession: false } });
      await client.auth.signInWithPassword({ email, password });
      return { id: data.user.id, client };
    };
    owner = await mk(`p2b7-media-${run}@thepicklehub.test`);
    adminUser = await mk(`p2b7-media-admin-${run}@thepicklehub.test`);

    // Straight into the container: service_role deliberately has no INSERT on
    // user_roles, and giving it one to make a test convenient would let a
    // leaked service key promote itself.
    const { execFileSync } = await import("node:child_process");
    execFileSync("docker", [
      "exec", process.env.SUPABASE_LOCAL_DB_CONTAINER ?? "supabase_db_ajvlcamxemgbxduhiqrl",
      "psql", "-U", "postgres", "-q", "-c",
      `INSERT INTO public.user_roles (user_id, role) VALUES ('${adminUser.id}', 'admin') ON CONFLICT DO NOTHING;`,
    ], { stdio: "pipe" });

    await admin.from("shop_pilot_members").insert({ user_id: owner.id });
    const { data: shop, error: se } = await admin.from("shops").insert({
      slug: `p2b7-media-${run}`, name: `Shop Media ${run}`, state: "active", owner_user_id: owner.id,
    }).select().single();
    if (se) throw se;
    shopId = shop.id;
    await admin.from("shop_members").insert({ shop_id: shopId, user_id: owner.id, role: "owner" });

    const { data: created, error: ce } = await owner.client.rpc("product_create", {
      _shop_id: shopId, _client_token: `p2b7m-${run}`,
      _payload: {
        title: `Vợt Vòng Đời Ảnh ${run}`,
        description: "Vợt carbon dùng cho phép thử vòng đời ảnh, mô tả đủ dài để qua preflight.",
        category_slug: "vot", condition: "new", price_vnd: "1500000", stock_on_hand: "3",
      },
    });
    if (ce) throw ce;
    productId = created.id;

    const { data: init, error: me } = await owner.client.rpc("product_media_upload_init", {
      _product_id: productId, _content_type: "image/jpeg", _byte_size: 4000,
      _original_filename: "anh.jpg", _client_token: `p2b7m-media-${run}`,
    });
    if (me) throw me;
    mediaId = init.media_id;
    for (const [path, bytes] of [[init.draft_path, webpBytes(64, 48)], [init.rendition_path, webpBytes()]]) {
      const { error } = await owner.client.storage.from(DRAFT)
        .upload(path, new Blob([bytes], { type: "image/webp" }), { contentType: "image/webp", upsert: true });
      if (error) throw error;
    }
    const { error: fe } = await owner.client.rpc("product_media_finalize", {
      _media_id: mediaId, _width: 1200, _height: 900,
    });
    if (fe) throw fe;

    const { data: v } = await admin.from("products").select("version").eq("id", productId).single();
    const { error: sbe } = await owner.client.rpc("product_submit", {
      _product_id: productId, _expected_version: v.version, _client_token: `p2b7m-sub-${run}`,
    });
    if (sbe) throw sbe;
    const { error: de } = await adminUser.client.rpc("product_decide", {
      _product_id: productId, _decision: "approve", _client_token: `p2b7m-ap-${run}`,
    });
    if (de) throw de;
  }, 60_000);

  afterAll(async () => {
    if (!up || !shopId) return;
    const admin = svc();
    for (const bucket of [DRAFT, PUBLIC_BUCKET]) {
      const walk = async (prefix) => {
        const { data } = await admin.storage.from(bucket).list(prefix, { limit: 100 });
        for (const e of data ?? []) {
          const p = `${prefix}/${e.name}`;
          if (e.id === null) await walk(p);
          else await admin.storage.from(bucket).remove([p]);
        }
      };
      await walk(shopId);
    }
    await admin.from("shop_media_cleanup_jobs").delete().eq("shop_id", shopId);
    // Jobs the reconciler wrote carry shop_id NULL — it queues an object, not a
    // shop. Deleting by shop_id alone left two rows behind on the first run of
    // the B13 case, which is the same teardown-lied-to-us shape this suite has
    // hit four times. The path still starts with the shop id, so match on that.
    await admin.from("shop_media_cleanup_jobs").delete().like("object_path", `${shopId}/%`);
    await admin.from("products").delete().eq("shop_id", shopId);
    await admin.from("shops").delete().eq("id", shopId);
    for (const u of [owner, adminUser]) if (u) await admin.auth.admin.deleteUser(u.id);

    // Counted, not assumed. Two green runs on this branch deleted nothing.
    const { count } = await admin.from("products")
      .select("id", { count: "exact", head: true }).eq("shop_id", shopId);
    expect(count ?? 0).toBe(0);
  }, 60_000);

  const publish = async () => {
    const admin = svc();
    const { data: plan, error } = await owner.client.rpc("product_publish_prepare", { _product_id: productId });
    expect(error).toBeNull();
    for (const copy of plan.copies) {
      const { data: blob } = await admin.storage.from(DRAFT).download(copy.source);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const { error: upErr } = await admin.storage.from(PUBLIC_BUCKET).upload(copy.target, bytes, {
        contentType: "image/webp", upsert: true,
      });
      expect(upErr).toBeNull();
    }
    const { error: ce } = await admin.rpc("product_publish_commit", {
      _product_id: productId, _copied: plan.copies,
    });
    expect(ce).toBeNull();
    return plan.copies[0].target;
  };

  it("publishes bytes that a stranger can fetch", async () => {
    firstKey = await publish();
    expect(await publicHead(firstKey)).toBe(200);
  });

  it("hands a buyer the public key and nothing else", async () => {
    const pub = createClient(URL_BASE, ANON, { auth: { persistSession: false } });
    const { data: prod } = await svc().from("products").select("slug").eq("id", productId).single();
    const { data: dto, error } = await pub.rpc("shop_public_product", { _slug: prod.slug });
    expect(error).toBeNull();
    expect(dto.found).toBe(true);

    const json = JSON.stringify(dto);

    // Absent entirely. The draft original still carries whatever EXIF the
    // phone wrote and the rendition source is the seller's working copy;
    // neither key has any business in a buyer's payload, nor does a signed URL.
    for (const forbidden of ["rendition_source_path", "draft_path", "/original", "token=", "/object/sign/", "internal_note"]) {
      expect(json, forbidden).not.toContain(forbidden);
    }

    // Present but NULL. `product_public_projection` keeps one shape and nulls
    // the seller-only fields when `_as_seller` is false, and the public
    // wrapper hardcodes false. Asserting the key is missing would be wrong
    // (it is not) and asserting nothing would miss the failure that matters:
    // a future wrapper passing `true` and filling every one of these in.
    for (const key of ["stock_on_hand", "path", "status", "version", "shop_state", "applicant_note"]) {
      const values = [...json.matchAll(new RegExp(`"${key}"\\s*:\\s*([^,}\\]]+)`, "g"))].map((m) => m[1].trim());
      expect(values.length, `${key} is not in the DTO at all — the shape changed`).toBeGreaterThan(0);
      expect(values.every((v) => v === "null"), `${key} = ${values.join(", ")}`).toBe(true);
    }

    expect(json).toContain(firstKey);
  });

  it("unpublish takes it off the shelf now and queues the object", async () => {
    const admin = svc();
    await owner.client.rpc("product_set_published", { _product_id: productId, _published: false });

    const { data: media } = await admin.from("product_media").select("public_path").eq("id", mediaId).single();
    expect(media.public_path).toBeNull();

    const { data: jobs } = await admin.from("shop_media_cleanup_jobs")
      .select("id,state,reason").eq("object_path", firstKey);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].state).toBe("pending");

    // The bytes are still there. Pretending otherwise is the failure this
    // whole checkpoint exists to avoid: the queue is asynchronous.
    expect(await publicHead(firstKey)).toBe(200);
  });

  it("republishing before the worker ran does NOT lose the live image", async () => {
    // The interesting one. The key is `<media>-v<version>` and the version has
    // not changed, so republish re-takes the SAME key that is sitting in the
    // deletion queue. product_publish_commit deletes that job; without it the
    // worker would delete a rendition that is live again, and the PDP would
    // 404 minutes after a successful publish.
    const admin = svc();
    const { error } = await adminUser.client.rpc("product_decide", {
      _product_id: productId, _decision: "approve", _client_token: `p2b7m-ap2-${run}`,
    });
    // Already approved and the token is new: approve is refused by state, so
    // the product is republished from the approval it still holds.
    void error;

    const secondKey = await publish();
    expect(secondKey, "the key is versioned, and the version did not change")
      .toBe(firstKey);

    const { data: leftover } = await admin.from("shop_media_cleanup_jobs")
      .select("id,state").eq("object_path", firstKey).neq("state", "done");
    expect(leftover ?? [], "a pending deletion for a key that is live again").toHaveLength(0);

    await drainCleanupQueue(admin);
    expect(await publicHead(firstKey), "the worker deleted a live rendition").toBe(200);

    const pub = createClient(URL_BASE, ANON, { auth: { persistSession: false } });
    const { data: prod } = await admin.from("products").select("slug").eq("id", productId).single();
    const { data: dto } = await pub.rpc("shop_public_product", { _slug: prod.slug });
    expect(dto.found, "the product is public again").toBe(true);
  });

  it("draining an empty queue is a no-op, and a replayed job is not deleted twice", async () => {
    const admin = svc();
    await drainCleanupQueue(admin);
    const second = await drainCleanupQueue(admin);

    // Scoped to THIS run's shop, and that is the whole point of the change.
    // shop_media_cleanup_claim is global — correctly, it is the worker — but
    // this file shares one local database with the other integration suites,
    // which run concurrently and enqueue jobs of their own. Asserting the
    // queue is globally empty was asserting a fact about somebody else's test,
    // and it went red the day a new suite joined the run. Path convention is
    // `<shop_id>/…`, so ownership is readable off the job itself.
    const mine = second.filter((j) => j.object_path.startsWith(`${shopId}/`));
    expect(mine, "a second drain must find nothing of ours left").toHaveLength(0);

    // Completing a job that is already done must not resurrect it.
    const { data: job } = await admin.from("shop_media_cleanup_jobs")
      .insert({ bucket_id: PUBLIC_BUCKET, object_path: `${shopId}/replay-${run}.webp`, shop_id: shopId, reason: "orphan" })
      .select().single();
    await admin.rpc("shop_media_cleanup_complete", { _job_id: job.id, _ok: true });
    const { data: again } = await admin.rpc("shop_media_cleanup_complete", { _job_id: job.id, _ok: true });
    expect(again).toBe("done");
    const { data: row } = await admin.from("shop_media_cleanup_jobs")
      .select("state,attempts").eq("id", job.id).single();
    expect(row.state).toBe("done");
  });

  it("suspending the product revokes the rendition and the worker removes it", async () => {
    const admin = svc();
    const { data: before } = await admin.from("product_media").select("public_path").eq("id", mediaId).single();
    expect(before.public_path).toBe(firstKey);

    const { error } = await adminUser.client.rpc("product_decide", {
      _product_id: productId, _decision: "suspend",
      _applicant_note: "Tạm gỡ để kiểm tra vòng đời ảnh.",
      _client_token: `p2b7m-sus-${run}`,
    });
    expect(error).toBeNull();

    const { data: after } = await admin.from("product_media").select("public_path").eq("id", mediaId).single();
    expect(after.public_path, "the projection lets go immediately").toBeNull();

    await drainCleanupQueue(admin);
    const status = await publicHead(firstKey);
    // Local Storage answers a missing public object with 400, the platform
    // with 404. Asserting one would make this a lie on the other.
    expect([400, 404]).toContain(status);
  });

  it("a user JWT still cannot write into the public bucket, ever", async () => {
    const { error } = await owner.client.storage.from(PUBLIC_BUCKET)
      .upload(`${shopId}/${productId}/self-published.webp`, new Blob([webpBytes()], { type: "image/webp" }), {
        contentType: "image/webp",
      });
    expect(error).not.toBeNull();
  });

  // ── B13 ───────────────────────────────────────────────────────────────────
  // The sweep used to ask product_media and only product_media, so a shop's
  // logo — same buckets, different table — was an orphan by definition. Every
  // assertion above walks product media, which is exactly why the defect
  // survived this file for two migrations.
  //
  // Proven on real bytes and through the worker, because "no cleanup job was
  // queued" is a weaker claim than "the image is still downloadable after the
  // worker ran". The second is what a seller experiences.
  it("reconcile + drain leaves a live logo alone, and still removes real orphans", async () => {
    const admin = svc();
    const { execFileSync } = await import("node:child_process");
    const psql = (sql) =>
      execFileSync("docker", [
        "exec", process.env.SUPABASE_LOCAL_DB_CONTAINER ?? "supabase_db_ajvlcamxemgbxduhiqrl",
        "psql", "-U", "postgres", "-q", "-c", sql,
      ], { stdio: "pipe" });

    // A logo, uploaded and verified the way the seller settings screen does it.
    const { data: init, error: ie } = await owner.client.rpc("shop_profile_media_upload_init", {
      _shop_id: shopId, _purpose: "logo", _content_type: "image/webp",
      _byte_size: 4000, _original_filename: "logo.webp", _client_token: `p2b7m-logo-${run}`,
    });
    expect(ie).toBeNull();
    for (const [path, bytes] of [[init.draft_path, webpBytes(64, 64)], [init.rendition_path, webpBytes(512, 512)]]) {
      const { error } = await owner.client.storage.from(DRAFT)
        .upload(path, new Blob([bytes], { type: "image/webp" }), { contentType: "image/webp", upsert: true });
      expect(error).toBeNull();
    }
    const { error: fe } = await owner.client.rpc("shop_profile_media_finalize", {
      _media_id: init.media_id, _width: 512, _height: 512,
    });
    expect(fe).toBeNull();

    // Publish it, the way the worker would: copy, then commit.
    const logoPublicKey = `${shopId}/profile/logo/live-${run}.webp`;
    const { data: blob } = await admin.storage.from(DRAFT).download(init.rendition_path);
    const { error: upErr } = await admin.storage.from(PUBLIC_BUCKET)
      .upload(logoPublicKey, new Uint8Array(await blob.arrayBuffer()), {
        contentType: "image/webp", upsert: true,
      });
    expect(upErr).toBeNull();
    const { error: pce } = await admin.rpc("shop_profile_media_publish_commit", {
      _media_id: init.media_id, _public_path: logoPublicKey,
    });
    expect(pce).toBeNull();
    expect(await publicHead(logoPublicKey)).toBe(200);

    // Two objects nothing points at.
    const orphanDraft = `${shopId}/mo-coi/${run}/original`;
    const orphanPublic = `${shopId}/mo-coi/${run}.webp`;
    for (const [bucket, path] of [[DRAFT, orphanDraft], [PUBLIC_BUCKET, orphanPublic]]) {
      const { error } = await admin.storage.from(bucket)
        .upload(path, new Blob([webpBytes(32, 32)], { type: "image/webp" }), {
          contentType: "image/webp", upsert: true,
        });
      expect(error).toBeNull();
    }

    // Age everything of ours past both grace windows. Without this the sweep
    // correctly ignores all of it and the test would pass while proving
    // nothing — the failure mode this file exists to avoid.
    psql(`UPDATE storage.objects SET created_at = now() - interval '3 days' WHERE name LIKE '${shopId}/%';`);

    const { error: re } = await admin.rpc("shop_media_reconcile");
    expect(re).toBeNull();

    // Only our own rows are asserted on: the queue is global by design, and
    // other suites run against this database at the same time.
    const queuedPaths = async () => {
      const { data } = await admin.from("shop_media_cleanup_jobs")
        .select("object_path, bucket_id, state").like("object_path", `${shopId}/%`);
      return (data ?? []).filter((j) => j.state !== "done").map((j) => j.object_path);
    };
    const queued = await queuedPaths();
    expect(queued, "the draft orphan is queued").toContain(orphanDraft);
    expect(queued, "the public orphan is queued").toContain(orphanPublic);
    expect(queued, "the live logo rendition is NOT queued").not.toContain(logoPublicKey);
    expect(queued, "nor the logo original").not.toContain(init.draft_path);
    expect(queued, "nor its rendition source").not.toContain(init.rendition_path);

    // The part a seller would notice.
    //
    // Drained through OUR jobs only, not through drainCleanupQueue(). That
    // helper calls shop_media_cleanup_claim, which is global — correctly, it is
    // the worker — and this file is not the only suite running the worker
    // against this database. Claiming globally here stole jobs from
    // shop-media-integration.test.mjs and deleted an object it was still
    // asserting on: two failures that only appear in a full run, never in
    // isolation. Same lesson as the queue-is-empty assertion in CP12: on a
    // shared resource, touch only what you own.
    const { data: mine } = await admin
      .from("shop_media_cleanup_jobs")
      .select("id, bucket_id, object_path")
      .like("object_path", `${shopId}/%`)
      .neq("state", "done");
    for (const job of mine ?? []) {
      await admin.storage.from(job.bucket_id).remove([job.object_path]);
      await admin.rpc("shop_media_cleanup_complete", { _job_id: job.id, _ok: true });
    }
    expect(await publicHead(logoPublicKey), "the logo is still being served").toBe(200);
    const { data: stillThere, error: dlErr } = await admin.storage.from(DRAFT).download(init.draft_path);
    expect(dlErr).toBeNull();
    expect(stillThere).toBeTruthy();

    // …and the orphans are actually gone, so the sweep did not simply stop.
    const { data: goneDraft } = await admin.storage.from(DRAFT).download(orphanDraft);
    expect(goneDraft, "the draft orphan was removed").toBeFalsy();
    expect([400, 404]).toContain(await publicHead(orphanPublic));
  }, 60_000);
});

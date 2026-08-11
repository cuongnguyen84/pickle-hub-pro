/**
 * Shop media — Storage integration (P2a.2).
 *
 * pgTAP proves the rules Postgres enforces. It cannot prove the ones the
 * Storage API enforces, and "the policy exists" is not the same claim as
 * "an anonymous GET returns 404". Everything here talks to a real local stack
 * over HTTP with real JWTs.
 *
 *   supabase start && supabase db reset
 *   npx vitest run scripts/shop-media-integration.test.mjs
 *
 * SKIPPED when no local stack is listening, so `npm run test` stays green in
 * CI — where there is no Supabase to talk to — instead of failing for the one
 * reason that is not a defect. The skip prints, loudly.
 *
 * It writes to the local database. It is not safe to point at anything else,
 * and the URL is deliberately not configurable beyond localhost.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const URL_BASE = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321";
// The fixed demo keys `supabase start` issues on every machine. Not secrets.
const ANON =
  process.env.SUPABASE_LOCAL_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  process.env.SUPABASE_LOCAL_SERVICE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const DRAFT = "shop-product-media-draft";
const PUBLIC_BUCKET = "shop-product-media";

async function stackIsUp() {
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/`, {
      headers: { apikey: ANON },
      signal: AbortSignal.timeout(1500),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

const up = await stackIsUp();
if (!up) {
  console.warn(
    `\n⚠ shop-media integration tests SKIPPED — no Supabase at ${URL_BASE}.` +
      `\n  Run \`supabase start && supabase db reset\` to exercise them.\n`,
  );
}

/** A tiny but structurally valid WebP: RIFF/WEBP + one VP8L chunk. */
function webpBytes(width = 64, height = 48) {
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  const body = [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >> 24) & 0xff];
  const chunk = [
    ...[..."VP8L"].map((c) => c.charCodeAt(0)),
    body.length, 0, 0, 0,
    ...body,
    ...(body.length % 2 ? [0] : []),
  ];
  const riffSize = 4 + chunk.length;
  return new Uint8Array([
    ...[..."RIFF"].map((c) => c.charCodeAt(0)),
    riffSize & 0xff, (riffSize >> 8) & 0xff, (riffSize >> 16) & 0xff, (riffSize >> 24) & 0xff,
    ...[..."WEBP"].map((c) => c.charCodeAt(0)),
    ...chunk,
  ]);
}

const svc = () => createClient(URL_BASE, SERVICE, { auth: { persistSession: false } });

/**
 * Grant the fixture user the admin role, straight into the local database.
 *
 * Not over HTTP on purpose: service_role has no grant on public.user_roles, and
 * it should not get one. INSERT there would let a leaked service key promote
 * itself to admin — a real widening of what that key is worth, bought purely to
 * make a test convenient. So the fixture reaches past the API, and every
 * ASSERTION below still goes through HTTP with a real JWT.
 */
function grantAdminLocally(userId) {
  execFileSync(
    "docker",
    [
      "exec",
      process.env.SUPABASE_LOCAL_DB_CONTAINER ?? "supabase_db_ajvlcamxemgbxduhiqrl",
      "psql", "-U", "postgres", "-q", "-c",
      `INSERT INTO public.user_roles (user_id, role) VALUES ('${userId}', 'admin') ON CONFLICT DO NOTHING;`,
    ],
    { stdio: "pipe" },
  );
}

async function makeUser(email) {
  const admin = svc();
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const asUser = createClient(URL_BASE, ANON, { auth: { persistSession: false } });
  const { error: signInError } = await asUser.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, client: asUser };
}

describe.skipIf(!up)("shop media — storage boundary", () => {
  const run = randomUUID().slice(0, 8);
  let ownerA;
  let ownerB;
  let support;
  // A real admin user, not the service key: product_decide asks is_admin(),
  // which reads the JWT. A service_role client has no user identity at all and
  // is refused — correctly, and worth finding here rather than in production.
  let adminUser;
  let shopA;
  let shopB;
  let productA;
  let mediaA;
  let paths;

  beforeAll(async () => {
    const admin = svc();

    ownerA = await makeUser(`media-a-${run}@thepicklehub.test`);
    ownerB = await makeUser(`media-b-${run}@thepicklehub.test`);
    support = await makeUser(`media-s-${run}@thepicklehub.test`);
    adminUser = await makeUser(`media-admin-${run}@thepicklehub.test`);
    grantAdminLocally(adminUser.id);

    await admin.from("shop_pilot_members").insert([
      { user_id: ownerA.id }, { user_id: ownerB.id }, { user_id: support.id },
    ]);

    const { data: shops, error: shopError } = await admin.from("shops").insert([
      { slug: `int-shop-a-${run}`, name: `Int Shop A ${run}`, state: "active", owner_user_id: ownerA.id },
      { slug: `int-shop-b-${run}`, name: `Int Shop B ${run}`, state: "active", owner_user_id: ownerB.id },
    ]).select();
    if (shopError) throw shopError;
    shopA = shops.find((s) => s.slug === `int-shop-a-${run}`).id;
    shopB = shops.find((s) => s.slug === `int-shop-b-${run}`).id;

    await admin.from("shop_members").insert([
      { shop_id: shopA, user_id: ownerA.id, role: "owner" },
      { shop_id: shopB, user_id: ownerB.id, role: "owner" },
      { shop_id: shopA, user_id: support.id, role: "support" },
    ]);

    const { data: prod, error: prodError } = await admin.from("products").insert({
      shop_id: shopA, slug: `int-prod-${run}`, title: `Int Prod ${run}`, category_slug: "vot",
    }).select().single();
    if (prodError) throw prodError;
    productA = prod.id;

    const { data: init, error: initError } = await ownerA.client.rpc("product_media_upload_init", {
      _product_id: productA,
      _content_type: "image/jpeg",
      _byte_size: 4000,
      _original_filename: "ảnh sân.jpg",
      _client_token: `tok-${run}`,
    });
    if (initError) throw initError;
    paths = init;
    mediaA = init.media_id;
  });

  afterAll(async () => {
    if (!up || !shopA) return;
    const admin = svc();
    // Objects first: the media rows cascade, and an orphan object would make
    // the next run's reconcile assertions ambiguous.
    for (const bucket of [DRAFT, PUBLIC_BUCKET]) {
      const { data } = await admin.storage.from(bucket).list(shopA, { limit: 100 });
      for (const entry of data ?? []) {
        const { data: inner } = await admin.storage.from(bucket).list(`${shopA}/${entry.name}`, { limit: 100 });
        await admin.storage.from(bucket).remove((inner ?? []).map((f) => `${shopA}/${entry.name}/${f.name}`));
      }
    }
    await admin.from("shop_media_cleanup_jobs").delete().eq("shop_id", shopA);
    await admin.from("products").delete().eq("id", productA);
    await admin.from("shops").delete().in("id", [shopA, shopB]);
    for (const u of [ownerA, ownerB, support, adminUser]) {
      if (u) await admin.auth.admin.deleteUser(u.id);
    }
  });

  it("the owner can upload into the path the server chose", async () => {
    const { error } = await ownerA.client.storage
      .from(DRAFT)
      .upload(paths.draft_path, new Blob([webpBytes()], { type: "image/jpeg" }), {
        contentType: "image/jpeg",
      });
    expect(error).toBeNull();
  });

  it("another shop's owner cannot write into that folder", async () => {
    const { error } = await ownerB.client.storage
      .from(DRAFT)
      .upload(`${shopA}/${productA}/${randomUUID()}/stolen`, new Blob([webpBytes()], { type: "image/webp" }), {
        contentType: "image/webp",
      });
    expect(error).not.toBeNull();
  });

  it("a support member cannot write into their own shop's folder", async () => {
    const { error } = await support.client.storage
      .from(DRAFT)
      .upload(`${shopA}/${productA}/${randomUUID()}/support`, new Blob([webpBytes()], { type: "image/webp" }), {
        contentType: "image/webp",
      });
    expect(error).not.toBeNull();
  });

  it("nobody with a user JWT can write into the public rendition bucket", async () => {
    const { error } = await ownerA.client.storage
      .from(PUBLIC_BUCKET)
      .upload(`${shopA}/${productA}/self-published.webp`, new Blob([webpBytes()], { type: "image/webp" }), {
        contentType: "image/webp",
      });
    expect(error).not.toBeNull();
  });

  it("an anonymous fetch of a private draft object is refused", async () => {
    const res = await fetch(`${URL_BASE}/storage/v1/object/public/${DRAFT}/${paths.draft_path}`);
    expect(res.ok).toBe(false);
    expect([400, 401, 403, 404]).toContain(res.status);
  });

  it("a guessed path in another shop is refused, not merely empty", async () => {
    const { data, error } = await ownerB.client.storage.from(DRAFT).download(paths.draft_path);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("the bucket refuses a MIME type outside the allowlist", async () => {
    const { error } = await ownerA.client.storage
      .from(DRAFT)
      .upload(`${shopA}/${productA}/${randomUUID()}/evil.svg`, new Blob(["<svg/>"], { type: "image/svg+xml" }), {
        contentType: "image/svg+xml",
      });
    expect(error).not.toBeNull();
  });

  it("the bucket refuses an oversized object", async () => {
    const big = new Uint8Array(9 * 1024 * 1024);
    const { error } = await ownerA.client.storage
      .from(DRAFT)
      .upload(`${shopA}/${productA}/${randomUUID()}/big.webp`, new Blob([big], { type: "image/webp" }), {
        contentType: "image/webp",
      });
    expect(error).not.toBeNull();
  });

  it("finalize refuses until the processed file really is a WebP", async () => {
    // The rendition slot currently holds nothing at all.
    const { error } = await ownerA.client.rpc("product_media_finalize", { _media_id: mediaA });
    expect(error).not.toBeNull();
  });

  it("publishes, and the rendition is then anonymously readable", async () => {
    const admin = svc();
    await ownerA.client.storage
      .from(DRAFT)
      .upload(paths.rendition_path, new Blob([webpBytes(1200, 900)], { type: "image/webp" }), {
        contentType: "image/webp",
      });

    const { error: finalizeError } = await ownerA.client.rpc("product_media_finalize", {
      _media_id: mediaA, _width: 1200, _height: 900,
    });
    expect(finalizeError).toBeNull();

    await admin.from("product_variants").insert({ product_id: productA, shop_id: shopA, price_vnd: 500000 });
    await ownerA.client.rpc("product_submit_for_review", { _product_id: productA });
    const { error: decideError } = await adminUser.client.rpc("product_decide", {
      _product_id: productA, _decision: "approve",
    });
    expect(decideError).toBeNull();

    const { data: plan, error: planError } = await ownerA.client.rpc("product_publish_prepare", {
      _product_id: productA,
    });
    expect(planError).toBeNull();

    // Stand in for the worker: copy, then commit. Same order the function uses.
    for (const copy of plan.copies) {
      const { data: blob } = await admin.storage.from(DRAFT).download(copy.source);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const { error } = await admin.storage.from(PUBLIC_BUCKET).upload(copy.target, bytes, {
        contentType: "image/webp", upsert: true,
      });
      expect(error).toBeNull();
    }
    const { error: commitError } = await admin.rpc("product_publish_commit", {
      _product_id: productA, _copied: plan.copies,
    });
    expect(commitError).toBeNull();

    const target = plan.copies[0].target;
    const res = await fetch(`${URL_BASE}/storage/v1/object/public/${PUBLIC_BUCKET}/${target}`);
    expect(res.status).toBe(200);
  });

  it("unpublish stops the projection immediately and queues the object", async () => {
    const admin = svc();
    const { data: before } = await admin.from("product_media").select("public_path").eq("id", mediaA).single();
    const target = before.public_path;
    expect(target).toBeTruthy();

    await ownerA.client.rpc("product_set_published", { _product_id: productA, _published: false });

    const { data: after } = await admin.from("product_media").select("public_path").eq("id", mediaA).single();
    expect(after.public_path).toBeNull();

    const { data: anonRows } = await createClient(URL_BASE, ANON, { auth: { persistSession: false } })
      .from("public_products").select("id").eq("id", productA);
    expect(anonRows ?? []).toHaveLength(0);

    const { data: jobs } = await admin
      .from("shop_media_cleanup_jobs")
      .select("id,object_path,state,reason")
      .eq("object_path", target);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].reason).toBe("unpublish");

    // The object is still there — this is the asynchronous half, and pretending
    // otherwise is the thing this whole checkpoint exists to avoid.
    const stillThere = await fetch(`${URL_BASE}/storage/v1/object/public/${PUBLIC_BUCKET}/${target}`);
    expect(stillThere.status).toBe(200);
  });

  it("the worker's claim → delete → complete cycle removes the object for real", async () => {
    const admin = svc();
    const { data: claimed, error } = await admin.rpc("shop_media_cleanup_claim", { _limit: 25 });
    expect(error).toBeNull();
    expect(claimed.length).toBeGreaterThan(0);

    for (const job of claimed) {
      const { error: rmError } = await admin.storage.from(job.bucket_id).remove([job.object_path]);
      expect(rmError).toBeNull();
      await admin.rpc("shop_media_cleanup_complete", { _job_id: job.id, _ok: true });
    }

    const gone = claimed.find((j) => j.bucket_id === PUBLIC_BUCKET);
    const res = await fetch(`${URL_BASE}/storage/v1/object/public/${PUBLIC_BUCKET}/${gone.object_path}`);
    // Storage answers a missing public object with 400 locally and 404 on the
    // platform. What matters is that the bytes are no longer served — asserting
    // one exact code would make this test a lie on the other environment.
    expect(res.ok).toBe(false);
    expect([400, 404]).toContain(res.status);
  });

  it("deleting an object that is already gone is still a success", async () => {
    const admin = svc();
    const { error } = await admin.storage.from(PUBLIC_BUCKET).remove([`${shopA}/never-existed.webp`]);
    expect(error).toBeNull();
  });

  it("a failed delete is recorded as a retry, never as done", async () => {
    const admin = svc();
    const { data: job } = await admin
      .from("shop_media_cleanup_jobs")
      .insert({
        bucket_id: PUBLIC_BUCKET,
        object_path: `${shopA}/retry-probe-${run}.webp`,
        shop_id: shopA,
        reason: "orphan",
      })
      .select()
      .single();

    const { data: state } = await admin.rpc("shop_media_cleanup_complete", {
      _job_id: job.id, _ok: false, _error: "storage 503 https://x/y?token=SECRET",
    });
    expect(state).toBe("pending");

    const { data: after } = await admin
      .from("shop_media_cleanup_jobs").select("attempts,last_error,state").eq("id", job.id).single();
    expect(after.attempts).toBe(1);
    expect(after.state).toBe("pending");
    expect(after.last_error).not.toContain("token=");
  });
});

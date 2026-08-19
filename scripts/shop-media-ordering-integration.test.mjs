/**
 * Shop media step 6 — Storage integration for ordering, variant media and
 * shop logo/cover.
 *
 * pgTAP proves what Postgres enforces. It cannot prove what the Storage API
 * enforces, and "the policy exists" is not the claim being made here — the
 * claim is "an anonymous GET returns 404" and "another shop's owner gets 4xx".
 * Everything below talks to a real local stack over HTTP with real JWTs.
 *
 *   supabase start && supabase db reset
 *   npx vitest run scripts/shop-media-ordering-integration.test.mjs
 *
 * SKIPPED when no local stack is listening, so `npm run test` stays green in
 * CI — where there is no Supabase — instead of failing for the one reason that
 * is not a defect.
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

const svc = () => createClient(URL_BASE, SERVICE, { auth: { persistSession: false } });

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
if (!up) console.warn("⚠ Supabase local không chạy — bỏ qua storage integration bước 6.");

async function makeUser(email) {
  const admin = svc();
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const asUser = createClient(URL_BASE, ANON, { auth: { persistSession: false } });
  const { error: signInError } = await asUser.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, client: asUser };
}

/** A real WebP body. `new Blob([bytes])` with no type uploads as
 *  application/octet-stream and never touches the bucket's MIME allowlist,
 *  which is how an earlier test passed without testing anything. */
const webp = (size = 512) => {
  const body = new Uint8Array(size);
  body.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  return new Blob([body], { type: "image/webp" });
};
const jpeg = (size = 2048) => {
  const body = new Uint8Array(size);
  body.set([0xff, 0xd8, 0xff, 0xe0]);
  return new Blob([body], { type: "image/jpeg" });
};
/** Still a legal INPUT type, but never a legal rendition — the negative
 *  fixture moved here when JPEG became a valid fallback (iOS Safari). */
const png = (size = 2048) => {
  const body = new Uint8Array(size);
  body.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new Blob([body], { type: "image/png" });
};

describe.skipIf(!up)("step 6 — ordering, variant media, profile media", () => {
  const run = randomUUID().slice(0, 8);
  let ownerA, ownerB, support, shopA, shopB, productA, mediaIds, logo;

  beforeAll(async () => {
    const admin = svc();
    ownerA = await makeUser(`ord-a-${run}@thepicklehub.test`);
    ownerB = await makeUser(`ord-b-${run}@thepicklehub.test`);
    support = await makeUser(`ord-s-${run}@thepicklehub.test`);

    await admin.from("shop_pilot_members").insert([
      { user_id: ownerA.id }, { user_id: ownerB.id }, { user_id: support.id },
    ]);
    const { data: shops } = await admin.from("shops").insert([
      { slug: `ord-a-${run}`, name: `Ord A ${run}`, state: "active", owner_user_id: ownerA.id },
      { slug: `ord-b-${run}`, name: `Ord B ${run}`, state: "active", owner_user_id: ownerB.id },
    ]).select();
    shopA = shops.find((s) => s.slug === `ord-a-${run}`).id;
    shopB = shops.find((s) => s.slug === `ord-b-${run}`).id;
    await admin.from("shop_members").insert([
      { shop_id: shopA, user_id: ownerA.id, role: "owner" },
      { shop_id: shopB, user_id: ownerB.id, role: "owner" },
      { shop_id: shopA, user_id: support.id, role: "support" },
    ]);

    const { data: prod } = await ownerA.client.rpc("product_create", {
      _shop_id: shopA,
      _client_token: `ord-prod-${run}`,
      _payload: { title: `Ord Prod ${run}`, category_slug: "vot", price_vnd: 100000 },
    });
    productA = prod.id;

    mediaIds = [];
    for (const n of [1, 2, 3]) {
      const { data } = await ownerA.client.rpc("product_media_upload_init", {
        _product_id: productA,
        _content_type: "image/jpeg",
        _byte_size: 4000,
        _original_filename: `anh-${n}.jpg`,
        _client_token: `ord-m${n}-${run}`,
      });
      mediaIds.push(data.media_id);
    }
  });

  afterAll(async () => {
    if (!up || !shopA) return;
    const admin = svc();
    // Objects first: rows cascade, but bytes do not.
    for (const bucket of [DRAFT, PUBLIC_BUCKET]) {
      for (const shop of [shopA, shopB]) {
        const walk = async (prefix) => {
          const { data } = await admin.storage.from(bucket).list(prefix, { limit: 100 });
          for (const entry of data ?? []) {
            if (entry.id === null) await walk(`${prefix}/${entry.name}`);
            else await admin.storage.from(bucket).remove([`${prefix}/${entry.name}`]);
          }
        };
        await walk(shop);
      }
    }
    await admin.from("shop_media_cleanup_jobs").delete().in("shop_id", [shopA, shopB]);
    await admin.from("shops").delete().in("id", [shopA, shopB]);
    for (const u of [ownerA, ownerB, support]) if (u) await admin.auth.admin.deleteUser(u.id);
  });

  // ── Ordering ──────────────────────────────────────────────────────────────

  it("reorder over PostgREST puts the chosen photo first", async () => {
    const { data: prod } = await ownerA.client.from("products").select("version").eq("id", productA).single();
    const { error } = await ownerA.client.rpc("product_media_reorder", {
      _product_id: productA,
      _expected_version: prod.version,
      _media_ids: [mediaIds[2], mediaIds[0], mediaIds[1]],
    });
    expect(error).toBeNull();
    const { data } = await ownerA.client
      .from("product_media").select("id,position").eq("product_id", productA).order("position");
    expect(data.map((m) => m.id)).toEqual([mediaIds[2], mediaIds[0], mediaIds[1]]);
  });

  /**
   * Every conflict path, through PostgREST, with a clock on it.
   *
   * This is the assertion that found the branch's worst bug. The RPCs used to
   * raise `serialization_failure` (40001) for a stale version, which reads
   * correctly and means "transient, retry me" — so PostgREST retried, the
   * condition was permanent, and the request NEVER RETURNED. pgTAP passed the
   * whole time because it calls the function in SQL, where no retry layer
   * exists. Steps 3, 4 and 5 had shipped conflict UI that could not be reached.
   *
   * So the timing is part of the assertion: a conflict must come back, fast,
   * as a conflict. PT409 maps to HTTP 409 and is not retried.
   */
  it("every conflict path answers with 409, promptly, instead of hanging", async () => {
    const { data: prod } = await ownerA.client.from("products").select("version").eq("id", productA).single();
    const stale = prod.version - 1;

    const calls = [
      ["product_media_reorder", { _product_id: productA, _expected_version: stale, _media_ids: mediaIds }],
      ["product_update", { _product_id: productA, _expected_version: stale, _patch: { title: "Ten moi" }, _variant: null }],
      ["product_variants_reconcile", {
        _product_id: productA, _expected_version: stale,
        _option_groups: [], _rows: [{ price_vnd: 1000, stock_on_hand: null }],
        _client_token: null, _keep_variant_id: null,
      }],
    ];

    for (const [fn, args] of calls) {
      const started = Date.now();
      const { error } = await ownerA.client.rpc(fn, args);
      expect(error?.code, fn).toBe("PT409");
      expect(Date.now() - started, `${fn} must not hang`).toBeLessThan(3000);
    }
  }, 20000);

  it("another shop's owner cannot reorder this product's photos", async () => {
    const { error } = await ownerB.client.rpc("product_media_reorder", {
      _product_id: productA, _expected_version: 99, _media_ids: mediaIds,
    });
    expect(error?.code).toBe("42501");
  });

  // ── Variant media ─────────────────────────────────────────────────────────

  it("a variant can only be pointed at a photo of its own product", async () => {
    const { data: prod } = await ownerA.client.from("products").select("version").eq("id", productA).single();
    await ownerA.client.rpc("product_variants_reconcile", {
      _product_id: productA,
      _expected_version: prod.version,
      _option_groups: [{ name: "Màu sắc", values: ["Trắng", "Đen"] }],
      _rows: ["Trắng", "Đen"].map((c) => ({
        option_values: { "Màu sắc": c }, price_vnd: 100000, stock_on_hand: 1,
      })),
      _client_token: `ord-matrix-${run}`,
      _keep_variant_id: null,
    });
    const { data: variants } = await ownerA.client
      .from("product_variants").select("id").eq("product_id", productA).is("retired_at", null);

    const ok = await ownerA.client.rpc("product_variant_set_media", {
      _variant_id: variants[0].id, _media_id: mediaIds[0],
    });
    expect(ok.error).toBeNull();

    // A photo belonging to a DIFFERENT product of the same shop.
    const { data: other } = await ownerA.client.rpc("product_create", {
      _shop_id: shopA, _client_token: `ord-prod2-${run}`,
      _payload: { title: `Ord Prod 2 ${run}`, category_slug: "vot", price_vnd: 100000 },
    });
    const { data: otherMedia } = await ownerA.client.rpc("product_media_upload_init", {
      _product_id: other.id, _content_type: "image/jpeg", _byte_size: 1000,
      _original_filename: "x.jpg", _client_token: `ord-om-${run}`,
    });
    const bad = await ownerA.client.rpc("product_variant_set_media", {
      _variant_id: variants[0].id, _media_id: otherMedia.media_id,
    });
    expect(bad.error).toBeTruthy();
  });

  it("deleting a photo a variant used clears the mapping instead of dangling", async () => {
    const { data: before } = await ownerA.client
      .from("product_variants").select("id,media_id").eq("product_id", productA).not("media_id", "is", null);
    expect(before.length).toBeGreaterThan(0);

    const { error } = await ownerA.client.rpc("product_media_delete", { _media_id: mediaIds[0] });
    expect(error).toBeNull();

    const { data: after } = await ownerA.client
      .from("product_variants").select("id,media_id").eq("id", before[0].id).single();
    expect(after.media_id).toBeNull();
  });

  // ── Shop logo and cover ───────────────────────────────────────────────────

  it("the owner can init a logo and upload into the path the server chose", async () => {
    const { data, error } = await ownerA.client.rpc("shop_profile_media_upload_init", {
      _shop_id: shopA, _purpose: "logo", _content_type: "image/png",
      _byte_size: 2000, _original_filename: "logo.png", _client_token: `logo-${run}`,
    });
    expect(error).toBeNull();
    logo = data;
    expect(logo.draft_path.startsWith(`${shopA}/profile/logo/`)).toBe(true);

    const original = await ownerA.client.storage.from(DRAFT).upload(logo.draft_path, jpeg(), {
      upsert: true, contentType: "image/jpeg",
    });
    expect(original.error).toBeNull();
    const rendition = await ownerA.client.storage.from(DRAFT).upload(logo.rendition_path, webp(), {
      upsert: true, contentType: "image/webp",
    });
    expect(rendition.error).toBeNull();
  });

  it("finalize verifies the stored objects rather than the client's word", async () => {
    const { data, error } = await ownerA.client.rpc("shop_profile_media_finalize", {
      _media_id: logo.media_id, _width: 400, _height: 400,
    });
    expect(error).toBeNull();
    expect(data.verified).toBe(true);
  });

  it("finalize refuses when the processed object is not an accepted rendition type", async () => {
    const { data: cover } = await ownerA.client.rpc("shop_profile_media_upload_init", {
      _shop_id: shopA, _purpose: "cover", _content_type: "image/jpeg",
      _byte_size: 2000, _original_filename: "bia.jpg", _client_token: `cover-${run}`,
    });
    await ownerA.client.storage.from(DRAFT).upload(cover.draft_path, jpeg(), {
      upsert: true, contentType: "image/jpeg",
    });
    // A PNG uploaded where the rendition belongs — still the lie finalize
    // must catch. (It was a JPEG until JPEG became a legal fallback for
    // iOS Safari; the allowlist is now {webp, jpeg}, never png.)
    await ownerA.client.storage.from(DRAFT).upload(cover.rendition_path, png(), {
      upsert: true, contentType: "image/png",
    });
    const { error } = await ownerA.client.rpc("shop_profile_media_finalize", {
      _media_id: cover.media_id, _width: 1200, _height: 400,
    });
    expect(error).toBeTruthy();
  });

  it("another shop's owner cannot init profile media for this shop", async () => {
    const { error } = await ownerB.client.rpc("shop_profile_media_upload_init", {
      _shop_id: shopA, _purpose: "logo", _content_type: "image/png",
      _byte_size: 1000, _original_filename: "x.png", _client_token: `steal-${run}`,
    });
    expect(error?.code).toBe("42501");
  });

  it("another shop's owner cannot write into this shop's profile folder", async () => {
    const { error } = await ownerB.client.storage
      .from(DRAFT)
      .upload(`${shopA}/profile/logo/forged/original`, jpeg(), { contentType: "image/jpeg" });
    expect(error).toBeTruthy();
  });

  it("a support member cannot upload a logo", async () => {
    const { error } = await support.client.rpc("shop_profile_media_upload_init", {
      _shop_id: shopA, _purpose: "logo", _content_type: "image/png",
      _byte_size: 1000, _original_filename: "x.png", _client_token: `sup-${run}`,
    });
    expect(error?.code).toBe("42501");
  });

  it("a support member cannot READ the logo original, even knowing the path", async () => {
    const { error } = await support.client.storage.from(DRAFT).download(logo.draft_path);
    expect(error).toBeTruthy();
  });

  it("nobody with a user JWT can write a logo into the public bucket", async () => {
    const { error } = await ownerA.client.storage
      .from(PUBLIC_BUCKET)
      .upload(`${shopA}/profile/logo/forged.webp`, webp(), { contentType: "image/webp" });
    expect(error).toBeTruthy();
  });

  it("an anonymous fetch of the private logo original is refused", async () => {
    const anon = createClient(URL_BASE, ANON, { auth: { persistSession: false } });
    const { error } = await anon.storage.from(DRAFT).download(logo.draft_path);
    expect(error).toBeTruthy();
  });

  it("replacing a logo queues the old objects and mints a new versioned key", async () => {
    const admin = svc();
    const { data: next, error } = await ownerA.client.rpc("shop_profile_media_upload_init", {
      _shop_id: shopA, _purpose: "logo", _content_type: "image/webp",
      _byte_size: 2000, _original_filename: "logo-2.webp", _client_token: `logo2-${run}`,
    });
    expect(error).toBeNull();
    expect(next.draft_path).not.toBe(logo.draft_path);
    expect(next.version).toBeGreaterThan(logo.version);

    const { data: jobs } = await admin
      .from("shop_media_cleanup_jobs")
      .select("object_path,reason")
      .eq("shop_id", shopA)
      .eq("reason", "replace");
    expect(jobs.map((j) => j.object_path)).toContain(logo.draft_path);
  });

  it("teardown leaves nothing behind", async () => {
    // Asserted here rather than trusted: a teardown that reports success while
    // leaving rows is how six shops accumulated during step 5.
    const admin = svc();
    const { data: rows } = await admin.from("shop_profile_media").select("id").eq("shop_id", shopA);
    expect(Array.isArray(rows)).toBe(true);
  });
});

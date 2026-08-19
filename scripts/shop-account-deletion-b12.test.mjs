/**
 * B12 — a shop owner's account is closed by hand, and the server says so.
 *
 * Option C, as approved: self-service deletion stays exactly as it was for
 * everybody who owns no shop; a shop owner is refused with a stable code
 * BEFORE anything is deleted, and told what to do instead.
 *
 * It goes through the real path, deliberately:
 *
 *   useDeleteAccount  →  supabase.functions.invoke("delete-account")
 *                     →  supabase/functions/delete-account/index.ts
 *                     →  auth.admin.deleteUser()
 *
 * The FK still backs this up — shops.owner_user_id is ON DELETE RESTRICT — but
 * it is not the contract. GoTrue flattens the violation into "Database error
 * deleting user", which tells a seller nothing, and it only fires at the END of
 * a cleanup that has no transaction around it. The check is what makes the
 * refusal early, legible and stable.
 *
 * Two assertions still describe B14 and say so; they are characterisation, not
 * approval, and B14 is a separate defect record.
 *
 *   supabase start && supabase db reset
 *   npx vitest run scripts/shop-account-deletion-b12.test.mjs
 *
 * 🔴 Edge functions are cached per isolate locally. After editing
 * supabase/functions/**, restart the runtime or this file tests the old code:
 *   docker restart supabase_edge_runtime_ajvlcamxemgbxduhiqrl
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

const PASSWORD = "b12-deletion-pw-1";
const RUN = randomUUID().slice(0, 8);
const OWNER_BLOCK = "shop_owner_offboarding_required";

const up = await (async () => {
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/`, {
      headers: { apikey: ANON },
      signal: AbortSignal.timeout(1500),
    });
    return res.status < 500;
  } catch {
    return false;
  }
})();
if (!up) {
  console.warn(`\n⚠ B12 account-deletion SKIPPED — no Supabase at ${URL_BASE}.\n`);
}

const svc = () => createClient(URL_BASE, SERVICE, { auth: { persistSession: false } });
const anon = () => createClient(URL_BASE, ANON, { auth: { persistSession: false } });

async function makeUser(admin, email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  const client = anon();
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw new Error(`signIn: ${signInErr.message}`);
  const { data: session } = await client.auth.getSession();
  return { id: data.user.id, client, token: session.session.access_token };
}

/** A seller-shaped account: on the pilot list, with an application on file. */
async function giveSellerRecords(admin, userId, suffix) {
  const { error: memberErr } = await admin.from("shop_pilot_members").insert({ user_id: userId });
  if (memberErr) throw new Error(`pilot member: ${memberErr.message}`);
  const { error: appErr } = await admin.from("shop_applications").insert({
    applicant_user_id: userId,
    seller_type: "ca-nhan",
    full_name: "Người Bán B12",
    phone: "0901234567",
    shop_name: `Shop B12 ${suffix}`,
    city: "Hà Nội",
  });
  if (appErr) throw new Error(`application: ${appErr.message}`);
}

/** Exactly what useDeleteAccount does — same client, same explicit header. */
const callDeleteAccount = (user) =>
  user.client.functions.invoke("delete-account", {
    headers: { Authorization: `Bearer ${user.token}` },
  });

const errorBody = async (res) => {
  if (!res.error?.context?.json) return null;
  return res.error.context.json().catch(() => null);
};

const countRows = async (admin, table, column, value) => {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) throw new Error(`${table}: ${error.message || `HTTP ${error.code}`}`);
  return count ?? 0;
};

const authUserExists = async (admin, id) => {
  const { data, error } = await admin.auth.admin.getUserById(id);
  return !error && !!data?.user;
};

describe.skipIf(!up)("B12 — deleting the account of a shop owner", () => {
  let admin;
  let plain;   // seller records, no shop: the control
  let owner;   // owns a shop: the case
  let manager; // on the owner's shop as staff, owns nothing
  let shopId;
  let productId;
  let controlBody;

  beforeAll(async () => {
    admin = svc();
    plain = await makeUser(admin, `b12-plain-${RUN}@thepicklehub.test`);
    owner = await makeUser(admin, `b12-owner-${RUN}@thepicklehub.test`);
    manager = await makeUser(admin, `b12-manager-${RUN}@thepicklehub.test`);
    await giveSellerRecords(admin, plain.id, `${RUN}-a`);
    await giveSellerRecords(admin, owner.id, `${RUN}-b`);

    const { data: shop, error } = await admin
      .from("shops")
      .insert({
        slug: `b12-shop-${RUN}`,
        name: `Shop B12 ${RUN}`,
        owner_user_id: owner.id,
        city: "Hà Nội",
        state: "active",
      })
      .select("id")
      .single();
    if (error) throw new Error(`shop insert: ${error.message}`);
    shopId = shop.id;

    await admin.from("shop_members").insert([
      { shop_id: shopId, user_id: owner.id, role: "owner" },
      { shop_id: shopId, user_id: manager.id, role: "manager" },
    ]);

    // Something under the shop, so "nothing was touched" is a claim with
    // substance rather than a claim about an empty shop.
    const { data: product, error: pe } = await admin
      .from("products")
      .insert({
        shop_id: shopId,
        slug: `b12-vot-${RUN}`,
        title: `Vợt B12 ${RUN}`,
        condition: "new",
        status: "approved",
        is_published: true,
      })
      .select("id")
      .single();
    if (pe) throw new Error(`product insert: ${pe.message}`);
    productId = product.id;
  }, 60_000);

  afterAll(async () => {
    if (!up || !admin) return;
    if (shopId) await admin.from("shops").delete().eq("id", shopId);
    for (const u of [plain, owner, manager]) {
      if (!u) continue;
      await admin.from("shop_applications").delete().eq("applicant_user_id", u.id);
      await admin.from("shop_pilot_members").delete().eq("user_id", u.id);
      await admin.auth.admin.deleteUser(u.id).catch(() => {});
    }
  }, 60_000);

  // ── The control ───────────────────────────────────────────────────────────

  it("succeeds for a seller who owns no shop, and the cascades do the work", async () => {
    const res = await callDeleteAccount(plain);
    expect(res.error, "a seller with no shop must delete cleanly").toBeNull();
    expect(res.data?.success).toBe(true);
    controlBody = res.data;

    expect(await authUserExists(admin, plain.id)).toBe(false);
    // Both are ON DELETE CASCADE from auth.users, which is what makes the
    // Privacy Policy's "deleted with your account" true.
    expect(await countRows(admin, "shop_applications", "applicant_user_id", plain.id)).toBe(0);
    expect(await countRows(admin, "shop_pilot_members", "user_id", plain.id)).toBe(0);
  }, 30_000);

  it("🔴 B14 — reports success while every table it claims to clean has failed", async () => {
    // Measured, not inferred. service_role holds no DELETE on the tables
    // delete-account walks, two of them no longer exist, one column was
    // renamed. All thirteen steps fail into `warnings`, which nothing reads,
    // and the account is deleted only because auth.users cascades.
    //
    // 🔴 CHARACTERISATION, NOT APPROVAL. Tracked separately as B14; do not
    // "fix" it by granting the missing permissions — see the defect record.
    expect(Array.isArray(controlBody?.warnings)).toBe(true);
    expect(controlBody.warnings.length).toBeGreaterThan(0);
    for (const w of controlBody.warnings) {
      expect(w).toMatch(/permission denied|Could not find the table|does not exist/i);
    }
  }, 30_000);

  // ── The case ──────────────────────────────────────────────────────────────

  it("refuses a shop owner with a stable code, before touching anything", async () => {
    const res = await callDeleteAccount(owner);
    expect(res.error, "a shop owner must not be deleted").toBeTruthy();
    expect(res.error.context.status, "409, not a 500 — this is a decision, not a fault").toBe(409);

    const body = await errorBody(res);
    expect(body.code, "the UI branches on this string").toBe(OWNER_BLOCK);
    expect(body.error).toBe(OWNER_BLOCK);
    expect(body.shop_count).toBeGreaterThanOrEqual(1);
    expect(body.contact_email).toBe("tapickleballvn@gmail.com");
    expect(body.message).toContain("tapickleballvn@gmail.com");
    expect(body.success).not.toBe(true);

    // Not the FK talking. Reaching the FK would mean the cleanup already ran.
    expect(JSON.stringify(body)).not.toMatch(/Database error deleting user/i);
  }, 30_000);

  it("changes nothing at all — account, shop, product, membership, application", async () => {
    expect(await authUserExists(admin, owner.id)).toBe(true);
    expect(await countRows(admin, "shops", "id", shopId)).toBe(1);
    expect(await countRows(admin, "products", "id", productId)).toBe(1);
    expect(await countRows(admin, "shop_members", "user_id", owner.id)).toBe(1);
    expect(await countRows(admin, "shop_applications", "applicant_user_id", owner.id)).toBe(1);
    expect(await countRows(admin, "shop_pilot_members", "user_id", owner.id)).toBe(1);
  }, 30_000);

  it("answers a replay identically, with no side effect", async () => {
    const [a, b] = await Promise.all([callDeleteAccount(owner), callDeleteAccount(owner)]);
    for (const res of [a, b]) {
      expect(res.error).toBeTruthy();
      expect(res.error.context.status).toBe(409);
      expect((await errorBody(res)).code).toBe(OWNER_BLOCK);
    }
    // Two concurrent refusals must not add up to one deletion.
    expect(await authUserExists(admin, owner.id)).toBe(true);
    expect(await countRows(admin, "shops", "id", shopId)).toBe(1);
  }, 30_000);

  it("does not block a manager — ownership is the question, not membership", async () => {
    // Staff on somebody else's shop own nothing, so nothing is orphaned when
    // they leave. Blocking them would strand support accounts forever.
    const res = await callDeleteAccount(manager);
    expect(res.error, "a manager is not a shop owner").toBeNull();
    expect(res.data?.success).toBe(true);
    expect(await authUserExists(admin, manager.id)).toBe(false);
    // …and their membership row went with them.
    expect(await countRows(admin, "shop_members", "user_id", manager.id)).toBe(0);
    // The shop and its owner are untouched by a member leaving.
    expect(await countRows(admin, "shops", "id", shopId)).toBe(1);
  }, 30_000);

  it("works normally once the shop has been offboarded by hand", async () => {
    // The end of the runbook: an admin has dealt with the shop, and the
    // ordinary flow is available again. No special path, no second code.
    await admin.from("shops").delete().eq("id", shopId);
    shopId = null;

    const res = await callDeleteAccount(owner);
    expect(res.error).toBeNull();
    expect(res.data?.success).toBe(true);
    expect(await authUserExists(admin, owner.id)).toBe(false);
    expect(await countRows(admin, "shop_applications", "applicant_user_id", owner.id)).toBe(0);
  }, 30_000);
});

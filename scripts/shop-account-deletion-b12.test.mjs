/**
 * B12 — what actually happens when a shop owner asks us to delete their account.
 *
 * DIAGNOSTIC. This file changes no production behaviour and fixes nothing; it
 * pins the CURRENT state so the proposal argues from measurements rather than
 * from reading foreign keys. Several assertions describe a defect and say so —
 * inverting them is the definition of done for B12.
 *
 * It goes through the real path, deliberately:
 *
 *   useDeleteAccount  →  supabase.functions.invoke("delete-account")
 *                     →  supabase/functions/delete-account/index.ts
 *                     →  auth.admin.deleteUser()
 *
 * Reading FK definitions out of a migration would prove the constraint exists.
 * It would not tell us what the seller is shown, what is destroyed before the
 * failure, or whether the cleanup the function claims to do happens at all —
 * and the last one turned out to be the finding.
 *
 *   supabase start && supabase db reset
 *   npx vitest run scripts/shop-account-deletion-b12.test.mjs
 *
 * SKIPPED with a warning when no local stack is listening.
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
  console.warn(`\n⚠ B12 account-deletion diagnostic SKIPPED — no Supabase at ${URL_BASE}.\n`);
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
  // The hook reads the session and passes the access token explicitly. Do the
  // same, so this test breaks if that contract changes.
  const { data: session } = await client.auth.getSession();
  return { id: data.user.id, client, token: session.session.access_token };
}

/** A seller-shaped account: on the pilot list, with an application on file. */
async function giveSellerRecords(admin, userId) {
  const { error: memberErr } = await admin.from("shop_pilot_members").insert({ user_id: userId });
  if (memberErr) throw new Error(`pilot member: ${memberErr.message}`);
  const { error: appErr } = await admin.from("shop_applications").insert({
    applicant_user_id: userId,
    seller_type: "ca-nhan",
    full_name: "Người Bán B12",
    phone: "0901234567",
    shop_name: `Shop B12 ${RUN}`,
    city: "Hà Nội",
  });
  if (appErr) throw new Error(`application: ${appErr.message}`);
}

/** Exactly what useDeleteAccount does — same client, same explicit header. */
const callDeleteAccount = (user) =>
  user.client.functions.invoke("delete-account", {
    headers: { Authorization: `Bearer ${user.token}` },
  });

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
  let plain; // seller records, no shop: the control
  let owner; // owns a shop: the case
  let shopId;
  let controlBody;

  beforeAll(async () => {
    admin = svc();
    plain = await makeUser(admin, `b12-plain-${RUN}@thepicklehub.test`);
    owner = await makeUser(admin, `b12-owner-${RUN}@thepicklehub.test`);
    await giveSellerRecords(admin, plain.id);
    await giveSellerRecords(admin, owner.id);

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
    await admin.from("shop_members").insert({ shop_id: shopId, user_id: owner.id, role: "owner" });
  }, 60_000);

  afterAll(async () => {
    if (!up || !admin) return;
    if (shopId) await admin.from("shops").delete().eq("id", shopId);
    for (const u of [plain, owner]) {
      if (!u) continue;
      await admin.from("shop_applications").delete().eq("applicant_user_id", u.id);
      await admin.from("shop_pilot_members").delete().eq("user_id", u.id);
      await admin.auth.admin.deleteUser(u.id).catch(() => {});
    }
  }, 60_000);

  // ── The control ───────────────────────────────────────────────────────────
  // Without it, "the shop owner's deletion fails" could mean the whole feature
  // is broken rather than this one case.

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

  it("🔴 reports success while every table it claims to clean has failed", async () => {
    // Measured, not inferred: service_role holds no DELETE privilege on any of
    // the tables delete-account walks, two of them no longer exist, and one
    // column was renamed. All thirteen steps fail, land in `warnings`, and the
    // function returns 200 success anyway — the UI never reads `warnings`.
    //
    // The account IS deleted, but only because auth.users cascades. The
    // explicit cleanup has been decorative for as long as the grants have been
    // this way.
    //
    // 🔴 DESCRIBES A DEFECT. When it is fixed, this expects an empty array.
    expect(Array.isArray(controlBody?.warnings)).toBe(true);
    expect(controlBody.warnings.length).toBeGreaterThan(0);
    for (const w of controlBody.warnings) {
      expect(w).toMatch(/permission denied|Could not find the table|does not exist/i);
    }
  }, 30_000);

  // ── The case ──────────────────────────────────────────────────────────────

  it("fails for a shop owner", async () => {
    const res = await callDeleteAccount(owner);
    expect(res.error, "deleting a shop owner must NOT report success").toBeTruthy();

    const body = await res.error.context.json().catch(() => ({}));
    expect(body.error).toBe("Failed to delete account");
    expect(body.success).not.toBe(true);

    // 🔴 The reason never reaches anyone. GoTrue collapses the foreign-key
    // violation into "Database error deleting user", so neither the seller nor
    // the operator learns that a shop is what is in the way. Any fix has to
    // supply that sentence itself rather than hope this improves.
    expect(body.details).toBe("Database error deleting user");
    expect(JSON.stringify(body)).not.toMatch(/shops_owner_user_id|foreign key/i);
  }, 30_000);

  it("leaves the auth user AND the shop intact — the two never go out of step", async () => {
    // RESTRICT means there can never be a shop whose owner does not exist, nor
    // an owner whose shop silently vanished. That invariant holds.
    expect(await authUserExists(admin, owner.id)).toBe(true);
    expect(await countRows(admin, "shops", "id", shopId)).toBe(1);
    expect(await countRows(admin, "shop_members", "user_id", owner.id)).toBe(1);
  }, 30_000);

  it("leaves the seller's other records intact too — but by accident, not by care", async () => {
    // A reader could mistake this for careful ordering. It is not: the deletes
    // that run before auth.admin.deleteUser all fail on permissions, so there
    // is nothing left to be half-done. Grant those permissions without
    // rethinking the flow and this becomes a genuine partial deletion —
    // profile and roles gone, account still live, shop still standing.
    expect(await countRows(admin, "shop_applications", "applicant_user_id", owner.id)).toBe(1);
    expect(await countRows(admin, "shop_pilot_members", "user_id", owner.id)).toBe(1);
  }, 30_000);

  it("succeeds on a retry once the shop is gone", async () => {
    // The recovery an operator would reach for. It works, which is why option C
    // is viable: the block is the shop, and nothing about the account is
    // damaged while it is in place.
    await admin.from("shops").delete().eq("id", shopId);
    shopId = null;

    const res = await callDeleteAccount(owner);
    expect(res.error).toBeNull();
    expect(res.data?.success).toBe(true);
    expect(await authUserExists(admin, owner.id)).toBe(false);
    expect(await countRows(admin, "shop_applications", "applicant_user_id", owner.id)).toBe(0);
  }, 30_000);
});

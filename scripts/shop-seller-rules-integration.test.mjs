/**
 * Seller-rules acceptance, over HTTP, with a real user JWT.
 *
 * pgTAP already proves the rule inside Postgres. This file proves the same
 * thing through PostgREST — the path a client actually takes — because the two
 * have disagreed before in this repo: a grant can be missing where a policy is
 * fine, and a SECURITY DEFINER function can be unreachable to `authenticated`
 * while working perfectly for `postgres`.
 *
 * The case that matters most is the last one: a caller who never loads the UI
 * and POSTs straight at /rpc/shop_application_submit. That is not a
 * hypothetical attacker, it is a well-meaning script, and until this migration
 * it would have been let through.
 *
 *   supabase start && supabase db reset
 *   npx vitest run scripts/shop-seller-rules-integration.test.mjs
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

const PASSWORD = "rules-integration-pw-1";
const RUN = randomUUID().slice(0, 8);
const DOC_KEY = "seller-rules";
const VERSION = `it-${RUN}`;
const BODY =
  "[TEST-ONLY] Văn bản kiểm thử tích hợp cho ThePickleHub. Không phải quy chế thật, " +
  "không có hiệu lực pháp lý, và chỉ tồn tại trong vòng đời của một lần chạy test. " +
  "Nội dung thật do Product Owner và bộ phận pháp lý cung cấp.";

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
  console.warn(`\n⚠ seller-rules integration SKIPPED — no Supabase at ${URL_BASE}.\n`);
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
  return { id: data.user.id, client };
}

describe.skipIf(!up)("seller rules — over HTTP, as a client", () => {
  let admin;
  let signer;   // pilot member who will accept
  let refuser;  // pilot member who never accepts
  let hash;

  beforeAll(async () => {
    admin = svc();
    signer = await makeUser(admin, `rules-signer-${RUN}@thepicklehub.test`);
    refuser = await makeUser(admin, `rules-refuser-${RUN}@thepicklehub.test`);

    await admin.from("shop_pilot_members").insert([{ user_id: signer.id }, { user_id: refuser.id }]);

    for (const u of [signer, refuser]) {
      const { error } = await u.client.from("shop_applications").insert({
        applicant_user_id: u.id,
        seller_type: "ca-nhan",
        full_name: "Người Bán Kiểm Thử",
        phone: "0901234567",
        shop_name: `Shop Kiểm Thử ${RUN}`,
        city: "Hà Nội",
      });
      if (error) throw new Error(`application insert: ${error.message}`);
    }
  }, 60_000);

  afterAll(async () => {
    if (!up || !admin) return;
    for (const u of [signer, refuser]) {
      if (!u) continue;
      await admin.from("shop_applications").delete().eq("applicant_user_id", u.id);
      await admin.from("shop_pilot_members").delete().eq("user_id", u.id);
      // Signatures cascade with the user; the document can only be removed
      // once they are gone, which is the immutability rule doing its job.
      await admin.auth.admin.deleteUser(u.id);
    }
    await admin.from("legal_documents").delete().eq("document_key", DOC_KEY).eq("version", VERSION);
  }, 60_000);

  it("refuses the submit from someone who has signed nothing", async () => {
    // Deliberately NOT asserting `seller_rules_not_published`. Since migration
    // 20260814100000 the real "Quy chế người bán v1" is published with an
    // effective date, so which of the two refusals comes back depends on the
    // clock — and an assertion about a shared database's global state is how
    // this suite has been fooled before. What must hold at every hour is that
    // a complete application with no signature does not move.
    const { error } = await signer.client.rpc("shop_application_submit", {
      _expected_rules_version: null,
    });
    expect(error, "a complete application with no signature must NOT submit").toBeTruthy();
    expect(error.message).toMatch(/seller_rules_not_published|seller_rules_not_accepted/);
  });

  it("publishes a version whose hash the server computes", async () => {
    const { data, error } = await admin
      .from("legal_documents")
      .insert({
        document_key: DOC_KEY,
        version: VERSION,
        title: `[TEST-ONLY] Quy chế kiểm thử ${RUN}`,
        body: BODY,
        effective_at: new Date(Date.now() - 60_000).toISOString(),
        approved_by: "integration test (test-only)",
        approved_at: new Date(Date.now() - 120_000).toISOString(),
      })
      .select("content_hash")
      .single();
    expect(error).toBeNull();
    expect(data.content_hash, "the hash is generated, not supplied").toMatch(/^[0-9a-f]{64}$/);
    hash = data.content_hash;
  });

  it("lets an anonymous reader see the effective document — they must read before agreeing", async () => {
    const { data, error } = await anon().rpc("legal_current_document", { _document_key: DOC_KEY });
    expect(error).toBeNull();
    expect(data?.[0]?.version).toBe(VERSION);
    expect(data?.[0]?.body).toContain("TEST-ONLY");
  });

  it("still refuses the submit after publishing, before anyone signs", async () => {
    const { error } = await signer.client.rpc("shop_application_submit", {
      _expected_rules_version: VERSION,
    });
    expect(error).toBeTruthy();
    expect(error.message).toMatch(/seller_rules_not_accepted/);
  });

  it("refuses a signature whose hash does not match the text", async () => {
    const { error } = await signer.client.rpc("legal_accept", {
      _document_key: DOC_KEY,
      _version: VERSION,
      _content_hash: "0".repeat(64),
    });
    expect(error, "a hash mismatch means they read something else").toBeTruthy();
  });

  it("will not let a client write the signature directly", async () => {
    // There is no INSERT policy. This is the whole reason the checkbox cannot
    // be the authority: if this succeeded, ticking a box in devtools would be
    // consent.
    const { error } = await signer.client.from("legal_acceptances").insert({
      user_id: signer.id,
      document_key: DOC_KEY,
      version: VERSION,
      content_hash: hash,
    });
    expect(error, "a seller must not be able to sign by writing a row").toBeTruthy();
  });

  it("records a signature through the RPC, and replays on retry", async () => {
    const args = {
      _document_key: DOC_KEY,
      _version: VERSION,
      _content_hash: hash,
      _client_token: `it-${RUN}`,
    };
    const first = await signer.client.rpc("legal_accept", args);
    expect(first.error).toBeNull();
    expect(first.data.replayed).toBe(false);

    const second = await signer.client.rpc("legal_accept", args);
    expect(second.error).toBeNull();
    expect(second.data.replayed, "a retry must not produce a second signature").toBe(true);

    const { count } = await admin
      .from("legal_acceptances")
      .select("*", { count: "exact", head: true })
      .eq("user_id", signer.id);
    expect(count).toBe(1);
  });

  it("opens the submit for the person who signed — and only them", async () => {
    const ok = await signer.client.rpc("shop_application_submit", {
      _expected_rules_version: VERSION,
    });
    expect(ok.error).toBeNull();
    expect(ok.data).toBe("submitted");

    const denied = await refuser.client.rpc("shop_application_submit", {
      _expected_rules_version: VERSION,
    });
    expect(denied.error, "one seller's signature is not another's").toBeTruthy();
    expect(denied.error.message).toMatch(/seller_rules_not_accepted/);
  });

  it("refuses a caller that POSTs straight at the RPC with no UI in the picture", async () => {
    // Not a hypothetical attacker — a well-meaning script. Before migration
    // 20260814090000 this succeeded, because the only thing standing in its way
    // was a disabled checkbox in a React component it never rendered.
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/shop_application_submit`, {
      method: "POST",
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${(await refuser.client.auth.getSession()).data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(res.ok, "raw POST must be refused exactly like the client call").toBe(false);
    const text = await res.text();
    expect(text).toMatch(/seller_rules_not_accepted/);
  });

  it("cannot be edited under a signature", async () => {
    const { error } = await admin
      .from("legal_documents")
      .update({ body: `${BODY} thêm một điều khoản` })
      .eq("document_key", DOC_KEY)
      .eq("version", VERSION);
    expect(error, "even the service role cannot rewrite text people signed").toBeTruthy();
  });

  it("shows a moderator which version was accepted, and hides it from other sellers", async () => {
    const { data: app } = await admin
      .from("shop_applications")
      .select("id")
      .eq("applicant_user_id", signer.id)
      .single();

    const mine = await signer.client.rpc("shop_application_rules_receipt", {
      _application_id: app.id,
    });
    expect(mine.error).toBeNull();
    expect(mine.data.accepted).toBe(true);
    expect(mine.data.version).toBe(VERSION);
    expect(mine.data.content_hash).toBe(hash);

    const theirs = await refuser.client.rpc("shop_application_rules_receipt", {
      _application_id: app.id,
    });
    expect(theirs.error, "another seller has no business reading this").toBeTruthy();
  });
});

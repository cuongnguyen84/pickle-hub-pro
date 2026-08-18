// The hand-written shop schema and the migration must describe the same
// objects. Two copies of a schema drift the moment one is edited alone; this
// test is what makes the temporary copy safe to keep until the migration is
// applied and `supabase gen types` can take over.

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SHOP_P2A_RPCS,
  SHOP_P2A_TABLES,
  SHOP_P2B_PUBLIC_RPCS,
  SHOP_P2B_RPCS,
  SHOP_P2B_TABLES,
  SHOP_P3_RPCS,
  SHOP_P3_TABLES,
  SHOP_P3_VIEWS,
  SHOP_RPCS,
  SHOP_RULES_RPCS,
  SHOP_RULES_TABLES,
  SHOP_TABLES,
  SHOP_VIEWS,
} from "@/integrations/supabase/shop-schema";

const SQL = readFileSync(
  resolve(__dirname, "../../../supabase/migrations/20260811090000_shop_phase1_seller_onboarding.sql"),
  "utf8",
) +
  // shop_applications_admin lives in its own migration: the internal_note
  // column-privacy fix (CP27 case 6c) landed after phase 1 shipped.
  readFileSync(
    resolve(__dirname, "../../../supabase/migrations/20260814140000_shop_application_internal_note_privacy.sql"),
    "utf8",
  );

describe("shop schema parity with migration 20260811090000", () => {
  it.each(SHOP_TABLES)("migration creates table %s", (table) => {
    expect(SQL).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
  });

  it.each(SHOP_VIEWS)("migration creates view %s", (view) => {
    expect(SQL).toContain(`CREATE OR REPLACE VIEW public.${view}`);
  });

  it.each(SHOP_RPCS)("migration creates function %s", (fn) => {
    expect(SQL).toContain(`CREATE OR REPLACE FUNCTION public.${fn}(`);
  });

  it("every created table enables RLS", () => {
    for (const table of SHOP_TABLES) {
      expect(SQL).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
  });

  it("every created table has a GRANT — a policy without a grant is a 42501", () => {
    for (const table of SHOP_TABLES) {
      expect(SQL).toMatch(new RegExp(`GRANT[^;]*ON public\\.${table}\\s+TO`, "s"));
    }
  });

  it("does NOT create the tables the pilot decided not to collect", () => {
    // proposal.md §2: no CCCD, no bank details at pilot. A table is where
    // collection starts. Naming them in a comment that explains the decision
    // is fine — creating them is not.
    const created = [...SQL.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?public\.(\w+)/g)].map((m) => m[1]);
    expect(created).not.toContain("shop_bank_accounts");
    expect(created).not.toContain("shop_application_documents");
  });

  it("does not add a seller role to the global app_role enum", () => {
    // plan §6 "Ownership model" — marketplace access is shop_members rows.
    expect(SQL).not.toMatch(/ALTER TYPE public\.app_role/);
  });

  it("keeps internal_note out of the applicant-facing view", () => {
    const view = SQL.slice(SQL.indexOf("CREATE OR REPLACE VIEW public.my_shop_application"));
    const body = view.slice(0, view.indexOf(";"));
    expect(body).not.toContain("internal_note");
  });

  it("every state-changing RPC is SECURITY DEFINER with a pinned search_path", () => {
    for (const fn of ["shop_application_submit", "shop_application_withdraw", "shop_application_decide"]) {
      const at = SQL.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
      const head = SQL.slice(at, at + 600);
      expect(head, `${fn} must be SECURITY DEFINER`).toContain("SECURITY DEFINER");
      expect(head, `${fn} must pin search_path`).toContain("SET search_path = public");
    }
  });

  it("the decide RPC checks is_admin before anything else", () => {
    const at = SQL.indexOf("CREATE OR REPLACE FUNCTION public.shop_application_decide(");
    const body = SQL.slice(at, at + 1400);
    expect(body).toContain("IF NOT public.is_admin() THEN");
  });
});

// ── P2a ─────────────────────────────────────────────────────────────────────
// Same reasoning, wider net. The P2a objects are spread over six migrations,
// so this reads them as one body of SQL rather than pinning each object to
// whichever file it happens to live in today.

const P2A_SQL = [
  "20260811120000_shop_phase2a_catalog.sql",
  "20260811140000_shop_phase2a_media_lifecycle.sql",
  "20260811150000_shop_media_cleanup_cron.sql",
  "20260811160000_shop_service_role_grants.sql",
  "20260811170000_shop_draft_media_least_privilege.sql",
  "20260811180000_shop_profile.sql",
  "20260811190000_shop_contact_business_phone.sql",
  "20260811200000_shop_product_editor.sql",
  "20260811210000_shop_variants_inventory.sql",
  "20260811220000_shop_media_ordering_profile.sql",
  "20260811230000_shop_preview_submit.sql",
]
  .map((f) => readFileSync(resolve(__dirname, "../../../supabase/migrations", f), "utf8"))
  .join("\n");

describe("shop schema parity with the P2a migrations", () => {
  it.each(SHOP_P2A_TABLES)("a P2a migration creates table %s", (table) => {
    expect(P2A_SQL).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
  });

  it.each(SHOP_P2A_RPCS)("a P2a migration creates function %s", (fn) => {
    expect(P2A_SQL).toContain(`CREATE OR REPLACE FUNCTION public.${fn}(`);
  });

  it("every P2a table enables RLS and has a GRANT", () => {
    for (const table of SHOP_P2A_TABLES) {
      expect(P2A_SQL, table).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(P2A_SQL, table).toMatch(new RegExp(`GRANT[^;]*ON public\\.${table}\\s+TO`, "s"));
    }
  });

  it("still collects nothing the pilot decided not to collect", () => {
    const created = [...P2A_SQL.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?public\.(\w+)/g)].map((m) => m[1]);
    for (const forbidden of ["shop_bank_accounts", "shop_application_documents", "shop_kyc_documents"]) {
      expect(created).not.toContain(forbidden);
    }
  });

  it("the public rendition bucket has no client-writable storage policy", () => {
    // D1. Any policy other than SELECT naming that bucket would let a seller
    // publish their own bytes, which is the whole thing the hybrid prevents.
    const policies = [
      ...P2A_SQL.matchAll(/CREATE POLICY "([^"]+)" ON storage\.objects\s+FOR (\w+)[^;]*?'shop-product-media'/gs),
    ];
    expect(policies.length, "the guard must not be vacuous").toBeGreaterThan(0);
    for (const [, name, cmd] of policies) expect(cmd, name).toBe("SELECT");
  });

  it("the draft bucket is readable by managers and admins only", () => {
    // Not is_shop_member: the original still carries the seller's EXIF.
    const at = P2A_SQL.lastIndexOf('CREATE POLICY "shop_product_media_draft_select"');
    const body = P2A_SQL.slice(at, P2A_SQL.indexOf(";", at));
    expect(body).toContain("is_shop_manager");
    expect(body).not.toContain("is_shop_member");
  });
});

// ── P2b ─────────────────────────────────────────────────────────────────────
// The moderation backend. Same net, plus the invariants that decide whether
// P2b.2 can be trusted to render a decision button at all.

const P2B_SQL = [
  "20260812090000_shop_p2b_status_suspended.sql",
  "20260812091000_shop_p2b_moderation_backend.sql",
  "20260812120000_shop_p2b_q5_q6_closure.sql",
  "20260813090000_shop_p2b_public_read.sql",
]
  .map((f) => readFileSync(resolve(__dirname, "../../../supabase/migrations", f), "utf8"))
  .join("\n");

// Q5/Q6 replace two P2b.1 functions wholesale, so assertions about their FINAL
// shape read the closure migration alone — searching the concatenation would
// happily match the superseded copy.
const Q5_SQL = readFileSync(
  resolve(__dirname, "../../../supabase/migrations/20260812120000_shop_p2b_q5_q6_closure.sql"),
  "utf8",
);

describe("shop schema parity with the P2b migrations", () => {
  it.each(SHOP_P2B_TABLES)("a P2b migration creates table %s", (table) => {
    expect(P2B_SQL).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
  });

  it.each(SHOP_P2B_RPCS)("a P2b migration creates function %s", (fn) => {
    expect(P2B_SQL).toContain(`CREATE OR REPLACE FUNCTION public.${fn}(`);
  });

  it("every P2b table enables RLS and has a GRANT", () => {
    for (const table of SHOP_P2B_TABLES) {
      expect(P2B_SQL, table).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(P2B_SQL, table).toMatch(new RegExp(`GRANT[^;]*ON public\\.${table}\\s+TO`, "s"));
    }
  });

  it("every moderation RPC is SECURITY DEFINER with a pinned search_path", () => {
    for (const fn of [
      "product_decide",
      "product_approve_preflight",
      "product_moderation_queue",
      "product_moderation_detail",
      "product_moderation_history",
      "shop_contact_decide",
    ]) {
      const at = P2B_SQL.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
      const head = P2B_SQL.slice(at, at + 900);
      expect(head, `${fn} must be SECURITY DEFINER`).toContain("SECURITY DEFINER");
      expect(head, `${fn} must pin search_path`).toContain("SET search_path = public");
    }
  });

  it("every admin-only routine checks is_admin INSIDE the function", () => {
    // Not in the route guard, and not in a policy — a SECURITY DEFINER
    // function bypasses RLS, so the policy would never be consulted.
    for (const fn of [
      "product_decide",
      "product_approve_preflight",
      "product_moderation_queue",
      "product_moderation_detail",
      "shop_contact_decide",
      "shop_contact_moderation_queue",
    ]) {
      const at = P2B_SQL.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
      const body = P2B_SQL.slice(at, P2B_SQL.indexOf("END $$;", at));
      expect(body, `${fn} must gate on is_admin()`).toContain("IF NOT public.is_admin() THEN");
    }
  });

  it("the moderation history is append-only in BOTH ways", () => {
    // A trigger alone passed once in P2a while a missing GRANT answered first,
    // so the assertion could not tell which one was doing the work.
    expect(P2B_SQL).toMatch(/CREATE TRIGGER product_moderation_events_append_only_trg/);
    expect(P2B_SQL).toMatch(/REVOKE ALL\s+ON public\.product_moderation_events FROM anon, authenticated/);
    expect(P2B_SQL).toMatch(/GRANT\s+SELECT ON public\.product_moderation_events TO authenticated/);
  });

  it("approve does not publish", () => {
    // The bytes are copied by the worker. Setting is_published at approve time
    // aims a public URL at an object that does not exist yet.
    const at = P2B_SQL.indexOf("CREATE OR REPLACE FUNCTION public.product_decide(");
    const body = P2B_SQL.slice(at, P2B_SQL.indexOf("END $$;", at));
    expect(body).toContain("WHEN _decision = 'approve' THEN is_published");
  });

  it("suspended never goes straight back to approved (Q5)", () => {
    // The only exit is `reopen`, and it lands on needs_changes so the seller
    // has to fix something and an admin has to approve it again. A CASE arm
    // mapping 'reopen' to 'approved' is the mistake this catches.
    expect(Q5_SQL).toContain("WHEN 'reopen'          THEN 'needs_changes'");
    expect(Q5_SQL).not.toMatch(/WHEN 'reopen'\s+THEN 'approved'/);
    expect(Q5_SQL).toContain("WHEN 'suspended'      THEN '[\"reopen\"]'::jsonb");
    // And nothing calls itself `restore` — the word invites exactly the
    // behaviour Q5 forbids.
    expect(Q5_SQL).not.toMatch(/'restore'/);
  });

  it("reopen demands a reason and a target, like request_changes", () => {
    expect(Q5_SQL).toContain("IF _decision IN ('request_changes', 'reopen') THEN");
    expect(Q5_SQL).toContain("PERFORM public.product_moderation_targets_check");
  });

  it("contact history is its own table, not a nullable product_id (Q6)", () => {
    expect(Q5_SQL).toContain("CREATE TABLE IF NOT EXISTS public.shop_contact_moderation_events");
    const at = Q5_SQL.indexOf("CREATE TABLE IF NOT EXISTS public.shop_contact_moderation_events");
    const body = Q5_SQL.slice(at, Q5_SQL.indexOf(");", at));
    expect(body).toContain("contact_channel_id");
    expect(body, "a contact event is about a shop, not a product").not.toContain("product_id");
    // The channel TYPE travels through history; the value never does.
    expect(body).toContain("channel_type");
    expect(body).not.toContain("value_normalized");
  });
});

// ── P2b.3 — the public read model ───────────────────────────────────────────

const PUB_SQL = readFileSync(
  resolve(__dirname, "../../../supabase/migrations/20260813090000_shop_p2b_public_read.sql"),
  "utf8",
);

describe("the public read model takes no privilege flag", () => {
  it.each(SHOP_P2B_PUBLIC_RPCS)("a P2b.3 migration creates %s", (fn) => {
    expect(PUB_SQL).toContain(`CREATE OR REPLACE FUNCTION public.${fn}(`);
  });

  it("no shop_public_* function accepts _as_seller", () => {
    // The escalation class is removed at the edge rather than defended at the
    // centre. pgTAP asserts the same thing against the live catalog; this is
    // the cheap guard that fails in CI before a migration is ever applied.
    for (const [, sig] of PUB_SQL.matchAll(
      /CREATE OR REPLACE FUNCTION public\.(shop_public_\w+)\(([\s\S]*?)\)\s*RETURNS/g,
    )) {
      expect(sig).not.toMatch(/_as_seller/);
    }
  });

  it("the seller-only fields are seller-only by construction", () => {
    // stock_on_hand was already. `path` is rendition_source_path — an object
    // in the DRAFT bucket that the public reader used to receive for every
    // photo, which the P2a checks missed because they searched for
    // `draft_path` and `/original`.
    expect(PUB_SQL).toMatch(/'stock_on_hand',\s*CASE WHEN _as_seller/);
    expect(PUB_SQL).toMatch(/'path',\s*CASE WHEN _as_seller/);
  });

  it("a buyer only ever sees media with committed public bytes", () => {
    expect(PUB_SQL).toContain("AND (_as_seller OR m.public_path IS NOT NULL)");
  });

  it("the cursor keeps its tie-breaker", () => {
    // Without the id, two products published in the same batch share a
    // timestamp and one of them is silently skipped between pages.
    expect(PUB_SQL).toContain("(v.created_at, v.id) < (_cursor_at, _cursor_id)");
  });
});

// ── Seller rules (CP12) ─────────────────────────────────────────────────────
// The gate this migration adds is the only thing standing between a real
// seller and an approval with no record of consent, so the assertions here are
// about the gate being in the right PLACE, not merely present somewhere.

const RULES_SQL = readFileSync(
  resolve(__dirname, "../../../supabase/migrations/20260814090000_shop_seller_rules_acceptance.sql"),
  "utf8",
);

describe("seller-rules acceptance parity with migration 20260814090000", () => {
  it.each(SHOP_RULES_TABLES)("the migration creates table %s", (table) => {
    expect(RULES_SQL).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
  });

  it.each(SHOP_RULES_RPCS)("the migration creates function %s", (fn) => {
    expect(RULES_SQL).toContain(`CREATE OR REPLACE FUNCTION public.${fn}(`);
  });

  it("both tables enable RLS and carry a GRANT", () => {
    for (const table of SHOP_RULES_TABLES) {
      expect(RULES_SQL, table).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(RULES_SQL, table).toMatch(new RegExp(`GRANT[^;]*ON public\\.${table}\\s+TO`, "s"));
    }
  });

  it("gives nobody an INSERT policy on legal_acceptances", () => {
    // The signature is written by legal_accept() or not at all. A policy here
    // would let a seller sign for themselves with a plain INSERT — precisely
    // the checkbox-as-authority failure this migration exists to end.
    const policies = [...RULES_SQL.matchAll(/CREATE POLICY "([^"]+)" ON public\.legal_acceptances\s+FOR (\w+)/g)];
    expect(policies.length).toBeGreaterThan(0);
    for (const [, name, verb] of policies) {
      expect(verb, `policy ${name}`).toBe("SELECT");
    }
  });

  it("computes content_hash rather than accepting one", () => {
    expect(RULES_SQL).toMatch(/content_hash TEXT GENERATED ALWAYS AS/);
  });

  it("will not serve a document nobody approved", () => {
    // An unapproved row is a draft. Staging text before approval has to be
    // safe, which means the draft must be unreadable AND unsignable — and the
    // only thing separating it from a live document is this one predicate.
    const at = RULES_SQL.indexOf("CREATE OR REPLACE FUNCTION public.legal_current_document(");
    const body = RULES_SQL.slice(at, RULES_SQL.indexOf("COMMENT ON FUNCTION public.legal_current_document"));
    expect(body).toContain("d.approved_at IS NOT NULL");
    // …and the read policy has to agree, or a draft leaks through PostgREST
    // while the RPC refuses it.
    const policy = RULES_SQL.slice(
      RULES_SQL.indexOf('CREATE POLICY "legal_documents_select_effective"'),
      RULES_SQL.indexOf('DROP POLICY IF EXISTS "legal_documents_admin_write"'),
    );
    expect(policy).toContain("approved_at IS NOT NULL");
  });

  it("refuses to let a version take effect before it was approved", () => {
    expect(RULES_SQL).toMatch(/legal_documents_no_backdate[\s\S]{0,120}effective_at >= approved_at/);
    // Half an approval is not an approval.
    expect(RULES_SQL).toContain("legal_documents_approval_pair");
  });

  it("scopes a version to the programme it governs", () => {
    // The pilot's rules are not the public launch's rules. Without a scope the
    // reuse on launch day would be silent, which is the problem with it.
    expect(RULES_SQL).toMatch(/scope\s+TEXT NOT NULL DEFAULT 'closed-pilot'/);
    expect(RULES_SQL).toContain("legal_documents_scope_check");
  });

  it("drops the zero-argument submit instead of leaving it beside the new one", () => {
    // Two overloads make a no-argument call ambiguous (42725) — the failure
    // that once broke every approve, reject and request-changes here.
    expect(RULES_SQL).toContain("DROP FUNCTION IF EXISTS public.shop_application_submit();");
  });

  it("puts the acceptance check INSIDE shop_application_submit", () => {
    // Not in a wrapper, not in the client, not in a trigger on some other
    // table: in the function a caller who skips the UI would call.
    const at = RULES_SQL.indexOf("CREATE OR REPLACE FUNCTION public.shop_application_submit(");
    expect(at).toBeGreaterThan(-1);
    const body = RULES_SQL.slice(at);
    expect(body).toContain("seller_rules_not_published");
    expect(body).toContain("seller_rules_not_accepted");
    expect(body).toContain("legal_current_document('seller-rules')");
    expect(body).toMatch(/a\.content_hash\s*=\s*_doc\.content_hash/);
  });

  it("takes user, time and hash from the server, never from the caller", () => {
    const at = RULES_SQL.indexOf("CREATE OR REPLACE FUNCTION public.legal_accept(");
    const body = RULES_SQL.slice(at, RULES_SQL.indexOf("REVOKE ALL ON FUNCTION public.legal_current_document"));
    expect(body).toContain("(auth.uid(), _doc.document_key, _doc.version, _doc.content_hash, _app, _client_token)");
    expect(body).not.toMatch(/_accepted_at|_user_id\s+UUID/);
  });

  it("seeds no legal text — a placeholder is worse than an empty table", () => {
    // An empty table blocks the submit. A placeholder lets a real seller sign
    // something nobody approved.
    expect(RULES_SQL).not.toMatch(/INSERT INTO public\.legal_documents/);
  });

  it("does not collect an IP address or a device fingerprint", () => {
    // New personal data needs a privacy decision that has not been made. The
    // schema has nowhere to put it, so nobody can start by accident.
    //
    // Comments are stripped first. The migration's own note explaining that it
    // collects no fingerprint contains the word "fingerprint", and the first
    // version of this assertion failed on that note — a grep test that reads
    // prose is testing the prose.
    const code = RULES_SQL.replace(/--[^\n]*/g, "");
    expect(code).not.toMatch(/\bip\s+(inet|text)\b|user_agent|fingerprint/i);
  });
});

// ── Phase 3 — cart and orders ───────────────────────────────────────────────
// The same net as P2a/P2b, plus the two invariants that decide whether the
// Phase 3 screens can be trusted with money: the total is the database's, and
// nothing new collects a bank detail.

// Resolved by NAME, not by full filename. `shop_cart_items` was renamed
// 20260818090000 → 20260818095000 when #614 landed the same timestamp, and
// this list — which hardcoded the old filename — was the one thing in the repo
// that broke. A migration's version is allowed to move (it did, and had to);
// its name is what identifies it here.
const MIGRATIONS_DIR = resolve(__dirname, "../../../supabase/migrations");

function migrationByName(name: string): string {
  const hit = readdirSync(MIGRATIONS_DIR).find((f) => f.endsWith(`_${name}.sql`));
  if (!hit) throw new Error(`no migration named ${name} in supabase/migrations`);
  return readFileSync(resolve(MIGRATIONS_DIR, hit), "utf8");
}

const P3_SQL = [
  "shop_cart_items",
  "shop_orders",
  "shop_phase3_projection_and_address",
]
  .map(migrationByName)
  .join("\n");

describe("shop schema parity with the Phase 3 migrations", () => {
  it.each(SHOP_P3_TABLES)("a P3 migration creates table %s", (table) => {
    expect(P3_SQL).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
  });

  it.each(SHOP_P3_RPCS)("a P3 migration creates function %s", (fn) => {
    expect(P3_SQL).toContain(`CREATE OR REPLACE FUNCTION public.${fn}(`);
  });

  it.each(SHOP_P3_VIEWS)("a P3 migration creates view %s", (view) => {
    expect(P3_SQL).toContain(`CREATE VIEW public.${view}`);
    // Deliberately NOT security_invoker, and the reason is COLUMN privileges,
    // not policies. With invoker=on the view's own `WHERE buyer_user_id =
    // auth.uid()` would still run (RLS would only stack on top of it) — but
    // Postgres would then check column privileges as the CALLER, and
    // `authenticated` holds no SELECT on shop_orders.buyer_user_id. The view
    // would answer 42501 to every buyer. Written down because a wrong reason
    // here is exactly how the next person "fixes" this into a 42501.
    expect(P3_SQL, view).not.toMatch(/WITH\s*\(\s*security_invoker/i);
    expect(P3_SQL, view).toContain(`GRANT SELECT ON public.${view} TO authenticated`);
  });

  it("every P3 table enables RLS, revokes the table and grants COLUMNS", () => {
    // `GRANT[^;]*ON public.<table> TO` matched a grant to service_role and
    // called it a day — so a table with nothing at all for `authenticated`, or
    // with a bare table grant handing over every column, both passed. The two
    // halves are asserted separately because they answer different questions:
    // REVOKE closes the table, the column-scoped GRANT reopens exactly the
    // columns that are allowed out.
    for (const table of SHOP_P3_TABLES) {
      expect(P3_SQL, table).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(P3_SQL, table).toMatch(
        new RegExp(`REVOKE ALL ON public\\.${table}\\s+FROM anon, authenticated`),
      );
      expect(P3_SQL, table).toMatch(
        new RegExp(`GRANT SELECT \\([^)]*\\)\\s*ON public\\.${table} TO authenticated`, "s"),
      );
    }
  });

  it("every state-changing P3 RPC is SECURITY DEFINER with a pinned search_path", () => {
    for (const fn of ["shop_cart_view", "shop_order_create", "shop_order_transition"]) {
      const at = P3_SQL.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
      const head = P3_SQL.slice(at, at + 900);
      expect(head, `${fn} must be SECURITY DEFINER`).toContain("SECURITY DEFINER");
      expect(head, `${fn} must pin search_path`).toContain("SET search_path = public");
    }
  });

  it("still collects nothing the pilot decided not to collect", () => {
    // D2: no bank details at the pilot, so no table to start collecting into.
    // A comment explaining the decision is fine; a CREATE TABLE is not.
    const created = [...P3_SQL.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?public\.(\w+)/g)].map(
      (m) => m[1],
    );
    for (const forbidden of [
      "shop_bank_accounts",
      "shop_payments",
      "payments",
      "shipments",
      "returns",
      "disputes",
      "wishlist_items",
    ]) {
      expect(created).not.toContain(forbidden);
    }
  });

  it("keeps the money in generated columns", () => {
    // The RPC never receives a total and never computes one — so there is no
    // arithmetic for a client to forge and none for the server to get wrong.
    expect(P3_SQL).toMatch(
      /total_vnd\s+INTEGER GENERATED ALWAYS AS \(items_total_vnd \+ shipping_fee_vnd\) STORED/,
    );
    expect(P3_SQL).toMatch(
      /line_total_vnd INTEGER GENERATED ALWAYS AS \(qty \* unit_price_vnd\) STORED/,
    );
  });

  it("never grants a bare UPDATE on the cart", () => {
    // A bare GRANT UPDATE lets a client rewrite variant_id, which is a
    // different product at the same row id.
    expect(P3_SQL).toContain("GRANT UPDATE (qty)");
    expect(P3_SQL).not.toMatch(/GRANT\s+UPDATE\s+ON public\.shop_cart_items/);
  });

  it("withholds buyer_user_id and client_token from the client", () => {
    const grant = P3_SQL.slice(
      P3_SQL.indexOf("GRANT SELECT (\n  id, code, shop_id"),
      P3_SQL.indexOf(") ON public.shop_orders TO authenticated"),
    );
    expect(grant.length, "the shop_orders column grant must exist").toBeGreaterThan(0);
    expect(grant).not.toContain("buyer_user_id");
    expect(grant).not.toContain("client_token");
  });

  it("keeps shop_order_events append-only in BOTH ways", () => {
    // The GRANT answers before the trigger runs, so an append-only claim needs
    // both halves — a trigger alone once passed while a missing grant was doing
    // the work.
    expect(P3_SQL).toMatch(/CREATE TRIGGER shop_order_events_append_only_trg/);
    expect(P3_SQL).toMatch(/REVOKE ALL ON public\.shop_order_events FROM anon, authenticated/);
    expect(P3_SQL).not.toMatch(/GRANT[^;]*UPDATE[^;]*ON public\.shop_order_events TO authenticated/s);
  });

  it("moves stock itself instead of calling product_variant_adjust_stock", () => {
    // That RPC PERFORMs product_assert_writable(), which demands
    // is_shop_manager(); a buyer is not a member of the shop they buy from, so
    // the call would be an insufficient_privilege by design (§B.S2).
    // Slice to the END OF shop_order_create, not to the end of the file:
    // shop_order_transition moves stock too and has its own set_config pair, so
    // an open-ended slice let THAT one satisfy this assertion — deleting
    // set_config from shop_order_create left the test green.
    const body = P3_SQL.slice(
      P3_SQL.indexOf("CREATE OR REPLACE FUNCTION public.shop_order_create("),
      P3_SQL.indexOf("REVOKE ALL   ON FUNCTION public.shop_order_create"),
    );
    expect(body.length, "the shop_order_create body must be found").toBeGreaterThan(0);
    expect(body).not.toContain("product_variant_adjust_stock");
    expect(body).toContain("set_config('shop.stock_write', 'on', true)");
    expect(body).toContain("'sale'");
  });

  it("adds exactly one inventory reason and reuses 'return' for cancellations", () => {
    expect(P3_SQL).toContain(
      "reason IN ('opening', 'restock', 'correction', 'damage', 'lost', 'return', 'manual', 'sale')",
    );
    // Comments stripped first: the migration's own note explaining why it did
    // NOT add 'order_cancel' contains the word, and the first version of this
    // assertion failed on that note. A grep test that reads prose tests prose —
    // the same lesson the seller-rules fingerprint assertion learned.
    expect(P3_SQL.replace(/--[^\n]*/g, "")).not.toContain("order_cancel");
  });

  it("has no completed, no awaiting_payment and no notify_key", () => {
    expect(P3_SQL).toContain(
      "status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')",
    );
    const code = P3_SQL.replace(/--[^\n]*/g, "");
    expect(code).not.toMatch(/'completed'|'awaiting_payment'|notify_key/);
  });
});

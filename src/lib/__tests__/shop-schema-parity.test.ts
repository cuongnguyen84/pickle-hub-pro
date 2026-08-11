// The hand-written shop schema and the migration must describe the same
// objects. Two copies of a schema drift the moment one is edited alone; this
// test is what makes the temporary copy safe to keep until the migration is
// applied and `supabase gen types` can take over.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SHOP_P2A_RPCS,
  SHOP_P2A_TABLES,
  SHOP_RPCS,
  SHOP_TABLES,
  SHOP_VIEWS,
} from "@/integrations/supabase/shop-schema";

const SQL = readFileSync(
  resolve(__dirname, "../../../supabase/migrations/20260811090000_shop_phase1_seller_onboarding.sql"),
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

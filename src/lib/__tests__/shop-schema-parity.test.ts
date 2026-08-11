// The hand-written shop schema and the migration must describe the same
// objects. Two copies of a schema drift the moment one is edited alone; this
// test is what makes the temporary copy safe to keep until the migration is
// applied and `supabase gen types` can take over.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SHOP_RPCS, SHOP_TABLES, SHOP_VIEWS } from "@/integrations/supabase/shop-schema";

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

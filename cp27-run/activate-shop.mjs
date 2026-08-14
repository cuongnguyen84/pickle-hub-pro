// Admin activates the shop — the sanctioned path: REST PATCH under the
// shops_update_admin policy (aal2), the guard trigger allows state for admins.
import { readFileSync } from "node:fs";
import { URL as SB, ANON, sql } from "./env.mjs";
import { session, record, summary } from "./lib.mjs";
const STATE = process.env.CP27_STATE ?? "/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/state.json";
const state = JSON.parse(readFileSync(STATE, "utf8"));
const admin = await session("admin", { aal2: true });
const r = await fetch(`${SB}/rest/v1/shops?id=eq.${state.shopId}`, {
  method: "PATCH",
  headers: { apikey: ANON, Authorization: `Bearer ${admin.token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
  body: JSON.stringify({ state: "active" }),
});
const row = (await sql(`SELECT state::text FROM public.shops WHERE id='${state.shopId}';`)).at(-1);
record("11d", "admin activates the shop through the admin policy, not psql",
  r.status < 300 && row.state === "active" ? "PASS" : "FAIL",
  `PATCH HTTP ${r.status} → state=${row.state}`);
process.exit(summary() ? 1 : 0);

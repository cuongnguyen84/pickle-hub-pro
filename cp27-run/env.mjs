// Shared staging handles for CP27. The project ref is a literal here, not an
// argument, so no stale environment can point a write at production.
import { execFileSync } from "node:child_process";

export const REF = "utokwfcljxjkpkaqgheo";
export const PRODUCTION_REF = "ajvlcamxemgbxduhiqrl";
export const URL = `https://${REF}.supabase.co`;
export const SITE = "https://thepicklehub-shop-staging.pages.dev";
export const REGISTRY = "/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/registry.json";

if (REF === PRODUCTION_REF) throw new Error("REFUSING: staging ref equals production ref");

const mgmtToken = execFileSync(
  "security",
  ["find-generic-password", "-a", process.env.USER, "-s", "thepicklehub-shop-staging-supabase", "-w"],
  { encoding: "utf8" },
).trim();

const keyRes = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, {
  headers: { Authorization: `Bearer ${mgmtToken}` },
});
const keys = await keyRes.json();
export const ANON = keys.find((k) => k.name === "anon").api_key;
export const SERVICE = keys.find((k) => k.name === "service_role").api_key;

/** Management API SQL. Used for fixture setup and assertions, never by the browser. */
export async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${mgmtToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: `SELECT 1;\n${query}` }),
  });
  const body = await res.json();
  if (!res.ok || (!Array.isArray(body) && (body.error || body.message))) {
    throw new Error(`SQL failed: ${JSON.stringify(body).slice(0, 500)}\n--- query ---\n${query.slice(0, 400)}`);
  }
  return body;
}

export const anonHeaders = { apikey: ANON, "Content-Type": "application/json" };
export const serviceHeaders = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
};

export const mask = (s) => (s ? `${s.slice(0, 6)}…${s.slice(-4)}` : "(none)");

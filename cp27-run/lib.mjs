// Shared actor helpers for CP27. Every call carries a real user JWT; the
// service role never appears here.
import { readFileSync } from "node:fs";
import { URL as SB, ANON, anonHeaders, REGISTRY } from "./env.mjs";
import { totp } from "./totp.mjs";

export const reg = JSON.parse(readFileSync(REGISTRY, "utf8"));
const sec = JSON.parse(readFileSync(REGISTRY.replace("registry.json", "secrets.local.json"), "utf8"));

export const uid = (who) => reg.users.find((u) => u.who === who).id;
export const mailOf = (who) => reg.users.find((u) => u.who === who).email;
export const bearer = (t) => ({ apikey: ANON, Authorization: `Bearer ${t}`, "Content-Type": "application/json" });
export const claims = (jwt) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());

const authFetch = (p, i) =>
  fetch(`${SB}/auth/v1${p}`, i).then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) }));

/** Sign in for real. `aal2: true` answers a real TOTP challenge. */
export async function session(who, { aal2 = false } = {}) {
  const r = await authFetch("/token?grant_type=password", {
    method: "POST",
    headers: anonHeaders,
    body: JSON.stringify({ email: mailOf(who), password: sec[who] }),
  });
  if (!r.ok) throw new Error(`signin ${who}: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  let s = r.body;
  if (aal2) {
    const ch = await authFetch(`/factors/${sec.factorId}/challenge`, {
      method: "POST", headers: bearer(s.access_token), body: "{}",
    });
    const v = await authFetch(`/factors/${sec.factorId}/verify`, {
      method: "POST",
      headers: bearer(s.access_token),
      body: JSON.stringify({ challenge_id: ch.body.id, code: totp(sec.totpSecret) }),
    });
    if (!v.ok) throw new Error(`aal2 verify: ${JSON.stringify(v.body).slice(0, 200)}`);
    s = v.body;
  }
  const c = claims(s.access_token);
  if (c.sub !== uid(who)) throw new Error(`actor mismatch: expected ${who}`);
  return { who, token: s.access_token, refresh: s.refresh_token, aal: c.aal, sub: c.sub, expires_at: s.expires_at, raw: s };
}

export const rpc = (name, token, body = {}) =>
  fetch(`${SB}/rest/v1/rpc/${name}`, { method: "POST", headers: bearer(token), body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.text(), json: () => { try { return JSON.parse(r.bodyText); } catch { return null; } } }));

export async function rest(path, token, init = {}) {
  const r = await fetch(`${SB}/rest/v1${path}`, {
    ...init,
    headers: { ...bearer(token), ...(init.headers ?? {}) },
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, text, json };
}

export const results = [];
export function record(n, name, verdict, detail) {
  results.push({ n, name, verdict, detail });
  const icon = verdict === "PASS" ? "✅" : verdict === "SKIP" ? "·" : verdict === "BLOCKED" ? "🔴" : "❌";
  console.log(`${icon} case ${String(n).padEnd(5)} ${name}\n       ${detail}`);
}
export function summary() {
  const pass = results.filter((r) => r.verdict === "PASS").length;
  const fail = results.filter((r) => r.verdict === "FAIL").length;
  const blocked = results.filter((r) => r.verdict === "BLOCKED").length;
  console.log(`\n${pass} PASS · ${fail} FAIL · ${blocked} BLOCKED · ${results.length - pass - fail - blocked} SKIP`);
  return fail;
}

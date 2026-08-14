#!/usr/bin/env node
/**
 * CP27 cases 1–3 at the contract layer.
 *
 * These three do not depend on Seller Rules v1 being effective, so they run
 * before midnight. Everything downstream of an application submit does not.
 *
 * Each call carries a real user JWT — aal1 or aal2 — and goes through
 * PostgREST, so `is_admin()` runs exactly as it does for the app. Nothing here
 * uses the service role.
 */
import { readFileSync } from "node:fs";
import { URL as SB, ANON, anonHeaders, sql, REGISTRY } from "./env.mjs";
import { totp } from "./totp.mjs";

const reg = JSON.parse(readFileSync(REGISTRY, "utf8"));
const sec = JSON.parse(readFileSync(REGISTRY.replace("registry.json", "secrets.local.json"), "utf8"));
const uid = (who) => reg.users.find((u) => u.who === who).id;
const mailOf = (who) => reg.users.find((u) => u.who === who).email;

const results = [];
const record = (n, name, verdict, detail) => {
  results.push({ n, name, verdict, detail });
  console.log(`${verdict === "PASS" ? "✅" : "❌"} case ${String(n).padEnd(2)} ${name}\n      ${detail}`);
};

const authFetch = (p, i) => fetch(`${SB}/auth/v1${p}`, i).then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) }));
const bearer = (t) => ({ apikey: ANON, Authorization: `Bearer ${t}`, "Content-Type": "application/json" });
const claims = (jwt) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());

async function session(who, { aal2 = false } = {}) {
  const r = await authFetch("/token?grant_type=password", {
    method: "POST",
    headers: anonHeaders,
    body: JSON.stringify({ email: mailOf(who), password: sec[who] }),
  });
  if (!r.ok) throw new Error(`signin ${who}: ${r.status}`);
  let s = r.body;
  if (aal2) {
    const ch = await authFetch(`/factors/${sec.factorId}/challenge`, { method: "POST", headers: bearer(s.access_token), body: "{}" });
    const v = await authFetch(`/factors/${sec.factorId}/verify`, {
      method: "POST",
      headers: bearer(s.access_token),
      body: JSON.stringify({ challenge_id: ch.body.id, code: totp(sec.totpSecret) }),
    });
    if (!v.ok) throw new Error(`aal2 verify: ${JSON.stringify(v.body).slice(0, 200)}`);
    s = v.body;
  }
  const c = claims(s.access_token);
  return { token: s.access_token, aal: c.aal, sub: c.sub };
}

const rpc = (name, token, body = {}) =>
  fetch(`${SB}/rest/v1/rpc/${name}`, { method: "POST", headers: bearer(token), body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.text() }));

// ─── case 1 — an aal1 admin is not an admin ─────────────────────────────────
{
  const s = await session("admin");
  if (s.aal !== "aal1") throw new Error(`expected aal1, got ${s.aal}`);
  if (s.sub !== uid("admin")) throw new Error("sub mismatch — wrong actor");

  const q = await rpc("product_moderation_queue", s.token, {});
  const isAdmin = await rpc("is_admin", s.token, {});
  const contacts = await rpc("shop_contact_moderation_queue", s.token, {});

  const refused = (r) => r.status >= 400 || /permission|denied|not_admin|aal2|forbidden/i.test(r.body);
  const detail = `aal=${s.aal} · is_admin()=${isAdmin.body.trim()} · product_queue HTTP ${q.status} · contact_queue HTTP ${contacts.status}`;
  if (isAdmin.body.trim() === "false" && refused(q) && refused(contacts)) {
    record(1, "admin at aal1 is refused moderation", "PASS", detail + " — the verified factor makes aal1 not-admin");
  } else {
    record(1, "admin at aal1 is refused moderation", "FAIL", detail);
  }
}

// ─── case 2 — the same account at aal2 gets in ──────────────────────────────
{
  const s = await session("admin", { aal2: true });
  if (s.aal !== "aal2") throw new Error(`expected aal2, got ${s.aal}`);

  const isAdmin = await rpc("is_admin", s.token, {});
  const q = await rpc("product_moderation_queue", s.token, {});
  const contacts = await rpc("shop_contact_moderation_queue", s.token, {});
  const detail = `aal=${s.aal} · is_admin()=${isAdmin.body.trim()} · product_queue HTTP ${q.status} · contact_queue HTTP ${contacts.status}`;
  if (isAdmin.body.trim() === "true" && q.status === 200 && contacts.status === 200) {
    record(2, "admin at aal2 reaches the moderation queues", "PASS", detail);
  } else {
    record(2, "admin at aal2 reaches the moderation queues", "FAIL", detail + ` · ${q.body.slice(0, 160)}`);
  }
}


console.log(`\n${results.filter((r) => r.verdict === "PASS").length}/${results.length} PASS`);
process.exit(results.some((r) => r.verdict === "FAIL") ? 1 : 0);

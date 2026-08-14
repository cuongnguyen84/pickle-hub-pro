#!/usr/bin/env node
/**
 * CP27 step B — synthetic staging accounts, real TOTP, real AAL2.
 *
 * Everything created here carries the `p2b27-<run>` prefix so teardown can find
 * it by name rather than by hoping a script remembered. Ids go to a registry
 * file; passwords and the TOTP secret stay in memory and are never written
 * anywhere, including the registry.
 *
 * No PII: three addresses on example.invalid, which is reserved by RFC 2606 and
 * cannot receive mail.
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { URL as SB, SERVICE, ANON, serviceHeaders, anonHeaders, sql, REGISTRY, mask } from "./env.mjs";
import { totp } from "./totp.mjs";

const RUN = process.argv[2] ?? "r1";
const email = (who) => `p2b27-${who}-${RUN}@example.invalid`;
const pw = () => randomBytes(24).toString("base64url");

const log = (...a) => console.log(...a);

async function auth(path, init = {}) {
  const res = await fetch(`${SB}/auth/v1${path}`, init);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

async function createUser(who) {
  const password = pw();
  const r = await auth("/admin/users", {
    method: "POST",
    headers: serviceHeaders,
    body: JSON.stringify({
      email: email(who),
      password,
      email_confirm: true,
      user_metadata: { full_name: `CP27 ${who} ${RUN}`, cp27_fixture: true },
    }),
  });
  if (!r.ok) throw new Error(`create ${who} failed: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  log(`  created ${who.padEnd(6)} ${email(who)}  id=${r.body.id}`);
  return { who, id: r.body.id, email: email(who), password };
}

async function signIn(user) {
  const r = await auth("/token?grant_type=password", {
    method: "POST",
    headers: anonHeaders,
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  if (!r.ok) throw new Error(`signin ${user.who} failed: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body; // { access_token, refresh_token, ... }
}

const aalOf = (jwt) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).aal;
const subOf = (jwt) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).sub;

// ─── 1. accounts ────────────────────────────────────────────────────────────

log(`CP27 fixture, run ${RUN}`);
const admin = await createUser("admin");
const seller = await createUser("seller");
const buyer = await createUser("buyer");

// ─── 2. roles, by the repo's own convention ─────────────────────────────────
// admin gets `admin` in user_roles. seller and buyer get nothing beyond the
// `viewer` default; the pilot allowlist is a separate table on purpose.

await sql(`
  INSERT INTO public.user_roles (user_id, role) VALUES ('${admin.id}', 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.shop_pilot_members (user_id, note)
  VALUES ('${seller.id}', 'CP27 fixture ${RUN}')
  ON CONFLICT (user_id) DO NOTHING;
`);
log("  roles: admin → user_roles.admin · seller → shop_pilot_members");

const roleCheck = await sql(`
  SELECT (SELECT count(*) FROM public.user_roles WHERE user_id='${admin.id}' AND role='admin') AS admin_role,
         (SELECT count(*) FROM public.user_roles WHERE user_id IN ('${seller.id}','${buyer.id}') AND role <> 'viewer') AS elevated_others,
         (SELECT count(*) FROM public.shop_pilot_members WHERE user_id='${seller.id}') AS seller_pilot,
         (SELECT count(*) FROM public.shop_pilot_members WHERE user_id='${buyer.id}') AS buyer_pilot;
`);
log("  role check:", JSON.stringify(roleCheck.at(-1)));

// ─── 3. admin signs in — must be aal1 before any factor exists ──────────────

const s1 = await signIn(admin);
const aalBefore = aalOf(s1.access_token);
log(`  admin JWT before TOTP:  aal=${aalBefore}  sub=${mask(subOf(s1.access_token))}`);
if (aalBefore !== "aal1") throw new Error(`expected aal1 before enrolment, got ${aalBefore}`);

// ─── 4. enrol a real TOTP factor and answer a real challenge ────────────────

const bearer = (t) => ({ apikey: ANON, Authorization: `Bearer ${t}`, "Content-Type": "application/json" });

const enrol = await auth("/factors", {
  method: "POST",
  headers: bearer(s1.access_token),
  body: JSON.stringify({ factor_type: "totp", friendly_name: `cp27-${RUN}` }),
});
if (!enrol.ok) throw new Error(`enrol failed: ${enrol.status} ${JSON.stringify(enrol.body).slice(0, 300)}`);
const factorId = enrol.body.id;
const secret = enrol.body.totp.secret; // stays in memory only
log(`  TOTP factor enrolled     id=${factorId}  secret=(not printed, ${secret.length} chars)`);

const challenge = await auth(`/factors/${factorId}/challenge`, {
  method: "POST",
  headers: bearer(s1.access_token),
  body: "{}",
});
if (!challenge.ok) throw new Error(`challenge failed: ${JSON.stringify(challenge.body).slice(0, 300)}`);

const verify = await auth(`/factors/${factorId}/verify`, {
  method: "POST",
  headers: bearer(s1.access_token),
  body: JSON.stringify({ challenge_id: challenge.body.id, code: totp(secret) }),
});
if (!verify.ok) throw new Error(`verify failed: ${verify.status} ${JSON.stringify(verify.body).slice(0, 300)}`);

const aalAfter = aalOf(verify.body.access_token);
log(`  admin JWT after verify:  aal=${aalAfter}`);
if (aalAfter !== "aal2") throw new Error(`expected aal2 after verify, got ${aalAfter}`);

const factorState = await sql(
  `SELECT status, factor_type FROM auth.mfa_factors WHERE id = '${factorId}';`,
);
log("  factor row:", JSON.stringify(factorState.at(-1)));

// ─── 5. registry ────────────────────────────────────────────────────────────

const registry = {
  run: RUN,
  prefix: `p2b27-`,
  users: [admin, seller, buyer].map(({ who, id, email }) => ({ who, id, email })),
  adminFactorId: factorId,
  createdAtNote: "timestamps live in the database, not here",
};
writeFileSync(REGISTRY, JSON.stringify(registry, null, 2));
log(`\nregistry → ${REGISTRY}`);

// Secrets are handed to the caller through a separate, process-local file that
// teardown deletes; they are never in the registry and never printed.
writeFileSync(
  REGISTRY.replace("registry.json", "secrets.local.json"),
  JSON.stringify({ run: RUN, admin: admin.password, seller: seller.password, buyer: buyer.password, totpSecret: secret, factorId }),
  { mode: 0o600 },
);
log("secrets → secrets.local.json (0600, deleted by teardown, never committed)");

import { adminClient, anonClient, grantAdminLocally } from "./scripts/qa/seller-qa-kit.mjs";
import { elevateToAal2 } from "./scripts/qa/totp.mjs";

const admin = adminClient();
const email = `aal2-probe-${Date.now().toString(36)}@thepicklehub.test`;
const password = "QaAdmin!2026";
const { data: u, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;
grantAdminLocally(u.user.id);

const c = anonClient();
await c.auth.signInWithPassword({ email, password });

const before = await c.auth.mfa.getAuthenticatorAssuranceLevel();
console.log("before enrol  :", before.data?.currentLevel, "→ next", before.data?.nextLevel);

const { aal, factorId } = await elevateToAal2(c);
console.log("after verify  :", aal, "factor", factorId.slice(0, 8) + "…");

// The real question: does is_admin() now let this session through?
const { data: q, error: qe } = await c.rpc("product_moderation_queue", {
  _status: "pending_review", _shop_id: null, _category_slug: null,
  _cursor_at: null, _cursor_id: null, _limit: 5,
});
console.log("queue RPC     :", qe ? `FAILED ${qe.code} ${qe.message}` : `OK, ${q.rows.length} rows, counts ${JSON.stringify(q.counts)}`);

await admin.auth.admin.deleteUser(u.user.id);
console.log(qe ? "\nFAIL" : "\nPASS — real TOTP, real aal2, real admin RPC");
process.exit(qe ? 1 : 0);

#!/usr/bin/env node
/**
 * Case 3, pre-midnight form: submit is refused while v1 is approved but not yet
 * in force. This branch is only reachable in the hours before 2026-08-14
 * 00:00+07, so it gets asserted now — after midnight the same call fails for a
 * different (and also correct) reason.
 *
 * The draft is created through the seller's own JWT and the RLS insert policy,
 * not through the service role: the point is that the real path stops here.
 */
import { sql } from "./env.mjs";
import { session, rpc, rest, uid, record, summary } from "./lib.mjs";

const s = await session("seller");

// A draft, written by the applicant. Phone is a synthetic 09-prefixed number
// that matches the CHECK and belongs to nobody.
const draft = await rest("/shop_applications", s.token, {
  method: "POST",
  headers: { Prefer: "return=representation" },
  body: JSON.stringify({
    applicant_user_id: uid("seller"),
    status: "draft",
    seller_type: "ca-nhan",
    full_name: "CP27 Seller Fixture",
    phone: "0900000000",
    shop_name: "CP27 Vot Shop",
    shop_intro: "Fixture shop for closed-pilot acceptance. Not a real business.",
    pickup_address: "So 1 Duong Fixture, Phuong Test",
    city: "Ha Noi",
  }),
});

if (draft.status !== 201) {
  record("3-pre", "draft insert through the applicant's own RLS policy", "FAIL", `HTTP ${draft.status} ${draft.text.slice(0, 200)}`);
  process.exit(summary() ? 1 : 0);
}
const appId = draft.json[0].id;
record("3-pre.a", "applicant can create their own draft", "PASS", `application ${appId} status=${draft.json[0].status}`);

const legal = (await sql(`SELECT (effective_at <= now()) AS eff, effective_at FROM public.legal_documents WHERE document_key='seller-rules';`)).at(-1);
const submit = await rpc("shop_application_submit", s.token, { _expected_rules_version: "v1" });

const detail = `effective_now=${legal.eff} · submit HTTP ${submit.status} · ${submit.body.slice(0, 160)}`;
if (!legal.eff && /seller_rules_not_published/.test(submit.body)) {
  record("3-pre.b", "submit refused: v1 approved but not yet in force", "PASS", detail);
} else if (!legal.eff) {
  record("3-pre.b", "submit refused: v1 approved but not yet in force", "FAIL", detail);
} else {
  record("3-pre.b", "v1 already in force — this pre-midnight branch no longer reachable", "SKIP", detail);
}

// Nothing may have been written by a refused submit.
const after = (await sql(`
  SELECT status::text, submitted_at IS NULL AS not_submitted,
         (SELECT count(*) FROM public.legal_acceptances WHERE user_id = '${uid("seller")}') AS acceptances
  FROM public.shop_applications WHERE id = '${appId}';`)).at(-1);
if (after.status === "draft" && after.not_submitted && Number(after.acceptances) === 0) {
  record("3-pre.c", "a refused submit leaves no trace", "PASS", `status=${after.status} submitted_at=null acceptances=${after.acceptances}`);
} else {
  record("3-pre.c", "a refused submit leaves no trace", "FAIL", JSON.stringify(after));
}

process.exit(summary() ? 1 : 0);

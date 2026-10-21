#!/usr/bin/env node
/**
 * CP27 cases 4–11: the application chain, at the contract layer.
 *
 * Every call is a real user JWT through PostgREST. The admin calls are made at
 * aal2 because that is the only level `is_admin()` accepts once a factor is
 * verified — the aal1 refusal is case 1 and is asserted separately.
 *
 * State is read back from the database after each step rather than trusted from
 * the RPC's return value: this project has been bitten by functions that
 * reported success over a no-op.
 */
import { sql } from "./env.mjs";
import { session, rpc, rest, uid, record, summary, reg } from "./lib.mjs";
import { writeFileSync } from "node:fs";

const seller = await session("seller");
const admin = await session("admin", { aal2: true });
const state = {};

const one = (rows) => rows.at(-1);
const j = (r) => { try { return JSON.parse(r.body); } catch { return null; } };

// ─── the document under test ────────────────────────────────────────────────
const doc = one(await sql(`
  SELECT version, content_hash, (effective_at <= now()) AS effective
  FROM public.legal_documents WHERE document_key = 'seller-rules';`));
if (!doc.effective) {
  record("4-11", "Seller Rules v1 is not in force yet", "SKIP", `effective=false — rerun after 2026-08-14T00:00+07`);
  process.exit(summary() ? 1 : 0);
}

const appRow = one(await sql(`
  SELECT id::text FROM public.shop_applications WHERE applicant_user_id = '${uid("seller")}' ORDER BY created_at DESC LIMIT 1;`));
state.applicationId = appRow.id;

// ─── case 3 (acceptance-gate form) — submit without accepting is refused ────
{
  const before = one(await sql(`SELECT count(*)::int AS n FROM public.legal_acceptances WHERE user_id='${uid("seller")}';`));
  const r = await rpc("shop_application_submit", seller.token, { _expected_rules_version: "v1" });
  const after = one(await sql(`
    SELECT (SELECT count(*)::int FROM public.legal_acceptances WHERE user_id='${uid("seller")}') AS n,
           (SELECT status::text FROM public.shop_applications WHERE id='${state.applicationId}') AS status;`));
  const refused = r.status >= 400 && /rules|accept/i.test(r.body);
  record(3, "submit is refused before the seller has accepted v1", refused && after.status === "draft" ? "PASS" : "FAIL",
    `HTTP ${r.status} ${r.body.slice(0, 120)} · status=${after.status} · acceptances ${before.n}→${after.n}`);
}

// ─── case 4 — accept, and the receipt says what was signed ──────────────────
{
  const full = one(await sql(`SELECT octet_length(body) AS bytes FROM public.legal_documents WHERE document_key='seller-rules';`));
  const accept = await rpc("legal_accept", seller.token, {
    _document_key: "seller-rules", _version: "v1", _content_hash: doc.content_hash,
  });
  const row = one(await sql(`
    SELECT version, content_hash, accepted_at IS NOT NULL AS stamped,
           user_id::text, application_id::text
    FROM public.legal_acceptances WHERE user_id = '${uid("seller")}' ORDER BY accepted_at DESC LIMIT 1;`));
  const ok = accept.status === 200
    && row.version === "v1"
    && row.content_hash === doc.content_hash
    && row.stamped
    && row.user_id === uid("seller");
  record(4, "seller accepts v1 and the receipt carries version, hash, time and user", ok ? "PASS" : "FAIL",
    `full text ${full.bytes} bytes · HTTP ${accept.status} · version=${row.version} hash=${row.content_hash.slice(0, 12)}… stamped=${row.stamped} user=${row.user_id === uid("seller") ? "seller" : row.user_id} app=${row.application_id ?? "null"}`);

  // A wrong hash must not be accepted — the receipt is only worth the check.
  const bad = await rpc("legal_accept", seller.token, {
    _document_key: "seller-rules", _version: "v1", _content_hash: "0".repeat(64),
  });
  record("4b", "an acceptance quoting the wrong hash is refused", bad.status >= 400 ? "PASS" : "FAIL",
    `HTTP ${bad.status} ${bad.body.slice(0, 120)}`);
}

// ─── case 5 — submit succeeds now ───────────────────────────────────────────
{
  const r = await rpc("shop_application_submit", seller.token, { _expected_rules_version: "v1" });
  const row = one(await sql(`
    SELECT status::text, submitted_at IS NOT NULL AS submitted
    FROM public.shop_applications WHERE id='${state.applicationId}';`));
  record(5, "submit succeeds once v1 is in force and accepted", r.status === 200 && row.status === "submitted" && row.submitted ? "PASS" : "FAIL",
    `HTTP ${r.status} ${r.body.slice(0, 80)} · status=${row.status} submitted_at set=${row.submitted}`);

  const receipt = await rpc("shop_application_rules_receipt", admin.token, { _application_id: state.applicationId });
  const rj = j(receipt);
  record("5b", "the moderator's receipt answers 'did they sign what is in force'", receipt.status === 200 && rj && rj.version === "v1" ? "PASS" : "FAIL",
    `HTTP ${receipt.status} ${JSON.stringify(rj).slice(0, 200)}`);
}

// ─── case 6 — request changes ───────────────────────────────────────────────
{
  const r = await rpc("shop_application_decide", admin.token, {
    _application_id: state.applicationId,
    _decision: "request_changes",
    _applicant_note: "Vui lòng bổ sung ảnh mặt tiền và số điện thoại liên hệ.",
    _internal_note: "CP27 internal only — must never reach the applicant.",
    _requested_fields: ["shop_intro", "pickup_address"],
  });
  const row = one(await sql(`
    SELECT status::text, applicant_note, internal_note, requested_fields::text
    FROM public.shop_applications WHERE id='${state.applicationId}';`));
  record(6, "request-changes carries structured targets and a public note",
    r.status === 200 && row.status === "needs_changes" && row.applicant_note && row.requested_fields.includes("shop_intro") ? "PASS" : "FAIL",
    `HTTP ${r.status} · status=${row.status} · fields=${row.requested_fields} · public note ${row.applicant_note ? "set" : "MISSING"}`);

  // A decision with no public note must be refused: "sửa lại hồ sơ" with no
  // reason is the failure mode this field exists to prevent.
  const noNote = await rpc("shop_application_decide", admin.token, {
    _application_id: state.applicationId, _decision: "request_changes", _requested_fields: ["city"],
  });
  record("6b", "request-changes without a public note is refused", noNote.status >= 400 ? "PASS" : "FAIL",
    `HTTP ${noNote.status} ${noNote.body.slice(0, 120)}`);

  // The applicant must not be able to read internal_note.
  const asSeller = await rest(`/shop_applications?id=eq.${state.applicationId}&select=*`, seller.token);
  const leaked = /CP27 internal only/.test(asSeller.text);
  record("6c", "internal_note is not readable by the applicant", !leaked ? "PASS" : "FAIL",
    `HTTP ${asSeller.status} · internal note present in applicant read: ${leaked}`);
}

// ─── case 9 — fix and resubmit, draft data survives ─────────────────────────
{
  const patch = await rest(`/shop_applications?id=eq.${state.applicationId}`, seller.token, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ shop_intro: "Shop bán vợt và phụ kiện pickleball (fixture CP27).", pickup_address: "So 1 Duong Fixture, Phuong Test, Ha Noi" }),
  });
  const resubmit = await rpc("shop_application_submit", seller.token, { _expected_rules_version: "v1" });
  const row = one(await sql(`
    SELECT status::text, shop_name, city, shop_intro IS NOT NULL AS intro_set
    FROM public.shop_applications WHERE id='${state.applicationId}';`));
  record(9, "seller fixes the named fields and resubmits without losing draft data",
    patch.status < 300 && resubmit.status === 200 && row.status === "submitted" && row.shop_name === "CP27 Vot Shop" && row.city === "Ha Noi" ? "PASS" : "FAIL",
    `patch HTTP ${patch.status} · resubmit HTTP ${resubmit.status} · status=${row.status} · shop_name/city preserved=${row.shop_name === "CP27 Vot Shop" && row.city === "Ha Noi"}`);
}

// ─── case 10 — approve, and a replay does not make a second shop ────────────
{
  const r1 = await rpc("shop_application_decide", admin.token, {
    _application_id: state.applicationId, _decision: "approve", _applicant_note: "Hồ sơ hợp lệ. Chúc anh/chị bán tốt.",
  });
  const after1 = one(await sql(`
    SELECT (SELECT count(*)::int FROM public.shops WHERE owner_user_id='${uid("seller")}') AS shops,
           (SELECT count(*)::int FROM public.shop_members m JOIN public.shops s ON s.id=m.shop_id
             WHERE s.owner_user_id='${uid("seller")}' AND m.user_id='${uid("seller")}' AND m.role='owner') AS owner_rows,
           (SELECT status::text FROM public.shop_applications WHERE id='${state.applicationId}') AS status;`));

  const r2 = await rpc("shop_application_decide", admin.token, {
    _application_id: state.applicationId, _decision: "approve", _applicant_note: "replay",
  });
  const after2 = one(await sql(`SELECT count(*)::int AS shops FROM public.shops WHERE owner_user_id='${uid("seller")}';`));

  const shop = one(await sql(`SELECT id::text, slug, state::text, version FROM public.shops WHERE owner_user_id='${uid("seller")}' LIMIT 1;`));
  state.shopId = shop?.id;
  state.shopSlug = shop?.slug;

  record(10, "approval creates shop + owner membership once; a replay creates nothing",
    r1.status === 200 && after1.shops === 1 && after1.owner_rows === 1 && after2.shops === 1 ? "PASS" : "FAIL",
    `HTTP ${r1.status} · shops=${after1.shops} owner_member=${after1.owner_rows} app=${after1.status} · replay HTTP ${r2.status} → shops=${after2.shops} · shop=${shop?.slug} state=${shop?.state}`);
}

// ─── case 11 — profile, slug and contact lifecycle ──────────────────────────
{
  const v = one(await sql(`SELECT version FROM public.shops WHERE id='${state.shopId}';`)).version;
  const upd = await rpc("shop_profile_update", seller.token, {
    _shop_id: state.shopId,
    _expected_version: v,
    _patch: {
      name: "CP27 Vot Shop",
      region: "Ha Noi",
      shipping_note: "Giao trong 2-3 ngày, phí theo hãng vận chuyển.",
      return_note: "Đổi trả trong 7 ngày nếu lỗi nhà sản xuất.",
      intro: "Fixture shop cho nghiệm thu closed pilot.",
    },
  });
  const slugRes = await rpc("shop_slug_update", seller.token, { _shop_id: state.shopId, _slug: "cp27-vot-shop" });
  const contact = await rpc("shop_contact_upsert", seller.token, {
    _shop_id: state.shopId, _type: "zalo", _value: "0900000000", _label: "Zalo shop", _is_public: true,
  });
  const cj = j(contact);
  state.contactId = cj?.id;

  const row = one(await sql(`
    SELECT slug, region, shipping_note IS NOT NULL AS ship, return_note IS NOT NULL AS ret,
           (SELECT status::text FROM public.shop_contact_channels WHERE shop_id='${state.shopId}' LIMIT 1) AS contact_status
    FROM public.shops WHERE id='${state.shopId}';`));

  record(11, "seller updates name/slug/region/shipping/return and adds a contact for review",
    upd.status === 200 && slugRes.status < 300 && contact.status === 200 && row.slug === "cp27-vot-shop" && row.ship && row.ret ? "PASS" : "FAIL",
    `profile HTTP ${upd.status} · slug HTTP ${slugRes.status} → ${row.slug} · region=${row.region} · shipping=${row.ship} return=${row.ret} · contact HTTP ${contact.status} status=${row.contact_status}`);

  record("11b", "a new contact channel does not go public before a moderator sees it",
    row.contact_status && row.contact_status !== "approved" ? "PASS" : "FAIL",
    `contact status=${row.contact_status}`);
}

writeFileSync("/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/state.json", JSON.stringify({ ...reg, ...state }, null, 2));
console.log(`\nstate → state.json  application=${state.applicationId} shop=${state.shopId} slug=${state.shopSlug}`);
process.exit(summary() ? 1 : 0);

#!/usr/bin/env node
/**
 * CP27 cases 9–11 — resubmit, approval, and the shop profile.
 * Runs after cases 7 and 8 have looked at the `needs_changes` screen.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { sql } from "./env.mjs";
import { session, rpc, uid, record, summary } from "./lib.mjs";

const STATE = "/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/state.json";
const state = JSON.parse(readFileSync(STATE, "utf8"));
const seller = await session("seller");
const admin = await session("admin", { aal2: true });

const one = (r) => r.at(-1);
const j = (r) => { try { return JSON.parse(r.body); } catch { return null; } };

// ─── case 9 — fix and resubmit, draft data survives ─────────────────────────
{
  const patchRes = await fetch(
    `https://utokwfcljxjkpkaqgheo.supabase.co/rest/v1/shop_applications?id=eq.${state.applicationId}`,
    {
      method: "PATCH",
      headers: {
        apikey: (await import("./env.mjs")).ANON,
        Authorization: `Bearer ${seller.token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal", // mirror useSaveApplicationDraft — representation needs SELECT on every column, and internal_note is revoked (20260814140000)
      },
      body: JSON.stringify({
        shop_intro: "Shop bán vợt và phụ kiện pickleball (fixture CP27).",
        pickup_address: "So 1 Duong Fixture, Phuong Test, Ha Noi",
      }),
    },
  );
  const resubmit = await rpc("shop_application_submit", seller.token, { _expected_rules_version: "v1" });
  const row = one(await sql(`
    SELECT status::text, shop_name, city, shop_intro IS NOT NULL AS intro_set, seller_type
    FROM public.shop_applications WHERE id='${state.applicationId}';`));
  record(9, "seller fixes the named fields and resubmits without losing draft data",
    patchRes.status < 300 && resubmit.status === 200 && row.status === "submitted" && row.intro_set
      && row.shop_name === "CP27 Vot Shop" && row.city === "Ha Noi" && row.seller_type === "ca-nhan" ? "PASS" : "FAIL",
    `patch HTTP ${patchRes.status} · resubmit HTTP ${resubmit.status} · status=${row.status} · untouched fields kept: shop_name=${row.shop_name === "CP27 Vot Shop"}, city=${row.city === "Ha Noi"}, seller_type=${row.seller_type === "ca-nhan"}`);
}

// ─── case 10 — approve once; a replay must not make a second shop ───────────
{
  const r1 = await rpc("shop_application_decide", admin.token, {
    _application_id: state.applicationId, _decision: "approve", _applicant_note: "Hồ sơ hợp lệ.",
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
  writeFileSync(STATE, JSON.stringify(state, null, 2));

  record(10, "approval creates shop + owner membership in one go; a replay creates nothing",
    r1.status === 200 && after1.shops === 1 && after1.owner_rows === 1 && after2.shops === 1 ? "PASS" : "FAIL",
    `HTTP ${r1.status} · shops=${after1.shops} owner_member=${after1.owner_rows} app=${after1.status} · replay HTTP ${r2.status} → shops=${after2.shops} · slug=${shop?.slug} state=${shop?.state}`);
}

// ─── case 11 — profile, slug, and the contact lifecycle ─────────────────────
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
  writeFileSync(STATE, JSON.stringify(state, null, 2));

  const row = one(await sql(`
    SELECT slug, region, shipping_note IS NOT NULL AS ship, return_note IS NOT NULL AS ret,
           (SELECT state::text FROM public.shop_contact_channels WHERE shop_id='${state.shopId}' LIMIT 1) AS contact_status
    FROM public.shops WHERE id='${state.shopId}';`));
  if (row.slug) { state.shopSlug = row.slug; writeFileSync(STATE, JSON.stringify(state, null, 2)); }

  record(11, "seller updates name/slug/region/shipping/return and adds a contact",
    upd.status === 200 && slugRes.status < 300 && contact.status === 200 && row.ship && row.ret ? "PASS" : "FAIL",
    `profile HTTP ${upd.status} · slug HTTP ${slugRes.status} → ${row.slug} · region=${row.region} · shipping=${row.ship} return=${row.ret} · contact HTTP ${contact.status} status=${row.contact_status}`);

  record("11b", "a new contact channel is not public before a moderator approves it",
    row.contact_status && row.contact_status !== "approved" ? "PASS" : "FAIL",
    `contact status=${row.contact_status}`);

  const decide = await rpc("shop_contact_decide", admin.token, {
    _id: state.contactId, _decision: "approve", _note: "Kênh hợp lệ.", _client_token: `${state.run ?? "r1"}-c11`,
  });
  const post = one(await sql(`SELECT state::text AS status FROM public.shop_contact_channels WHERE id='${state.contactId}';`));
  record("11c", "an approved contact becomes usable", decide.status < 300 && post.status === "approved" ? "PASS" : "FAIL",
    `decide HTTP ${decide.status} → status=${post?.status}`);
}

process.exit(summary() ? 1 : 0);

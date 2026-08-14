#!/usr/bin/env node
/**
 * CP27 case 18 — a shop owner cannot delete their own account.
 *
 * B12, decision C: the server refuses BEFORE the first cleanup step, with a 409
 * naming the reason, so nothing is half-deleted and the applicant is told what
 * to do instead. The UI half matters as much as the status code: an owner must
 * not see a DELETE confirmation box that cannot work.
 */
import { readFileSync } from "node:fs";
import { URL as SB, ANON, sql } from "./env.mjs";
import { session, record, summary, uid } from "./lib.mjs";
import { launch, close, actor, assertIdentity } from "./browser.mjs";

const state = JSON.parse(readFileSync(process.env.CP27_STATE ?? "/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/state.json", "utf8"));
const one = (r) => r.at(-1);

const call = async (token) => {
  const r = await fetch(`${SB}/functions/v1/delete-account`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return { status: r.status, body: await r.text() };
};

// ─── the owner is refused, and nothing is touched ───────────────────────────
{
  const seller = await session("seller");
  const before = one(await sql(`
    SELECT (SELECT count(*)::int FROM public.shops WHERE owner_user_id='${uid("seller")}') AS shops,
           (SELECT count(*)::int FROM auth.users WHERE id='${uid("seller")}') AS user_row,
           (SELECT count(*)::int FROM public.products WHERE shop_id='${state.shopId}') AS products;`));

  const r1 = await call(seller.token);
  const r2 = await call(seller.token); // replay must be identical, no side effect

  const after = one(await sql(`
    SELECT (SELECT count(*)::int FROM public.shops WHERE owner_user_id='${uid("seller")}') AS shops,
           (SELECT count(*)::int FROM auth.users WHERE id='${uid("seller")}') AS user_row,
           (SELECT count(*)::int FROM public.products WHERE shop_id='${state.shopId}') AS products;`));

  const named = /shop_owner_offboarding_required/.test(r1.body);
  const hasContext = /shop_count/.test(r1.body) && /contact_email/.test(r1.body);
  const unchanged = before.shops === after.shops && before.user_row === after.user_row && before.products === after.products;

  record(18, "a shop owner is refused with 409 before any cleanup runs",
    r1.status === 409 && named && hasContext && unchanged ? "PASS" : "FAIL",
    `HTTP ${r1.status} · ${r1.body.slice(0, 180)} · replay HTTP ${r2.status} · shops ${before.shops}→${after.shops}, user ${before.user_row}→${after.user_row}, products ${before.products}→${after.products}`);
}

// ─── a non-owner is not affected by the new gate ────────────────────────────
// This probe account is created and consumed here rather than reusing the buyer
// fixture: a passing run DELETES the account, so borrowing the buyer would make
// the suite un-rerunnable and would quietly remove an actor later phases use.
{
  const { randomBytes } = await import("node:crypto");
  const { serviceHeaders, anonHeaders } = await import("./env.mjs");
  const email = `p2b27-nonowner-${state.run}-${randomBytes(3).toString("hex")}@example.invalid`;
  const password = randomBytes(24).toString("base64url");

  const made = await fetch(`${SB}/auth/v1/admin/users`, {
    method: "POST", headers: serviceHeaders,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { cp27_fixture: true } }),
  });
  const probe = await made.json();
  const signed = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: anonHeaders, body: JSON.stringify({ email, password }),
  }).then((x) => x.json());

  const r = await call(signed.access_token);
  const stillThere = one(await sql(`SELECT count(*)::int AS n FROM auth.users WHERE id='${probe.id}';`));

  // The non-owner path must NOT be refused for shop reasons. Whether it
  // completes is a separate matter — B14 is deliberately unfixed and the
  // response carries its warnings. What this asserts is that the new block is
  // not catching people it was never aimed at.
  record("18b", "a non-owner is not caught by the shop gate",
    made.status < 300 && !/shop_owner_offboarding_required/.test(r.body) ? "PASS" : "FAIL",
    `HTTP ${r.status} · ${r.body.slice(0, 150)} · probe account row after=${stillThere.n}`);

  if (stillThere.n > 0) {
    await fetch(`${SB}/auth/v1/admin/users/${probe.id}`, { method: "DELETE", headers: serviceHeaders });
  }
}

// ─── the owner's screen does not offer a door that cannot open ──────────────
{
  await launch();
  const a = await actor("seller");
  await assertIdentity(a);
  await a.goto("/account");
  await a.page.waitForTimeout(3500);
  // The copy lives inside the confirmation dialog, so it has to be opened —
  // reading the page behind it would report "no DELETE box" for a dialog that
  // was simply never rendered.
  const trigger = a.page.getByRole("button", { name: /xoá tài khoản|xóa tài khoản|delete account/i }).first();
  if (await trigger.count()) {
    await trigger.click();
    await a.page.waitForTimeout(1500);
  }
  const text = (await a.page.locator("body").innerText()).replace(/\s+/g, " ");
  const hasDeleteBox = await a.page.evaluate(() =>
    [...document.querySelectorAll("input")].some((i) => /DELETE/i.test(i.getAttribute("placeholder") ?? "")));
  const explains = /chủ shop|bàn giao|offboard|liên hệ|email/i.test(text);
  const saysNotAutomatic = /chỉ mở ứng dụng email|không tự gửi|KHÔNG tự gửi/i.test(text);
  const claimsSuccess = /đã xoá tài khoản|xoá thành công/i.test(text);
  await close();

  record("18c", "the owner sees an explanation, not a DELETE box, and no false success",
    !hasDeleteBox && explains && !claimsSuccess ? "PASS" : "FAIL",
    `DELETE input present=${hasDeleteBox} · explains ownership=${explains} · says the button only opens email=${saysNotAutomatic} · claims success=${claimsSuccess}`);
}

process.exit(summary() ? 1 : 0);

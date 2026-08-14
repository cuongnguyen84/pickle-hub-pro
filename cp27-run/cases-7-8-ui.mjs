#!/usr/bin/env node
/**
 * CP27 cases 7 and 8 — what the seller is told, and whether the link works.
 *
 * Run while the application is in `needs_changes` with two named fields. Case 7
 * is "the status screen names the fields the moderator asked about"; case 8 is
 * "the deep link opens the right step AND actually moves focus" — a link that
 * scrolls but leaves focus at the top is the bug this project has already
 * shipped once, on the VI anchors.
 */
import { readFileSync } from "node:fs";
import { sql } from "./env.mjs";
import { launch, close, actor, assertIdentity } from "./browser.mjs";
import { record, summary, uid } from "./lib.mjs";

const state = JSON.parse(readFileSync("/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/state.json", "utf8"));
const one = (r) => r.at(-1);

const app = one(await sql(`
  SELECT status::text, applicant_note, requested_fields::text
  FROM public.shop_applications WHERE id='${state.applicationId}';`));

if (app.status !== "needs_changes") {
  record("7-8", "application is not in needs_changes", "SKIP", `status=${app.status} — run this between case 6 and case 9`);
  process.exit(summary() ? 1 : 0);
}

await launch();
const a = await actor("seller");
await assertIdentity(a);

// ─── case 7 ─────────────────────────────────────────────────────────────────
await a.goto("/seller/application/status");
await a.page.waitForTimeout(3500);
const status = (await a.page.locator("body").innerText()).replace(/\s+/g, " ");

const showsNote = status.includes("bổ sung") || status.includes("Bổ sung");
const namesFields = /giới thiệu|mô tả shop|intro/i.test(status) && /địa chỉ|lấy hàng|pickup/i.test(status);
const leaksInternal = /CP27 internal/i.test(status);
record(7, "the status screen names the fields the moderator asked about",
  showsNote && namesFields && !leaksInternal ? "PASS" : "FAIL",
  `requested_fields=${app.requested_fields} · public note shown=${showsNote} · both fields named=${namesFields} · internal note leaked=${leaksInternal}`);

// ─── case 8 ─────────────────────────────────────────────────────────────────
// The PER-FIELD deep link, not the generic "Sửa hồ sơ" button: the status
// screen renders one link per requested field carrying ?step=N&focus=<field>
// (applicationDeepLink). The first revision of this case matched the generic
// edit link by its text, which lands on the form with no focus target and
// reported the deep link broken while never having clicked it.
const link = a.page.locator('a[href*="/seller/application?"][href*="focus="]').first();
const href = (await link.count()) ? await link.getAttribute("href") : null;
const expectedField = href?.match(/focus=([a-z_-]+)/)?.[1] ?? null;

let focusInfo = null;
if (href) {
  await link.click();
  await a.page.waitForTimeout(3500);
  focusInfo = await a.page.evaluate(() => {
    const el = document.activeElement;
    const inMain = !!el?.closest("main");
    const named = el?.getAttribute("name") ?? el?.id ?? el?.getAttribute("aria-label") ?? "";
    const step = document.body.innerText.match(/Bước\s*(\d)\s*\/\s*6/)?.[1] ?? null;
    return { tag: el?.tagName ?? "none", named, inMain, step, isBody: el === document.body };
  });
}

const focusedSomething = focusInfo && !focusInfo.isBody && focusInfo.tag !== "none";
const focusedTheField = focusedSomething && expectedField && focusInfo.named === expectedField;
record(8, "the deep link opens the right step and moves focus into the named field",
  href && focusedTheField && focusInfo.inMain ? "PASS" : "FAIL",
  href
    ? `href=${href} · step shown=${focusInfo?.step} · focus=${focusInfo?.tag}${focusInfo?.named ? `[${focusInfo.named}]` : ""} expected [${expectedField}] · inside <main>=${focusInfo?.inMain}`
    : "no per-field deep link offered on the status screen");

await close();
process.exit(summary() ? 1 : 0);

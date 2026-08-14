#!/usr/bin/env node
// Cases 1 and 2 at the screen, not just at the RPC. AdminMFAGate is the thing
// under test here; nothing about it is stubbed or disabled.
import { launch, close, actor, assertIdentity } from "./browser.mjs";
import { record, summary } from "./lib.mjs";

await launch();

const ROUTES = ["/admin/shop/applications", "/admin/shop/products", "/admin/shop/contacts"];

for (const [label, aal2] of [["aal1", false], ["aal2", true]]) {
  const a = await actor("admin", { aal2 });
  const id = await assertIdentity(a);
  const seen = [];
  for (const route of ROUTES) {
    await a.goto(route);
    // Wait for the destination to actually settle. A fixed sleep measured the
    // PREVIOUS page once and reported the buyer catalogue as an admin queue —
    // the SPA had not finished the route change yet.
    await a.page
      .waitForFunction(
        () => {
          const t = document.body.innerText;
          return /Xác thực 2 yếu tố/.test(t) || /Hồ sơ|Sản phẩm chờ|Kênh liên hệ|Không có|trống/i.test(t);
        },
        null,
        { timeout: 20000 },
      )
      .catch(() => {});
    await a.page.waitForTimeout(1500);
    const text = (await a.page.locator("body").innerText()).replace(/\s+/g, " ");
    // The gate's actual copy on this build. Matched literally rather than by a
    // guess at wording — the first version of this check invented phrases the
    // product never says and reported a passing gate as a failure.
    const gated = /Xác thực 2 yếu tố/i.test(text) && /app authenticator/i.test(text);
    const denied = /không có quyền|forbidden|403/i.test(text) || new URL(a.page.url()).pathname === "/login";
    // Whatever the moderation screen itself renders. If the gate is up, none of
    // this may be on the page — a gate that leaves the queue mounted behind it
    // is not a gate.
    const moderationUi = /hồ sơ|đơn|queue|duyệt|kiểm duyệt|liên hệ|sản phẩm/i.test(text) && text.length > 400;
    seen.push({ route, url: new URL(a.page.url()).pathname, gated, denied, moderationUi, chars: text.length });
  }
  await a.ctx.close();

  if (label === "aal1") {
    const blocked = seen.every((s) => (s.gated || s.denied) && !s.moderationUi);
    record("1-ui", "admin at aal1 gets the TOTP gate instead of a moderation screen", blocked ? "PASS" : "FAIL",
      `aal=${id.aal} · ` + seen.map((s) => `${s.route}${s.gated ? " [MFA gate]" : ""}${s.denied ? " [denied]" : ""}${s.moderationUi ? " ⚠queue rendered" : ""} ${s.chars}ch`).join(" · "));
  } else {
    const through = seen.every((s) => s.url === s.route && !s.gated && !s.denied && s.moderationUi);
    record("2-ui", "admin at aal2 reaches every moderation screen", through ? "PASS" : "FAIL",
      `aal=${id.aal} · ` + seen.map((s) => `${s.route}→${s.url} ${s.chars}ch${s.moderationUi ? "" : " ⚠no queue ui"}`).join(" · "));
  }
}

await close();
process.exit(summary() ? 1 : 0);

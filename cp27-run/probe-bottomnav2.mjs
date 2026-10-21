import { launch, close, actor } from "./browser.mjs";
await launch();
for (const [who, route] of [["anon", "/shop"], ["seller", "/seller/products"], ["admin", "/admin/shop/products"]]) {
  const a = await actor(who, { aal2: who === "admin", viewport: { width: 390, height: 900 } });
  await a.goto(route);
  await a.page.waitForTimeout(3000);
  const n = await a.page.evaluate(() =>
    document.querySelectorAll('nav[aria-label="Primary mobile navigation"]').length);
  const fab = await a.page.evaluate(() =>
    [...document.querySelectorAll("button, a")].filter((e) => /chat|nhắn tin/i.test(e.getAttribute("aria-label") ?? "")).length);
  console.log(`${who.padEnd(6)} ${route.padEnd(24)} buyer BottomNav=${n}  chatFAB=${fab}`);
  await a.ctx.close();
}
await close();

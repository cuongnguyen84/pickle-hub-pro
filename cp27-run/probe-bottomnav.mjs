import { launch, close, actor } from "./browser.mjs";
await launch();
for (const [who, route] of [["seller", "/seller/products"], ["anon", "/shop"], ["anon", "/tools"]]) {
  const a = await actor(who, { viewport: { width: 390, height: 900 } });
  await a.goto(route);
  await a.page.waitForTimeout(3000);
  const info = await a.page.evaluate(() => {
    const hits = [...document.querySelectorAll('[data-bottom-nav], nav[aria-label*="Điều hướng"], .tl-bottom-nav')];
    return hits.map((el) => ({
      tag: el.tagName,
      cls: String(el.className).slice(0, 60),
      label: el.getAttribute("aria-label"),
      text: el.innerText.replace(/\s+/g, " ").slice(0, 90),
      bottom: getComputedStyle(el).position,
    }));
  });
  console.log(`\n${who} ${route}: ${info.length} match(es)`);
  for (const h of info) console.log("   ", JSON.stringify(h));
  await a.ctx.close();
}
await close();

import { chromium } from "@playwright/test";
const b = await chromium.launch();
for (const sw of ["allow", "block"]) {
  const ctx = await b.newContext({ serviceWorkers: sw });
  const p = await ctx.newPage();
  const t0 = Date.now();
  try {
    await p.goto("https://thepicklehub-shop-staging.pages.dev/shop", { waitUntil: "domcontentloaded", timeout: 20000 });
    console.log(sw, "ok", Date.now() - t0, "ms");
  } catch (e) { console.log(sw, "FAIL", e.message.slice(0, 80)); }
  await ctx.close();
}
await b.close();

import { launch, close, actor } from "./browser.mjs";
await launch();
const a = await actor("admin", { aal2: false });
await a.goto("/admin/shop/applications");
for (const ms of [1000, 2500, 4000, 6000]) {
  await a.page.waitForTimeout(ms === 1000 ? 1000 : ms - (ms === 2500 ? 1000 : ms === 4000 ? 2500 : 4000));
  const t = (await a.page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log(`\n=== t=${ms}ms  ${t.length} chars ===\n${t.slice(0, 700)}`);
}
await close();

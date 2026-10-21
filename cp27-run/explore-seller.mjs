import { launch, close, actor, assertIdentity } from "./browser.mjs";
await launch();
const a = await actor("seller");
console.log("identity:", JSON.stringify(await assertIdentity(a)));
for (const r of ["/seller", "/seller/application", "/seller/application/status", "/seller/products", "/seller/settings"]) {
  await a.goto(r);
  await a.page.waitForTimeout(3000);
  const t = (await a.page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log(`\n=== ${r} → ${new URL(a.page.url()).pathname}  ${t.length} chars ===\n${t.slice(0, 600)}`);
}
await close();

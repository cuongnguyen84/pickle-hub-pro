import { readFileSync } from "node:fs";
import { URL as SB, ANON } from "./env.mjs";
const state = JSON.parse(readFileSync(process.env.CP27_STATE, "utf8"));
const r = await fetch(`${SB}/rest/v1/rpc/shop_public_product`, {
  method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ _slug: state.productSlug }),
});
const t = await r.text();
const m = [...t.matchAll(/"stock_on_hand"\s*:\s*([^,}]+)/g)].map((x) => x[1]);
console.log("occurrences of stock_on_hand:", m.length, "values:", m.join(", "));
console.log("real quantity present:", /"stock_on_hand"\s*:\s*-?\d/.test(t));
console.log(t.slice(0, 600));

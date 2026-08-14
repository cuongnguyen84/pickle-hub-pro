import { URL as SB, ANON } from "./env.mjs";
for (const slug of ["cp27-khong-ton-tai", "vot-pickleball-cp27-pro"]) {
  const r = await fetch(`${SB}/rest/v1/rpc/shop_public_product`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ _slug: slug }),
  });
  const t = await r.text();
  console.log(`${slug}: HTTP ${r.status} len=${t.length}\n   ${t.slice(0, 300)}\n`);
}

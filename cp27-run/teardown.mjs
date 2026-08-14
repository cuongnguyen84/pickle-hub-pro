#!/usr/bin/env node
/**
 * CP27 teardown — and then the count that decides whether it worked.
 *
 * Teardown in this project has reported "clean" over uncleaned rows six times,
 * so nothing here trusts a delete's own return value. Storage goes first
 * (`storage.objects` refuses a direct DELETE, so it goes through the Storage
 * API with the service role), then the rows, then the accounts — and the
 * accounts last, because most of the tables hang off them by CASCADE and a
 * cascade that fires early hides what did not get deleted.
 *
 * Explicitly NOT touched: Seller Rules v1, the migration ledger, cron
 * definitions, Vault secrets, and the pre-existing system+pro-tour user.
 */
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { URL as SB, SERVICE, serviceHeaders, sql, REGISTRY } from "./env.mjs";

const reg = JSON.parse(readFileSync(REGISTRY, "utf8"));
const statePath = REGISTRY.replace("registry.json", "state.json");
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
const ids = reg.users.map((u) => `'${u.id}'`).join(",");
const one = (r) => r.at(-1);

console.log(`teardown for run ${reg.run} · ${reg.users.length} accounts`);

// ─── 1. Storage, through the API that is allowed to delete it ───────────────
// oldShopIds: shops this run created and then rewound away mid-acceptance —
// their rows are gone but their draft objects are still this fixture's.
const shopPrefixes = [state.shopId, ...(state.oldShopIds ?? [])].filter(Boolean);
for (const bucket of ["shop-product-media-draft", "shop-product-media"]) {
  for (const prefix of shopPrefixes) {
  const list = await fetch(`${SB}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: serviceHeaders,
    body: JSON.stringify({ prefix, limit: 1000 }),
  });
  const items = await list.json().catch(() => []);
  const names = Array.isArray(items) ? items.map((o) => `${prefix}/${o.name}`) : [];
  if (names.length) {
    const del = await fetch(`${SB}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: serviceHeaders,
      body: JSON.stringify({ prefixes: names }),
    });
    console.log(`  ${bucket}: asked to remove ${names.length} object(s) → HTTP ${del.status}`);
  } else {
    console.log(`  ${bucket}: nothing listed under ${prefix || "(no shop)"}`);
  }
  }
}

// ─── 2. Rows that do not disappear on their own ─────────────────────────────
// Ordered child → parent. shop_media_cleanup_jobs is scoped to this run's
// shops only: it is a global queue and other runs may own rows in it.
const jobScope = shopPrefixes.map((p) => `shop_id = '${p}' OR object_path LIKE '${p}/%'`).join(" OR ");
await sql(`
  DELETE FROM public.shop_media_cleanup_jobs
   WHERE ${jobScope || "false"};
  DELETE FROM public.product_media   WHERE product_id IN (SELECT id FROM public.products WHERE shop_id IN (SELECT id FROM public.shops WHERE owner_user_id IN (${ids})));
  DELETE FROM public.product_variants WHERE product_id IN (SELECT id FROM public.products WHERE shop_id IN (SELECT id FROM public.shops WHERE owner_user_id IN (${ids})));
  DELETE FROM public.products         WHERE shop_id IN (SELECT id FROM public.shops WHERE owner_user_id IN (${ids}));
  DELETE FROM public.shop_profile_media WHERE shop_id IN (SELECT id FROM public.shops WHERE owner_user_id IN (${ids}));
  DELETE FROM public.shop_contact_channels WHERE shop_id IN (SELECT id FROM public.shops WHERE owner_user_id IN (${ids}));
  DELETE FROM public.shop_members     WHERE shop_id IN (SELECT id FROM public.shops WHERE owner_user_id IN (${ids}));
  DELETE FROM public.shop_applications WHERE applicant_user_id IN (${ids});
  DELETE FROM public.shops            WHERE owner_user_id IN (${ids});
  DELETE FROM public.shop_pilot_members WHERE user_id IN (${ids});
  DELETE FROM public.user_roles       WHERE user_id IN (${ids});
`);
console.log("  rows deleted (children first, shop last)");

// ─── 3. Accounts. Admin API, so auth-side rows go with them ─────────────────
for (const u of reg.users) {
  const r = await fetch(`${SB}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: serviceHeaders });
  console.log(`  ${u.who.padEnd(6)} delete → HTTP ${r.status}`);
}

// ─── 4. The count that decides ──────────────────────────────────────────────
const counts = one(await sql(`
  SELECT
    (SELECT count(*)::int FROM auth.users WHERE email LIKE 'p2b27-%')                            AS users,
    (SELECT count(*)::int FROM public.user_roles WHERE user_id IN (${ids}))                      AS roles,
    (SELECT count(*)::int FROM public.shop_pilot_members WHERE user_id IN (${ids}))              AS pilot,
    (SELECT count(*)::int FROM public.shop_applications WHERE applicant_user_id IN (${ids}))     AS applications,
    (SELECT count(*)::int FROM public.shops WHERE owner_user_id IN (${ids}))                     AS shops,
    (SELECT count(*)::int FROM public.shop_members WHERE user_id IN (${ids}))                    AS members,
    (SELECT count(*)::int FROM public.products)                                                  AS products_total,
    (SELECT count(*)::int FROM public.product_variants)                                          AS variants_total,
    (SELECT count(*)::int FROM public.product_media)                                             AS product_media_total,
    (SELECT count(*)::int FROM public.shop_profile_media)                                        AS profile_media_total,
    (SELECT count(*)::int FROM public.shop_contact_channels)                                     AS contacts_total,
    (SELECT count(*)::int FROM public.shop_media_cleanup_jobs)                                   AS cleanup_jobs,
    (SELECT count(*)::int FROM storage.objects WHERE bucket_id LIKE 'shop%')                     AS shop_objects,
    (SELECT count(*)::int FROM public.legal_acceptances WHERE user_id IN (${ids}))               AS acceptances,
    (SELECT count(*)::int FROM public.legal_documents WHERE document_key='seller-rules')         AS seller_rules_kept,
    (SELECT count(*)::int FROM auth.users)                                                       AS users_total,
    (SELECT count(*)::int FROM cron.job)                                                         AS cron_jobs,
    (SELECT count(*)::int FROM cron.job WHERE active)                                            AS cron_active,
    (SELECT count(*)::int FROM supabase_migrations.schema_migrations)                            AS ledger,
    (SELECT count(*)::int FROM vault.decrypted_secrets)                                          AS vault_secrets;`));

console.log("\n--- teardown counts ---");
for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(22)} ${v}`);

const mustBeZero = ["users", "roles", "pilot", "applications", "shops", "members", "acceptances",
  "products_total", "variants_total", "product_media_total", "profile_media_total", "contacts_total",
  "cleanup_jobs", "shop_objects"];
const mustBeKept = { seller_rules_kept: 1, users_total: 1, cron_jobs: 19, cron_active: 2, ledger: 360, vault_secrets: 2 };

const dirty = mustBeZero.filter((k) => counts[k] !== 0);
const lost = Object.entries(mustBeKept).filter(([k, v]) => counts[k] !== v);

if (existsSync(REGISTRY.replace("registry.json", "secrets.local.json"))) {
  unlinkSync(REGISTRY.replace("registry.json", "secrets.local.json"));
  console.log("\n  secrets.local.json deleted");
}

console.log(dirty.length ? `\n❌ still populated: ${dirty.map((k) => `${k}=${counts[k]}`).join(", ")}` : "\n✅ every fixture counter is zero");
console.log(lost.length ? `❌ something that had to survive did not: ${lost.map(([k, v]) => `${k}=${counts[k]} (want ${v})`).join(", ")}` : "✅ rules, ledger, cron, vault and the system account are untouched");
process.exit(dirty.length || lost.length ? 1 : 0);

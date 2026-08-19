#!/usr/bin/env node
/**
 * A rehearsal shop, so the post-submit scripts get debugged before the legal
 * window opens rather than during it.
 *
 * This shop is created by SQL, which is NOT how a shop is created in the
 * product — `shop_application_decide` is, and case 10 asserts exactly that.
 * Nothing here is reported as an acceptance result; it exists to make the
 * catalogue, media and publication scripts run once against real infrastructure
 * so their own bugs surface early. It is torn down before the real run.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { sql, REGISTRY } from "./env.mjs";
import { uid } from "./lib.mjs";

const reg = JSON.parse(readFileSync(REGISTRY, "utf8"));
const seller = uid("seller");

await sql(`
  DELETE FROM public.shops WHERE slug = 'cp27-rehearsal';
  INSERT INTO public.shops (slug, name, state, owner_user_id, city, region)
  VALUES ('cp27-rehearsal', 'CP27 Rehearsal Shop', 'active', '${seller}', 'Ha Noi', 'Ha Noi');
  INSERT INTO public.shop_members (shop_id, user_id, role)
  SELECT id, '${seller}', 'owner' FROM public.shops WHERE slug = 'cp27-rehearsal'
  ON CONFLICT DO NOTHING;
`);

const shop = (await sql(`SELECT id::text, slug FROM public.shops WHERE slug='cp27-rehearsal';`)).at(-1);
const state = { ...reg, rehearsal: true, shopId: shop.id, shopSlug: shop.slug };
writeFileSync("/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/state.rehearsal.json", JSON.stringify(state, null, 2));
console.log(`rehearsal shop ${shop.slug} ${shop.id}`);

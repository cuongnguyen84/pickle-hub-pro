// ============================================================================
// A2 — does the buyer's OWN JWT read their order, with the grants as shipped?
// ----------------------------------------------------------------------------
//   node scripts/shop-p2b-fixture.mjs up
//   node scripts/qa/order-read-jwt-probe.mjs <buyer-email> [outsider-email]
//
// Round 2 verified the select with the SERVICE key. That proves nothing: the
// service role bypasses RLS and holds every column grant, so a select that is
// missing a grant answers 200 for it and 42501 for a real buyer. The three
// order tables had `REVOKE ALL FROM authenticated` followed by a COLUMN list,
// and `shop_order_events.actor_user_id` was taken OUT of that list in
// 20260818110000 — after the hook was written.
//
// So this signs the buyer in properly and runs the select string LIFTED OUT OF
// THE HOOK ITSELF (parsed from the source, not retyped), against an order that
// buyer really placed. What it prints is the status code and the payload.
//
// It also asks the same question as somebody who is not a party to the order:
// a leak here would be worse than a 42501.
//
// Round 4 adds the OTHER select, the one that draws the whole /shop/orders
// screen: LIST_SELECT against the VIEW my_shop_orders, embeds and all. The
// detail page proves nothing about it — a view PostgREST cannot infer FKs
// through answers PGRST200 to every user. And the case the view was built for,
// which nobody had measured: an account that sells from this shop and also
// buys from it must see its OWN order and not its customer's.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const API = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321";
const ANON =
  process.env.SUPABASE_LOCAL_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  process.env.SUPABASE_LOCAL_SERVICE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PASSWORD = process.env.SHOP_QA_PASSWORD ?? "QaP2b!2026";
const DB = process.env.SUPABASE_LOCAL_DB_CONTAINER ?? "supabase_db_ajvlcamxemgbxduhiqrl";

const buyerEmail = process.argv[2];
const outsiderEmail = process.argv[3] ?? null;
if (!buyerEmail) {
  console.error("usage: node scripts/qa/order-read-jwt-probe.mjs <buyer-email> [outsider-email]");
  process.exit(2);
}

/** The select the hook actually sends, parsed out of the hook. Retyping it
 *  here would be testing this file's copy, not the app's. */
function selectFromSource(name) {
  const src = readFileSync("src/hooks/shop/useOrders.ts", "utf8");
  const m = src.match(new RegExp(`const ${name} =([\\s\\S]*?);\\n`));
  if (!m) throw new Error(`${name} not found in src/hooks/shop/useOrders.ts`);
  return new Function(`return (${m[1].trim()})`)();
}

const sql = (text) =>
  execFileSync("docker", ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-c", text], {
    stdio: ["pipe", "pipe", "pipe"],
  }).toString().trim();

const admin = createClient(API, SERVICE, { auth: { persistSession: false } });

const signIn = async (email) => {
  const c = createClient(API, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return { client: c, userId: data.user.id };
};

const ORDER_SELECT = selectFromSource("ORDER_SELECT");
const LIST_SELECT = selectFromSource("LIST_SELECT");
console.log("── ORDER_SELECT lifted from src/hooks/shop/useOrders.ts (trang chi tiết, bảng shop_orders) ──");
console.log(ORDER_SELECT);
console.log();
console.log("── LIST_SELECT lifted from src/hooks/shop/useOrders.ts (/shop/orders, VIEW my_shop_orders) ──");
console.log(LIST_SELECT);
console.log();

// ── 1. A shop that will take an order, and something to buy from it ─────────
const shopId = sql(
  `SELECT s.id FROM public.shops s
   WHERE s.state = 'active' AND EXISTS (
     SELECT 1 FROM public.products p JOIN public.product_variants v ON v.product_id = p.id
     WHERE p.shop_id = s.id AND p.status='approved' AND p.is_published AND v.retired_at IS NULL)
   ORDER BY s.created_at LIMIT 1;`,
);
if (!shopId) throw new Error("no active shop with a sellable product — run scripts/shop-p2b-fixture.mjs up");

// ordering_enabled is pinned by shops_guard_privileged_columns_trg for anybody
// who is not an admin, so the switch is flipped with the trigger off. This is
// the same dance the browser tester had to do, and it is the guard working.
sql(`ALTER TABLE public.shops DISABLE TRIGGER shops_guard_privileged_columns_trg;
     UPDATE public.shops SET ordering_enabled = true, shipping_fee_vnd = 30000 WHERE id = '${shopId}';
     ALTER TABLE public.shops ENABLE TRIGGER shops_guard_privileged_columns_trg;`);

const variant = sql(
  `SELECT v.id || '|' || v.price_vnd FROM public.product_variants v
   JOIN public.products p ON p.id = v.product_id
   WHERE p.shop_id = '${shopId}' AND p.status='approved' AND p.is_published AND v.retired_at IS NULL
   ORDER BY v.created_at LIMIT 1;`,
).split("|");
const [variantId, price] = [variant[0], Number(variant[1])];

// Stock is guarded too; give the variant plenty so the order cannot be refused
// for a reason that has nothing to do with the read under test.
sql(`SELECT set_config('shop.stock_write','on',false);
     UPDATE public.product_variants SET stock_on_hand = 50 WHERE id = '${variantId}';`);

// ── 2. The buyer places a real order with their own JWT ─────────────────────
const placeOrder = async (who, name) => {
  await admin.from("shop_cart_items").delete().eq("user_id", who.userId);
  const { error: cartErr } = await who.client
    .from("shop_cart_items")
    .insert({ variant_id: variantId, qty: 1 });
  if (cartErr) throw new Error(`cart insert failed: ${JSON.stringify(cartErr)}`);

  const { data: created, error: createErr } = await who.client.rpc("shop_order_create", {
    _client_token: `a2-probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    _payment_method: "cod",
    _recipient_name: name,
    _recipient_phone: "0912345678",
    _shipping_address: "Số 12 ngõ 5 Trần Duy Hưng, phường Trung Hoà, quận Cầu Giấy, Hà Nội",
    _delivery_note: null,
    _expected_shipping_fee_vnd: 30000,
    _items: [{ variant_id: variantId, qty: 1, expected_unit_price_vnd: price }],
  });
  if (createErr) throw new Error(`shop_order_create failed: ${JSON.stringify(createErr)}`);
  return created.code;
};

const buyer = await signIn(buyerEmail);
const code = await placeOrder(buyer, "Nguyễn Kiểm Thử");
console.log(`── order placed by ${buyerEmail}: ${code} ──\n`);

// ── 3. The read the hook performs, with the buyer's JWT ─────────────────────
const probe = async (label, client) => {
  const res = await client.from("shop_orders").select(ORDER_SELECT).eq("code", code).maybeSingle();
  const status = res.status ?? "(none)";
  console.log(`── ${label} ──`);
  console.log(`HTTP ${status}`);
  console.log(`error: ${res.error ? JSON.stringify(res.error) : "null"}`);
  console.log(`data:  ${JSON.stringify(res.data, null, 2)}`);
  console.log();
  return res;
};

const mine = await probe(`buyer JWT (${buyerEmail})`, buyer.client);

let outsider = null;
if (outsiderEmail) {
  const o = await signIn(outsiderEmail);
  outsider = await probe(`outsider JWT (${outsiderEmail})`, o.client);
}

// ── 4. /shop/orders reads the VIEW, and nothing had ever run that select ─────
// LIST_SELECT carries three PostgREST embeds off a VIEW, which is a different
// question from the detail page's embeds off a TABLE: if PostgREST cannot
// infer the FK relationships through the view, /shop/orders is PGRST200 for
// every user. Then the expensive case the view exists for — an account that
// SELLS and BUYS reads it and must see only what it bought.
const listProbe = async (label, client) => {
  const res = await client
    .from("my_shop_orders")
    .select(LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(200);
  console.log(`── my_shop_orders + LIST_SELECT — ${label} ──`);
  console.log(`HTTP ${res.status ?? "(none)"}`);
  console.log(`error: ${res.error ? JSON.stringify(res.error) : "null"}`);
  console.log(`rows:  ${res.data?.length ?? 0}  codes: ${JSON.stringify((res.data ?? []).map((r) => r.code))}`);
  console.log(`first: ${JSON.stringify(res.data?.[0] ?? null, null, 2)}`);
  console.log();
  return res;
};

const myList = await listProbe(`buyer JWT (${buyerEmail})`, buyer.client);

// The view's real column list as the client sees it — the second, independent
// place the identity invariant lives (the view is not security_invoker, so the
// table's column GRANTs do not apply to it).
const star = await buyer.client.from("my_shop_orders").select("*").limit(1);
const viewCols = Object.keys(star.data?.[0] ?? {});
console.log("── my_shop_orders columns as `authenticated` sees them ──");
console.log(JSON.stringify(viewCols));
console.log();

const problems = [];

// The shop's owner sells from this shop AND is about to buy from it. As a shop
// member they ARE a party to the buyer's order on shop_orders — the view is the
// only thing that keeps that order off their "Đơn của tôi" screen.
const ownerEmail = sql(
  `SELECT u.email FROM auth.users u JOIN public.shops s ON s.owner_user_id = u.id WHERE s.id = '${shopId}';`,
);
let ownerList = null;
let ownerTable = null;
let ownerCode = null;
if (!ownerEmail) {
  // Ca vừa-bán-vừa-mua chính là lý do view tồn tại. Bỏ qua nó mà vẫn in PASS
  // là xanh giả — một lần fixture đổi tên là A58 mất hết ý nghĩa.
  problems.push("seller-and-buyer case did not run — shop owner has no auth.users row");
  console.log("!! shop owner has no auth.users row — seller-and-buyer case DID NOT RUN\n");
} else {
  const owner = await signIn(ownerEmail);
  ownerCode = await placeOrder(owner, "Chủ Shop Mua Hàng");
  console.log(`── same account SELLS this shop and just BOUGHT from it: ${ownerEmail} → ${ownerCode} ──\n`);

  ownerList = await listProbe(`seller-and-buyer JWT (${ownerEmail})`, owner.client);

  // Non-vacuous: prove the same account really can read the customer's order
  // off the TABLE, so "not in the view" is the view filtering, not an empty db.
  ownerTable = await owner.client
    .from("shop_orders")
    .select(LIST_SELECT)
    .eq("shop_id", shopId)
    .limit(200);
  console.log(`── shop_orders + LIST_SELECT — same account as /seller/orders does ──`);
  console.log(`HTTP ${ownerTable.status ?? "(none)"}`);
  console.log(`error: ${ownerTable.error ? JSON.stringify(ownerTable.error) : "null"}`);
  console.log(`rows:  ${ownerTable.data?.length ?? 0}  codes: ${JSON.stringify((ownerTable.data ?? []).map((r) => r.code))}`);
  console.log();
}

// ── 5. Verdict ──────────────────────────────────────────────────────────────
if (mine.error) problems.push(`buyer read failed: ${mine.error.code} ${mine.error.message}`);
if (!mine.data) problems.push("buyer read returned no row");
if (mine.data) {
  if (!mine.data.shop?.name) problems.push("shop embed missing");
  if (!Array.isArray(mine.data.items) || mine.data.items.length === 0) problems.push("items embed empty");
  if (!Array.isArray(mine.data.events) || mine.data.events.length === 0) problems.push("events embed empty");
  // `create` carries no actor_kind — the creator is always the buyer. The key
  // appears on TRANSITION events, which is where the timeline needs it, and
  // where the column grant would otherwise have been the only source.
  if (mine.data.events?.[0]?.action !== "create") problems.push("first event is not `create`");
  if (mine.data.events?.some((e) => "actor_user_id" in e)) {
    problems.push("actor_user_id reached the client");
  }
  if ("buyer_user_id" in mine.data) problems.push("buyer_user_id leaked into the payload");
}
if (outsider && (outsider.data || outsider.error)) {
  problems.push(`outsider got ${outsider.error ? "an error" : "a row"} instead of a silent null`);
}

// The list, off the view.
if (myList.error) problems.push(`view read failed: ${myList.error.code} ${myList.error.message}`);
const myRow = (myList.data ?? []).find((r) => r.code === code);
if (!myRow) problems.push("the order just placed is missing from my_shop_orders");
if (myRow) {
  if (!myRow.shop?.name) problems.push("view: shop embed missing");
  if (!Array.isArray(myRow.items) || myRow.items.length === 0) problems.push("view: items embed empty");
  if (!Array.isArray(myRow.events) || myRow.events.length === 0) problems.push("view: events embed empty");
}
for (const col of ["buyer_user_id", "client_token", "cancelled_by"]) {
  if (viewCols.includes(col)) problems.push(`view exposes ${col}`);
}
// The expensive one.
if (ownerList) {
  if (ownerList.error) problems.push(`seller-and-buyer view read failed: ${JSON.stringify(ownerList.error)}`);
  const codes = (ownerList.data ?? []).map((r) => r.code);
  if (!codes.includes(ownerCode)) problems.push("seller-and-buyer does not see the order THEY placed");
  if (codes.includes(code)) problems.push("LEAK: seller-and-buyer sees a CUSTOMER's order in my_shop_orders");
  const tableCodes = (ownerTable?.data ?? []).map((r) => r.code);
  if (!tableCodes.includes(code)) {
    problems.push(
      "vacuous: that account cannot read the customer's order off shop_orders either — the view proved nothing",
    );
  }
}

console.log(problems.length ? `FAIL\n - ${problems.join("\n - ")}` : "PASS — the hook's select works with a real buyer JWT");
process.exit(problems.length ? 1 : 0);

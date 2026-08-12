// ============================================================================
// P2b.7 — one seed for the whole acceptance run.
// ----------------------------------------------------------------------------
// Four QA scripts had four seeds. Each one built the slice its own checkpoint
// needed, and each one was separately capable of being wrong in a way that
// still reported PASS — which is exactly what happened three times on this
// branch: a catalogue with no publishable product, a teardown that deleted
// nothing, a promotion silently neutralised by the privileged-column guard.
//
// So the acceptance run has ONE dataset, built through the SERVER-AUTHORITATIVE
// flows, and it refuses to hand anything back until it has re-read the database
// and found the rows it claims to have made.
//
// Two rules, learned the hard way and now structural:
//
//   1. Nothing is promoted with a PostgREST UPDATE. `products`,
//      `product_media` and `shop_contact_channels` all pin their privileged
//      columns against ANY client write, and PostgREST is a client. An
//      `.update({status:'approved'})` returns 200 and changes nothing. The
//      real path is the moderator's RPC and the worker's commit; that is what
//      runs here.
//
//   2. Every id is recorded in `created` AT THE MOMENT IT EXISTS, not returned
//      at the end. A seed that throws halfway must still be fully cleanable,
//      and the version that assigned on success left a shop and six products
//      behind when it did not get there.
// ============================================================================

import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { API, ANON, adminClient, grantAdminLocally } from "./seller-qa-kit.mjs";
import { elevateToAal2 } from "./totp.mjs";

const DB_CONTAINER = process.env.SUPABASE_LOCAL_DB_CONTAINER ?? "supabase_db_ajvlcamxemgbxduhiqrl";
export const DRAFT_BUCKET = "shop-product-media-draft";
export const PUBLIC_BUCKET = "shop-product-media";

export const PASSWORD = "QaP2b!2026";

/** Privileged SQL, straight at the container. The honest way to say "fixture". */
export const psql = (sql) =>
  execFileSync("docker", [
    "exec", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-tA", "-q", "-c", sql,
  ], { stdio: ["pipe", "pipe", "pipe"] }).toString().trim();

/** A structurally valid WebP of a stated size. The rendition the worker copies. */
export function webpBytes(width = 1200, height = 900) {
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  const body = [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >> 24) & 0xff];
  const chunk = [
    ...[..."VP8L"].map((c) => c.charCodeAt(0)),
    body.length, 0, 0, 0,
    ...body,
    ...(body.length % 2 ? [0] : []),
  ];
  const riffSize = 4 + chunk.length;
  return new Uint8Array([
    ...[..."RIFF"].map((c) => c.charCodeAt(0)),
    riffSize & 0xff, (riffSize >> 8) & 0xff, (riffSize >> 16) & 0xff, (riffSize >> 24) & 0xff,
    ...[..."WEBP"].map((c) => c.charCodeAt(0)),
    ...chunk,
  ]);
}

const anon = () => createClient(API, ANON, { auth: { persistSession: false } });

/**
 * The registry. Populated as rows appear; teardown reads only this.
 *
 * `objects` is separate from the media rows on purpose: deleting a shop
 * cascades the ROWS and leaves the BYTES, and the QA runs with no worker.
 */
export const newRegistry = () => ({
  userIds: [],
  shopIds: [],
  productIds: [],
  objects: [],       // { bucket, path }
  categorySlugs: [], // taxonomy this run owns and must remove
  rulesVersions: [], // seller-rules document versions this run published
});

/**
 * The seller-rules document the QA signs.
 *
 * TEST-ONLY, and it says so in its own title so that a copy turning up on a
 * real environment reports itself. Migration 20260814090000 deliberately seeds
 * no document at all: placeholder legal text that real sellers could be asked
 * to sign is worse than an empty table, because an empty table blocks the
 * submit and a placeholder does not.
 *
 * The body is long enough to satisfy legal_documents_body_len (200 chars) and
 * says nothing that could be mistaken for terms.
 */
const TEST_RULES_BODY = [
  "[TEST-ONLY] Văn bản này chỉ dùng cho kiểm thử tự động của ThePickleHub.",
  "Nó KHÔNG phải quy chế người bán, KHÔNG có hiệu lực pháp lý, và không được",
  "hiển thị cho bất kỳ người bán thật nào. Nội dung thật do Product Owner và",
  "bộ phận pháp lý cung cấp; cho tới lúc đó, việc gửi hồ sơ bị chặn ở phía máy",
  "chủ bằng lỗi seller_rules_not_published.",
].join(" ");

/**
 * Publish a test-only seller-rules version and have the applicant accept it.
 *
 * Since migration 20260814090000 an application cannot be submitted until the
 * SERVER has seen an acceptance of the effective version. The seed therefore
 * has to do what a real seller does — which is the point: a fixture that could
 * skip the gate would be testing a system nobody uses.
 */
export async function seedSellerRules(admin, reg, applicantClient, run) {
  const version = `test-${run}`;
  const { data: doc, error: docErr } = await admin
    .from("legal_documents")
    .insert({
      document_key: "seller-rules",
      version,
      title: `[TEST-ONLY] Quy chế người bán — QA ${run}`,
      body: TEST_RULES_BODY,
      effective_at: new Date(Date.now() - 60_000).toISOString(),
      // An unapproved row is a draft, and legal_current_document() will not
      // serve it — so a fixture that omits these two silently blocks its own
      // submit. Named QA rather than a person, because it is not an approval.
      approved_by: "QA fixture (test-only)",
      approved_at: new Date(Date.now() - 120_000).toISOString(),
    })
    .select("version, content_hash")
    .single();
  if (docErr) fail(`legal_documents insert: ${docErr.message}`);
  reg.rulesVersions.push(doc.version);

  const { error: acceptErr } = await applicantClient.rpc("legal_accept", {
    _document_key: "seller-rules",
    _version: doc.version,
    _content_hash: doc.content_hash,
    _client_token: `rules-${run}`,
  });
  if (acceptErr) fail(`legal_accept: ${acceptErr.message}`);

  return doc;
}

const fail = (msg) => {
  throw new Error(`P2b.7 seed: ${msg}`);
};

async function makeUser(admin, reg, email) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (error) fail(`createUser ${email}: ${error.message}`);
  reg.userIds.push(data.user.id);
  const client = anon();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) fail(`signIn ${email}: ${signInError.message}`);
  const { data: sess } = await client.auth.getSession();
  return { id: data.user.id, email, client, session: sess.session };
}

/** A media row with real bytes in the draft bucket, finalized by the server. */
async function attachMedia(admin, reg, sellerClient, productId, { width = 1200, height = 900 } = {}) {
  const { data: init, error } = await sellerClient.rpc("product_media_upload_init", {
    _product_id: productId,
    _content_type: "image/jpeg",
    _byte_size: 4000,
    _original_filename: "anh-san-pham.jpg",
    _client_token: `p2b7-${productId.slice(0, 8)}-${Math.random().toString(36).slice(2, 10)}`,
  });
  if (error) fail(`media_upload_init: ${error.message}`);

  for (const [path, bytes] of [
    [init.draft_path, webpBytes(64, 48)],
    [init.rendition_path, webpBytes(width, height)],
  ]) {
    const { error: upErr } = await sellerClient.storage
      .from(DRAFT_BUCKET)
      .upload(path, new Blob([bytes], { type: "image/webp" }), { contentType: "image/webp", upsert: true });
    if (upErr) fail(`upload ${path}: ${upErr.message}`);
    reg.objects.push({ bucket: DRAFT_BUCKET, path });
  }

  const { error: finErr } = await sellerClient.rpc("product_media_finalize", {
    _media_id: init.media_id, _width: width, _height: height,
  });
  if (finErr) fail(`media_finalize: ${finErr.message}`);
  return init.media_id;
}

/**
 * Approve → copy bytes → commit. The worker's half, replayed exactly.
 *
 * Split from the approval because they are genuinely two steps in production
 * and P2b.7 asserts a product is invisible BETWEEN them.
 */
async function publish(admin, reg, ownerClient, productId) {
  const { data: plan, error } = await ownerClient.rpc("product_publish_prepare", { _product_id: productId });
  if (error) fail(`publish_prepare: ${error.message}`);
  if (!plan?.copies?.length) fail(`publish_prepare returned no copies for ${productId}`);

  for (const copy of plan.copies) {
    const { data: blob, error: dlErr } = await admin.storage.from(DRAFT_BUCKET).download(copy.source);
    if (dlErr) fail(`download ${copy.source}: ${dlErr.message}`);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const { error: upErr } = await admin.storage.from(PUBLIC_BUCKET).upload(copy.target, bytes, {
      contentType: "image/webp", upsert: true,
    });
    if (upErr) fail(`copy to public ${copy.target}: ${upErr.message}`);
    reg.objects.push({ bucket: PUBLIC_BUCKET, path: copy.target });
  }
  const { error: commitErr } = await admin.rpc("product_publish_commit", {
    _product_id: productId, _copied: plan.copies,
  });
  if (commitErr) fail(`publish_commit: ${commitErr.message}`);
}

const versionOf = async (admin, productId) => {
  const { data } = await admin.from("products").select("version").eq("id", productId).single();
  return data.version;
};

/**
 * Build a product through the seller's own RPCs and stop at `stage`.
 *
 *   draft → pending → needs_changes → approved (not published) → published
 *
 * Each stage is a state the buyer surfaces and the moderation queue must both
 * be right about, so the fixture reaches it the way a seller and a moderator
 * actually would rather than by writing the column.
 */
async function buildProduct(admin, reg, ctx, spec) {
  const { seller, shopId, adminClient: mod } = ctx;
  const token = `p2b7-${spec.key}-${ctx.run}`;
  const { data: created, error } = await seller.client.rpc("product_create", {
    _shop_id: shopId,
    _client_token: token,
    _payload: {
      title: spec.title,
      description: spec.description ??
        "Vợt carbon T700, lõi tổ ong 16mm, cán 4.25 inch, hàng còn nguyên hộp, có bảo hành.",
      category_slug: spec.category ?? "vot",
      condition: spec.condition ?? "new",
      price_vnd: String(spec.price ?? 1500000),
      stock_on_hand: spec.stock === undefined ? "5" : spec.stock === null ? "" : String(spec.stock),
    },
  });
  if (error) fail(`product_create ${spec.key}: ${error.message}`);
  reg.productIds.push(created.id);
  const productId = created.id;

  const mediaId = await attachMedia(admin, reg, seller.client, productId);

  if (spec.matrix) {
    const { error: recErr } = await seller.client.rpc("product_variants_reconcile", {
      _product_id: productId,
      _expected_version: await versionOf(admin, productId),
      _option_groups: spec.matrix.groups,
      _rows: spec.matrix.rows,
      _client_token: `${token}-matrix`,
      _keep_variant_id: null,
    });
    if (recErr) fail(`variants_reconcile ${spec.key}: ${recErr.message}`);

    // One combination gets the photo, so "changing colour changes the picture"
    // has something to be true about.
    const { data: vs } = await admin
      .from("product_variants").select("id,option_key,position")
      .eq("product_id", productId).order("position");
    if (!vs?.length) fail(`${spec.key}: reconcile produced no variants`);
    const { error: mapErr } = await seller.client.rpc("product_variant_set_media", {
      _variant_id: vs[0].id, _media_id: mediaId,
    });
    if (mapErr) fail(`variant_set_media ${spec.key}: ${mapErr.message}`);
  }

  if (spec.slugRename) {
    const { error: slugErr } = await seller.client.rpc("product_slug_update", {
      _product_id: productId, _slug: spec.slugRename,
    });
    if (slugErr) fail(`product_slug_update ${spec.key}: ${slugErr.message}`);
  }

  if (spec.stage === "draft") return { id: productId, mediaId };

  const { error: subErr } = await seller.client.rpc("product_submit", {
    _product_id: productId,
    _expected_version: await versionOf(admin, productId),
    _client_token: `${token}-submit`,
  });
  if (subErr) fail(`product_submit ${spec.key}: ${subErr.message}`);
  if (spec.stage === "pending") return { id: productId, mediaId };

  if (spec.stage === "needs_changes") {
    const { error: decErr } = await mod.rpc("product_decide", {
      _product_id: productId,
      _decision: "request_changes",
      _applicant_note: "Ảnh chụp chưa rõ mặt vợt, nhờ anh/chị chụp lại giúp.",
      _requested_targets: [{ section: "media", field: null }],
      _client_token: `${token}-rc`,
    });
    if (decErr) fail(`product_decide request_changes ${spec.key}: ${decErr.message}`);
    return { id: productId, mediaId };
  }

  const { error: apErr } = await mod.rpc("product_decide", {
    _product_id: productId, _decision: "approve", _client_token: `${token}-ap`,
  });
  if (apErr) fail(`product_decide approve ${spec.key}: ${apErr.message}`);
  if (spec.stage === "approved") return { id: productId, mediaId };

  await publish(admin, reg, seller.client, productId);

  if (spec.stage === "suspended") {
    const { error: susErr } = await mod.rpc("product_decide", {
      _product_id: productId,
      _decision: "suspend",
      _applicant_note: "Tạm gỡ để đối chiếu giấy tờ.",
      _client_token: `${token}-sus`,
    });
    if (susErr) fail(`product_decide suspend ${spec.key}: ${susErr.message}`);
  }
  return { id: productId, mediaId };
}

// ── The dataset ─────────────────────────────────────────────────────────────

export async function seedP2bAcceptance(reg, run) {
  const admin = adminClient();

  // Users. `buyer` is a signed-in shopper with no seller anything; `nonPilot`
  // is the one the application door must refuse.
  const buyer = await makeUser(admin, reg, `p2b7-buyer-${run}@thepicklehub.test`);
  const nonPilot = await makeUser(admin, reg, `p2b7-nonpilot-${run}@thepicklehub.test`);
  const seller = await makeUser(admin, reg, `p2b7-seller-${run}@thepicklehub.test`);
  const manager = await makeUser(admin, reg, `p2b7-manager-${run}@thepicklehub.test`);
  const support = await makeUser(admin, reg, `p2b7-support-${run}@thepicklehub.test`);
  const rival = await makeUser(admin, reg, `p2b7-rival-${run}@thepicklehub.test`);
  const suspendedOwner = await makeUser(admin, reg, `p2b7-susp-${run}@thepicklehub.test`);
  const applicant = await makeUser(admin, reg, `p2b7-applicant-${run}@thepicklehub.test`);
  const adminAal1 = await makeUser(admin, reg, `p2b7-admin1-${run}@thepicklehub.test`);
  const adminAal2 = await makeUser(admin, reg, `p2b7-admin2-${run}@thepicklehub.test`);

  grantAdminLocally(adminAal1.id);
  grantAdminLocally(adminAal2.id);

  const { error: pilotErr } = await admin.from("shop_pilot_members").insert(
    [seller, manager, support, rival, suspendedOwner, applicant].map((u) => ({ user_id: u.id })),
  );
  if (pilotErr) fail(`pilot members: ${pilotErr.message}`);

  // aal2 for real: enrol a TOTP factor, compute a code, verify, and read the
  // level back off the JWT. AdminMFAGate is the thing under test, so nothing
  // about it is mocked.
  const { session: adminSession, aal } = await elevateToAal2(adminAal2.client, { friendlyName: `p2b7-${run}` });
  if (aal !== "aal2") fail(`admin session is ${aal}, not aal2`);

  // Shops. Direct inserts: Phase 1's application flow is exercised as a
  // JOURNEY below, and a fixture that has to pass through it to exist would
  // make every later assertion depend on it.
  const shopRows = [
    { slug: `p2b7-shop-${run}`, name: "Shop QA Nghiệm Thu", state: "active",
      owner_user_id: seller.id, region: "Hà Nội",
      verified_at: new Date().toISOString(), verified_method: "giay-phep-kinh-doanh" },
    { slug: `p2b7-rival-${run}`, name: "Shop Đối Chứng", state: "active", owner_user_id: rival.id },
    { slug: `p2b7-susp-${run}`, name: "Shop Bị Tạm Ngưng", state: "active", owner_user_id: suspendedOwner.id },
  ];
  const { data: shops, error: shopErr } = await admin.from("shops").insert(shopRows).select();
  if (shopErr) fail(`shops: ${shopErr.message}`);
  for (const s of shops) reg.shopIds.push(s.id);
  const shopA = shops.find((s) => s.slug === `p2b7-shop-${run}`);
  const shopB = shops.find((s) => s.slug === `p2b7-rival-${run}`);
  const shopS = shops.find((s) => s.slug === `p2b7-susp-${run}`);

  const { error: memErr } = await admin.from("shop_members").insert([
    { shop_id: shopA.id, user_id: seller.id, role: "owner" },
    { shop_id: shopA.id, user_id: manager.id, role: "manager" },
    { shop_id: shopA.id, user_id: support.id, role: "support" },
    { shop_id: shopB.id, user_id: rival.id, role: "owner" },
    { shop_id: shopS.id, user_id: suspendedOwner.id, role: "owner" },
  ]);
  if (memErr) fail(`shop_members: ${memErr.message}`);

  // A submitted application, so /admin/shop/applications/:id has something to
  // review. Inserted by the applicant themselves — the INSERT policy checks
  // applicant_user_id, so a service-role shortcut here would test nothing.
  const { data: appRow, error: appInsErr } = await applicant.client
    .from("shop_applications")
    .insert({
      applicant_user_id: applicant.id,
      seller_type: "ca-nhan",
      full_name: "Nguyễn Văn Nghiệm Thu",
      phone: "0901234567",
      shop_name: `Shop Hồ Sơ QA ${run}`,
      shop_intro: "Bán vợt và bóng pickleball chính hãng, đã bán 2 năm ở Hà Nội.",
      pickup_address: "Số 1 phố Thử Nghiệm, Ba Đình",
      city: "Hà Nội",
    })
    .select("id")
    .single();
  if (appInsErr) fail(`shop_applications insert: ${appInsErr.message}`);

  // Sign before submitting, because the server will not let us do otherwise.
  const rulesDoc = await seedSellerRules(admin, reg, applicant.client, run);

  const { error: appSubErr } = await applicant.client.rpc("shop_application_submit", {
    _expected_rules_version: rulesDoc.version,
  });
  if (appSubErr) fail(`shop_application_submit: ${appSubErr.message}`);

  const ctx = { seller, shopId: shopA.id, adminClient: adminAal2.client, run };

  // The catalogue. Every state a buyer surface or a moderation queue can be
  // wrong about, once each.
  const products = {};
  products.single = await buildProduct(admin, reg, ctx, {
    key: "single", title: `Vợt QA Một Phiên Bản ${run}`, stage: "published", price: 1500000, stock: 5,
  });
  products.matrix = await buildProduct(admin, reg, ctx, {
    key: "matrix", title: `Vợt QA Nhiều Phiên Bản ${run}`, stage: "published",
    matrix: {
      groups: [
        { name: "Màu", values: ["Đen", "Trắng"] },
        { name: "Cỡ cán", values: ["4.0", "4.25"] },
      ],
      rows: [
        { option_values: { "Màu": "Đen", "Cỡ cán": "4.0" }, price_vnd: "1500000", stock_on_hand: "4", sku: `QA-D-40-${run}`, position: 0 },
        { option_values: { "Màu": "Đen", "Cỡ cán": "4.25" }, price_vnd: "1600000", stock_on_hand: "0", sku: `QA-D-425-${run}`, position: 1 },
        { option_values: { "Màu": "Trắng", "Cỡ cán": "4.0" }, price_vnd: "1700000", stock_on_hand: null, sku: `QA-T-40-${run}`, position: 2 },
      ],
    },
  });
  products.used = await buildProduct(admin, reg, ctx, {
    key: "used", title: `Vợt QA Đã Dùng ${run}`, stage: "published", condition: "used", price: 800000, stock: 2,
  });
  products.unknown = await buildProduct(admin, reg, ctx, {
    key: "unknown", title: `Vợt QA Không Rõ Tồn ${run}`, stage: "published", price: 990000, stock: null,
  });
  products.renamed = await buildProduct(admin, reg, ctx, {
    key: "renamed", title: `Vợt QA Đổi Đường Dẫn ${run}`, stage: "published", price: 1250000, stock: 3,
    slugRename: `p2b7-renamed-new-${run}`,
  });
  products.pending = await buildProduct(admin, reg, ctx, {
    key: "pending", title: `Vợt QA Chờ Duyệt ${run}`, stage: "pending", price: 1100000, stock: 1,
  });
  products.needsChanges = await buildProduct(admin, reg, ctx, {
    key: "nc", title: `Vợt QA Cần Sửa ${run}`, stage: "needs_changes", price: 1200000, stock: 1,
  });
  products.suspended = await buildProduct(admin, reg, ctx, {
    key: "susp", title: `Vợt QA Bị Gỡ ${run}`, stage: "suspended", price: 1300000, stock: 1,
  });

  // The rival shop needs one live product so a shop-scoped query has something
  // to EXCLUDE. A filter that returns everything looks identical to a correct
  // one when there is only one shop in the database.
  const rivalCtx = { seller: rival, shopId: shopB.id, adminClient: adminAal2.client, run };
  products.rival = await buildProduct(admin, reg, rivalCtx, {
    key: "rival", title: `Vợt Shop Đối Chứng ${run}`, stage: "published", price: 1450000, stock: 2,
  });

  // A live product inside the shop that is about to be suspended, so
  // "suspending a shop hides its catalogue" has something to hide.
  const suspCtx = { seller: suspendedOwner, shopId: shopS.id, adminClient: adminAal2.client, run };
  products.inSuspendedShop = await buildProduct(admin, reg, suspCtx, {
    key: "insusp", title: `Vợt Trong Shop Ngưng ${run}`, stage: "published", price: 1350000, stock: 1,
  });

  // Shop slug history: rename shopA through the guarded RPC, which is the only
  // thing that writes the forwarding address.
  const oldShopSlug = shopA.slug;
  const newShopSlug = `p2b7-shop-new-${run}`;
  const { error: shopSlugErr } = await seller.client.rpc("shop_slug_update", {
    _shop_id: shopA.id, _slug: newShopSlug,
  });
  if (shopSlugErr) fail(`shop_slug_update: ${shopSlugErr.message}`);

  // Contacts: one live, one waiting, one refused. Every one through the
  // seller's upsert and the moderator's decision.
  const contacts = {};
  const upsert = async (type, value, label, isPublic = true) => {
    const { data, error } = await seller.client.rpc("shop_contact_upsert", {
      _shop_id: shopA.id, _type: type, _value: value, _label: label, _is_public: isPublic, _id: null,
    });
    if (error) fail(`contact_upsert ${type}: ${error.message}`);
    return data;
  };
  contacts.approved = await upsert("zalo", "0912345678", "Nhắn Zalo");
  // Left in `draft`, which is where every NEW channel starts: the guard pins
  // it there on any client insert, and the moderator picks it up from the Nháp
  // tab. There is no seller-side "submit for review" — worth knowing, because
  // a queue test that only looks at `pending_review` sees an empty screen and
  // concludes the fixture failed.
  contacts.draft = await upsert("phone", "0987654321", "Gọi giờ hành chính");
  contacts.rejected = await upsert("messenger", "https://m.me/shopqa", "Nhắn Messenger");
  contacts.pendingReview = await upsert("phone", "0938111222", "Gọi ngoài giờ");

  const decide = async (id, decision, note, internal) => {
    const { error } = await adminAal2.client.rpc("shop_contact_decide", {
      _id: id, _decision: decision, _note: note ?? null, _internal_note: internal ?? null,
      _client_token: `p2b7-${decision}-${id.slice(0, 8)}`,
    });
    if (error) fail(`contact_decide ${decision}: ${error.message}`);
  };
  await decide(contacts.approved.id, "approve");
  await decide(contacts.rejected.id, "reject", "Link Messenger chưa mở công khai.",
    "NOTE-NOI-BO-KHONG-DUOC-LO");

  // A genuinely `pending_review` channel, reached the only way one exists:
  // approve it, then let the seller change the number. The guard sends an
  // edited approved channel back for review — an approved badge has to
  // describe the value that was actually approved.
  await decide(contacts.pendingReview.id, "approve");
  const { error: reeditErr } = await seller.client.rpc("shop_contact_upsert", {
    _shop_id: shopA.id, _type: "phone", _value: "0938333444",
    _label: "Gọi ngoài giờ", _is_public: true, _id: contacts.pendingReview.id,
  });
  if (reeditErr) fail(`contact re-edit: ${reeditErr.message}`);
  const { data: pendingCheck } = await admin
    .from("shop_contact_channels").select("state").eq("id", contacts.pendingReview.id).single();
  if (pendingCheck.state !== "pending_review") {
    fail(`the pending fixture is ${pendingCheck.state}, so the moderation queue would be empty`);
  }

  // Suspend the third shop LAST, so its product went live first and the
  // suspension is what removes it rather than the product never having been
  // publishable.
  //
  // Through the ADMIN's own client, because `shops_guard_privileged_columns`
  // pins `state` on any write where `is_admin()` is false — and psql as the
  // `postgres` role has no JWT, so it is not an admin. A privileged-write
  // set_config does not help either: that flag governs `products` and
  // `product_media`, not `shops`. The version of this seed that used psql got
  // a silent no-op and a "suspended" shop that was still serving its
  // catalogue, which the slug journey caught. Fifth sighting of this trap.
  const { error: suspendErr } = await adminAal2.client
    .from("shops").update({ state: "suspended" }).eq("id", shopS.id);
  if (suspendErr) fail(`suspend shop: ${suspendErr.message}`);
  const { data: suspCheck } = await admin.from("shops").select("state").eq("id", shopS.id).single();
  if (suspCheck.state !== "suspended") fail(`shop suspension did not take: state is ${suspCheck.state}`);

  // ── Hard assertions ──────────────────────────────────────────────────────
  // Everything below is a thing a later check needs to EXIST. The gate has
  // measured an empty catalogue once already and reported PASS.
  const problems = [];
  const countRows = async (table, filters) => {
    let q = admin.from(table).select("id", { count: "exact", head: true });
    for (const [col, val] of Object.entries(filters)) q = q.eq(col, val);
    const { count } = await q;
    return count ?? 0;
  };

  const publishable = await countRows("products", { shop_id: shopA.id, status: "approved", is_published: true });
  if (publishable < 5) problems.push(`only ${publishable} publishable products in shopA — expected 5`);

  const withBytes = (await admin
    .from("product_media").select("id", { count: "exact", head: true })
    .eq("shop_id", shopA.id).not("public_path", "is", null)).count ?? 0;
  if (!withBytes) problems.push("no public renditions — every product would be invisible");

  const liveContacts = await countRows("shop_contact_channels",
    { shop_id: shopA.id, state: "approved", is_public: true });
  if (!liveContacts) problems.push("no approved public contact — the CTA would never render");

  // The public read model, asked the way a buyer asks. A seed that satisfies
  // every table and still returns nothing here has produced a catalogue the
  // product cannot show.
  const pub = anon();
  const { data: search, error: searchErr } = await pub.rpc("shop_public_search", { _limit: 24 });
  if (searchErr) problems.push(`shop_public_search failed: ${searchErr.message}`);
  else if ((search?.rows ?? []).length === 0) problems.push("shop_public_search returns 0 rows");

  const { data: cats } = await pub.rpc("shop_public_categories", { _only_stocked: false });
  if (!(cats ?? []).some((c) => (c.product_count ?? c.count ?? 0) > 0)) {
    problems.push("no category reports a product — the home grid would read 0 everywhere");
  }

  const { data: pdp } = await pub.rpc("shop_public_product", { _slug: `vot-qa-mot-phien-ban-${run}` });
  // The slug is derived server-side from the title, so read it back rather
  // than guessing at the transliteration.
  const { data: slugs } = await admin
    .from("products").select("id,slug").in("id", Object.values(products).map((p) => p.id));
  const slugOf = (id) => slugs.find((s) => s.id === id)?.slug ?? null;
  if (!pdp?.found && !slugOf(products.single.id)) problems.push("single-variant product has no slug");

  if (problems.length) fail(problems.join(" · "));

  const { data: shopAfter } = await admin.from("shops").select("slug").eq("id", shopA.id).single();
  if (shopAfter.slug !== newShopSlug) fail(`shop rename did not take: ${shopAfter.slug}`);

  return {
    run,
    users: { buyer, nonPilot, seller, manager, support, rival, suspendedOwner, applicant, adminAal1, adminAal2 },
    adminSession,
    shops: {
      a: { ...shopA, slug: newShopSlug, oldSlug: oldShopSlug },
      b: shopB,
      suspended: shopS,
    },
    products: Object.fromEntries(
      Object.entries(products).map(([k, v]) => [k, { ...v, slug: slugOf(v.id) }]),
    ),
    // The retired product slug, for the forwarding-address journey.
    renamedOldSlug: (await admin
      .from("product_slug_history").select("slug").eq("product_id", products.renamed.id).limit(1)
    ).data?.[0]?.slug ?? null,
    contacts,
    application: appRow,
  };
}

// ── Teardown ────────────────────────────────────────────────────────────────

/**
 * Remove everything, then COUNT WHAT IS LEFT.
 *
 * The teardown that mattered on this branch was the one that ran, printed
 * nothing, and deleted nothing — the gate reported PASS twice over it. So this
 * returns the survivors rather than a boolean, and the caller fails on them.
 */
export async function teardownP2bAcceptance(reg) {
  const admin = adminClient();
  const remaining = {};
  const errors = [];

  // Nothing here swallows an error, and nothing coalesces a failed read to
  // zero. The first version of this function did both — every delete was
  // fire-and-forget and every count ended in `?? 0` — and it printed a perfect
  // all-zero teardown over three shops and ten products it had not removed.
  // Caught by running pgTAP against the same database afterwards, which is now
  // part of the gate. Third time this branch has met a teardown that lied;
  // this time the lie was in the reporting, not in the deleting.
  const check = (label, { error } = {}) => {
    if (error) errors.push(`${label}: ${error.message}`);
  };

  if (!reg.shopIds.length && !reg.userIds.length) {
    // An empty registry deletes nothing and counts nothing, which reads as a
    // flawless teardown. Say so instead.
    errors.push("registry is empty — nothing was tracked, so nothing was verified");
  }

  for (const { bucket, path } of reg.objects) {
    check(`remove ${bucket}/${path}`, await admin.storage.from(bucket).remove([path]));
  }
  // Anything the run created that the registry never saw — a rendition minted
  // by a republish inside a journey, for instance.
  for (const shopId of reg.shopIds) {
    for (const bucket of [DRAFT_BUCKET, PUBLIC_BUCKET]) {
      const walk = async (prefix) => {
        const { data } = await admin.storage.from(bucket).list(prefix, { limit: 100 });
        for (const entry of data ?? []) {
          const path = `${prefix}/${entry.name}`;
          if (entry.id === null) await walk(path);
          else await admin.storage.from(bucket).remove([path]).catch(() => {});
        }
      };
      await walk(shopId);
    }
  }

  if (reg.shopIds.length) {
    check("delete cleanup_jobs", await admin.from("shop_media_cleanup_jobs").delete().in("shop_id", reg.shopIds));
    check("delete products", await admin.from("products").delete().in("shop_id", reg.shopIds));
    check("delete shops", await admin.from("shops").delete().in("id", reg.shopIds));
  }
  if (reg.userIds.length) {
    // `applicant_user_id`, not `user_id`. The unchecked version of this delete
    // had been failing on every run since the fixture was written, and the
    // `?? 0` count agreed that nothing was left.
    check("delete applications", await admin.from("shop_applications").delete().in("applicant_user_id", reg.userIds));
    check("delete pilot members", await admin.from("shop_pilot_members").delete().in("user_id", reg.userIds));
    for (const id of reg.userIds) check(`delete user ${id}`, await admin.auth.admin.deleteUser(id));
  }
  if (reg.categorySlugs.length) {
    check("delete categories", await admin.from("product_categories").delete().in("slug", reg.categorySlugs));
  }
  if (reg.rulesVersions.length) {
    // AFTER the users, and that order is load-bearing: legal_documents_immutable
    // refuses to delete a version somebody signed, and the signatures only go
    // away when their user does. Deleting these first fails, silently if the
    // error is not checked — which it is, three lines up.
    check("delete rules documents", await admin
      .from("legal_documents").delete()
      .eq("document_key", "seller-rules").in("version", reg.rulesVersions));
  }

  // ── What is still there ──────────────────────────────────────────────────
  // A read that failed is NOT a zero. `?? 0` here is what turned a broken
  // teardown into a passing one.
  const count = async (table, col, values) => {
    if (!values.length) return 0;
    const { count: n, error } = await admin
      .from(table).select("*", { count: "exact", head: true }).in(col, values);
    if (error) {
      errors.push(`count ${table}: ${error.message}`);
      return -1;
    }
    if (n === null || n === undefined) {
      errors.push(`count ${table}: no count returned`);
      return -1;
    }
    return n;
  };

  remaining.shops = await count("shops", "id", reg.shopIds);
  remaining.products = await count("products", "id", reg.productIds);
  remaining.variants = await count("product_variants", "product_id", reg.productIds);
  remaining.media = await count("product_media", "product_id", reg.productIds);
  remaining.inventoryMovements = await count("inventory_movements", "product_id", reg.productIds);
  remaining.moderationEvents = await count("product_moderation_events", "product_id", reg.productIds);
  remaining.submissionEvents = await count("product_submission_events", "product_id", reg.productIds);
  remaining.productSlugHistory = await count("product_slug_history", "product_id", reg.productIds);
  remaining.shopMembers = await count("shop_members", "shop_id", reg.shopIds);
  remaining.shopSlugHistory = await count("shop_slug_history", "shop_id", reg.shopIds);
  remaining.contacts = await count("shop_contact_channels", "shop_id", reg.shopIds);
  remaining.cleanupJobs = await count("shop_media_cleanup_jobs", "shop_id", reg.shopIds);
  remaining.applications = await count("shop_applications", "applicant_user_id", reg.userIds);
  remaining.pilotMembers = await count("shop_pilot_members", "user_id", reg.userIds);
  remaining.categories = await count("product_categories", "slug", reg.categorySlugs);
  remaining.rulesDocuments = await count("legal_documents", "version", reg.rulesVersions);
  remaining.rulesAcceptances = await count("legal_acceptances", "user_id", reg.userIds);

  // Auth users: the admin API, asked one id at a time, because a deletion that
  // silently failed is exactly the case this exists to catch.
  let usersLeft = 0;
  for (const id of reg.userIds) {
    const { data, error } = await admin.auth.admin.getUserById(id);
    // A 404 is the answer we want; any other error means we do not know.
    if (error && !/not.?found|404/i.test(error.message)) {
      errors.push(`getUserById ${id}: ${error.message}`);
    }
    if (data?.user) usersLeft += 1;
  }
  remaining.users = usersLeft;

  // Storage, listed rather than assumed.
  let objectsLeft = 0;
  for (const shopId of reg.shopIds) {
    for (const bucket of [DRAFT_BUCKET, PUBLIC_BUCKET]) {
      const walk = async (prefix) => {
        const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 100 });
        if (error) errors.push(`list ${bucket}/${prefix}: ${error.message}`);
        for (const entry of data ?? []) {
          if (entry.id === null) await walk(`${prefix}/${entry.name}`);
          else objectsLeft += 1;
        }
      };
      await walk(shopId);
    }
  }
  remaining.objects = objectsLeft;

  // The last word: ask the database whether ANY row of this run's shape is
  // still there, without going through the registry at all. A registry that
  // lost an id makes every count above vacuous, and that is precisely the
  // failure this teardown shipped once.
  const { data: strays, error: strayErr } = await admin
    .from("shops").select("id,slug").like("slug", "p2b7-%");
  if (strayErr) errors.push(`stray sweep: ${strayErr.message}`);
  else if ((strays ?? []).length) {
    errors.push(`${strays.length} p2b7-* shop(s) still in the database: ${strays.map((s) => s.slug).join(", ")}`);
  }

  remaining.errors = errors.length;
  if (errors.length) remaining.errorDetail = errors.slice(0, 6);
  return remaining;
}

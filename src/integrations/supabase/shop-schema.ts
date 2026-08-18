// ============================================================================
// Shop marketplace — hand-written row/RPC shapes.
// ----------------------------------------------------------------------------
// TEMPORARY BY DESIGN. `npx supabase gen types` reads the REMOTE schema, and
// migration 20260811090000 has deliberately not been applied to production, so
// the generated `Database` type cannot know these tables yet.
//
// When the migration lands:
//   1. run the canonical command from CLAUDE.md
//   2. delete this file
//   3. drop the `shopDb` cast in src/hooks/shop/*
//
// `src/lib/__tests__/shop-schema-parity.test.ts` asserts the table and RPC
// names here match the migration, so the two cannot drift while both exist.
// ============================================================================

import type { ApplicationStatus } from "@/lib/shop/applicationState";
import type { OptionGroup } from "@/lib/shop/variantMatrix";

export type ShopState =
  | "pending_activation"
  | "active"
  | "restricted"
  | "suspended"
  | "closed";

export type ShopMemberRole = "owner" | "manager" | "fulfillment" | "support";

/** Columns of `public.my_shop_application` — the applicant-facing view.
 *  `internal_note` is absent from the view, not merely unselected. */
export interface MyShopApplicationRow {
  id: string;
  applicant_user_id: string;
  status: ApplicationStatus;
  seller_type: string | null;
  full_name: string | null;
  phone: string | null;
  shop_name: string | null;
  shop_intro: string | null;
  pickup_address: string | null;
  city: string | null;
  applicant_note: string | null;
  requested_fields: string[];
  submitted_at: string | null;
  decided_at: string | null;
  shop_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Admin view of the same row — adds the moderator-only column. */
export interface ShopApplicationRow extends MyShopApplicationRow {
  internal_note: string | null;
  decided_by: string | null;
}

export interface ShopApplicationEventRow {
  id: string;
  application_id: string;
  actor_user_id: string | null;
  actor_kind: "applicant" | "admin" | "system";
  event:
    | "created"
    | "submitted"
    | "withdrawn"
    | "requested_changes"
    | "approved"
    | "rejected"
    | "resubmitted";
  note: string | null;
  created_at: string;
}

export interface ShopRow {
  id: string;
  slug: string;
  name: string;
  state: ShopState;
  owner_user_id: string;
  city: string | null;
  intro: string | null;
  verified_method: "giay-phep-kinh-doanh" | "gap-truc-tiep" | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  /* ── step 3 (migration 20260811180000) ── */
  primary_category_slug: string | null;
  region: string | null;
  shipping_note: string | null;
  return_note: string | null;
  /** Optimistic-concurrency token. Bumped by trigger; never sent as an edit. */
  version: number;
  /* ── Phase 3 (migration 20260818100000) ── */
  /** D1 — the platform's kill switch, pinned by shops_guard_privileged_columns
   *  for anybody who is not an admin. false = no new orders. */
  ordering_enabled: boolean;
  /** D3 — flat fee, all provinces, snapshotted onto the order. 0 is free. */
  shipping_fee_vnd: number;
}

export type ShopContactType = "zalo" | "messenger" | "phone";

export type ShopContactState =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "disabled";

/** D2: a declared public contact channel. Public only when is_public AND
 *  state=approved AND the shop is active — all three, checked in Postgres. */
export interface ShopContactChannelRow {
  id: string;
  shop_id: string;
  type: ShopContactType;
  /** What the seller typed. Shown back to them, never used as the link. */
  value_raw: string;
  /** Server-derived. The only value any public surface may use. */
  value_normalized: string;
  display_label: string | null;
  is_public: boolean;
  state: ShopContactState;
  review_note: string | null;
  approved_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ProductCategoryRow {
  slug: string;
  name_vi: string;
  name_en: string;
  sort_order: number;
  is_active: boolean;
}

export type ProductStatus =
  | "draft"
  | "pending_review"
  | "needs_changes"
  | "approved"
  | "rejected"
  | "archived";

export type ProductCondition = "new" | "used";

export interface ProductRow {
  id: string;
  shop_id: string;
  /** Globally unique. Moves only through product_slug_update. */
  slug: string;
  title: string;
  description: string | null;
  category_slug: string | null;
  condition: ProductCondition;
  status: ProductStatus;
  is_published: boolean;
  in_stock: boolean;
  availability_updated_at: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  /** What the moderator told the seller. `internal_note` is admin-only and is
   *  never selected by a seller-facing query. */
  applicant_note: string | null;
  requested_fields: string[];
  /** Optimistic-concurrency token. Bumped by trigger; never sent as an edit. */
  version: number;
  /** The client's create idempotency key. Read-only after insert. */
  client_token: string | null;
  /** [{"name":"Màu sắc","values":["Trắng","Đen"]}] in DISPLAY order. Empty for
   *  a product with no options. Written only by the reconcile RPC. */
  option_groups: OptionGroup[];
  created_at: string;
  updated_at: string;
}

/** Price and stock live here, always — including for a product with no options,
 *  which still has exactly one of these. */
export interface ProductVariantRow {
  id: string;
  product_id: string;
  shop_id: string;
  name: string | null;
  sku: string | null;
  /** VND is an integer currency. Never a float, never a formatted string. */
  price_vnd: number;
  compare_at_price_vnd: number | null;
  /** Units ON HAND. NULL = the seller does not count this one, which is not
   *  the same as 0 = sold out. Not "available": Phase 3 adds stock_reserved
   *  and computes available = on_hand - reserved. */
  stock_on_hand: number | null;
  /** {"Màu sắc":"Trắng"} — an object, so a value is addressed by its group and
   *  never by a position. NULL on the single default variant. */
  option_values: Record<string, string> | null;
  /** Canonical, order-independent combination identity, derived by Postgres. */
  option_key: string | null;
  /** Retired by the seller. Distinct from `archived`, which mirrors the
   *  PRODUCT's status and is rewritten every time that status moves. */
  retired_at: string | null;
  /** Photo that shows THIS variant, or NULL to fall back to the product's main
   *  image. Composite FK, so it can only name a photo of its own product. */
  media_id: string | null;
  position: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductMediaRow {
  id: string;
  product_id: string;
  shop_id: string;
  draft_path: string;
  /** The client-processed WebP the worker copies. Never public itself. */
  rendition_source_path: string | null;
  public_path: string | null;
  state: "draft" | "approved";
  alt_text: string | null;
  /** Display metadata only — sanitised, and never part of an object key. */
  original_filename: string | null;
  content_type: string | null;
  byte_size: number | null;
  width: number | null;
  height: number | null;
  /** Set by product_media_finalize once both objects were checked against
   *  storage.objects. Unverified media cannot be submitted or published. */
  verified_at: string | null;
  version: number;
  /** Position 0 IS the main image. There is no is_primary column. */
  position: number;
}

export type ShopMediaPurpose = "logo" | "cover";

/** Shop logo and cover. Same lifecycle and same buckets as product media,
 *  under `<shop_id>/profile/<purpose>/v<n>/`. */
export interface ShopProfileMediaRow {
  id: string;
  shop_id: string;
  purpose: ShopMediaPurpose;
  draft_path: string;
  rendition_source_path: string;
  public_path: string | null;
  content_type: string | null;
  byte_size: number | null;
  width: number | null;
  height: number | null;
  original_filename: string | null;
  /** Cover framing, 0..1. A number, so the original is never cropped away. */
  focal_y: number;
  version: number;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A product as the seller list renders it: the row plus the two child sets it
 *  summarises. PostgREST returns embedded resources under the table name. */
export interface SellerProductRow extends ProductRow {
  product_variants: Pick<
    ProductVariantRow,
    "id" | "price_vnd" | "stock_on_hand" | "position" | "sku" | "retired_at"
  >[];
  product_media: Pick<ProductMediaRow, "id" | "position" | "public_path" | "draft_path">[];
}

/**
 * The canonical projection: what a product looks like to somebody looking at
 * it. Produced by product_public_projection(), which the seller preview reads
 * today and the public PDP reads in P2b — the only difference is the flag.
 *
 * Fields the projection deliberately does NOT carry: internal_note,
 * client_token, variants_token, draft paths, cleanup jobs, the inventory
 * ledger, and any signed URL.
 */
export interface ProductProjection {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  condition: ProductCondition;
  category: { slug: string; name: string } | null;
  shop: {
    slug: string;
    name: string;
    region: string | null;
    /** A check somebody did, stated as such — never a quality claim. */
    verified: boolean;
    shipping_note: string | null;
    return_note: string | null;
    /** D1 — false hides the quantity box and the buy button, and is the same
     *  flag shop_order_create refuses on. Added by migration 20260818120000;
     *  not optional, because "the projection did not say" is not a state the
     *  screen should have to guess about. */
    ordering_enabled: boolean;
    /** D3 — 0 renders as "Miễn phí", never as "0đ". */
    shipping_fee_vnd: number;
  };
  option_groups: OptionGroup[];
  variants: {
    id: string;
    option_values: Record<string, string> | null;
    option_key: string | null;
    sku: string | null;
    price_vnd: number;
    /** Derived by the server, so both surfaces agree what "còn hàng" means. */
    availability: "in_stock" | "out_of_stock" | "unknown";
    /** Seller-only; null for the public reader. */
    stock_on_hand: number | null;
    media_id: string | null;
  }[];
  media: {
    id: string;
    alt_text: string | null;
    position: number;
    /** The processed rendition. Never the original, never a signed URL. */
    path: string | null;
    public_path: string | null;
    width: number | null;
    height: number | null;
  }[];
  primary_media_id: string | null;
  in_stock: boolean;
  availability_updated_at: string | null;
  /** Seller-only fields — null for the public reader. */
  status: ProductStatus | null;
  is_published: boolean;
  shop_state: ShopState | null;
  applicant_note: string | null;
  version: number | null;
  is_preview: boolean;
}

/** Objects added by the P2a migrations, checked by the same parity test. */
export const SHOP_P2A_TABLES = [
  "product_categories",
  "products",
  "product_variants",
  "product_media",
  "shop_media_cleanup_jobs",
  "shop_contact_channels",
  "inventory_movements",
  "shop_profile_media",
  "product_submission_events",
] as const;

export const SHOP_P2A_RPCS = [
  "product_submit_for_review",
  "product_decide",
  "product_set_published",
  "product_media_upload_init",
  "product_media_finalize",
  "product_publish_prepare",
  "shop_profile_update",
  "shop_slug_update",
  "shop_contact_upsert",
  "shop_contact_delete",
  "shop_contact_decide",
  "shop_contact_normalize",
  /* ── step 7 (migration 20260811230000) ── */
  "product_public_projection",
  "product_submit_preflight",
  "product_submit",
  "product_edit_sections",
  /* ── step 6 (migration 20260811220000) ── */
  "product_media_reorder",
  "product_variant_set_media",
  "shop_profile_media_upload_init",
  "shop_profile_media_finalize",
  "shop_profile_media_set_focal",
  "shop_profile_media_delete",
  /* ── step 5 (migration 20260811210000) ── */
  "product_variants_reconcile",
  "product_variant_adjust_stock",
  "product_option_groups_valid",
  "product_option_key",
  /* ── step 4 (migration 20260811200000) ── */
  "product_create",
  "product_update",
  "product_slug_update",
  "product_unarchive",
  "product_status_counts",
] as const;

/** Table + RPC names, exported so the parity test can compare them to the SQL. */
export const SHOP_TABLES = [
  "shop_pilot_members",
  "shops",
  "shop_members",
  "shop_applications",
  "shop_application_events",
] as const;

export const SHOP_VIEWS = ["my_shop_application", "shop_applications_admin"] as const;

export const SHOP_RPCS = [
  "shop_pilot_has_access",
  "is_shop_member",
  "shop_application_submit",
  "shop_application_withdraw",
  "shop_application_decide",
] as const;

/* ── P2b step 1 — moderation backend (migrations 202608120900/091000) ────────
 * Registered here for the same reason as the P2a lists: the parity test reads
 * them back out and fails if a name here has no migration behind it, so the
 * admin screens in P2b.2 cannot call an RPC that does not exist.
 */
export const SHOP_P2B_TABLES = [
  "product_moderation_events",
  "product_slug_history",
  /* Q6 (migration 20260812120000) */
  "shop_contact_moderation_events",
] as const;

export const SHOP_P2B_PUBLIC_RPCS = [
  /* P2b.3 — the public read model (migration 20260813090000). Not one of
   * these takes a privilege flag; that is asserted in pgTAP, and listed here
   * so a new public RPC has to be added deliberately. */
  "shop_product_is_publishable",
  "shop_public_search",
  "shop_public_product",
  "shop_public_contacts",
  "shop_public_contacts_for_product",
  "shop_public_shop",
  "shop_public_categories",
] as const;

export const SHOP_P2B_RPCS = [
  "product_moderation_targets_check",
  "product_approve_preflight",
  "product_decide",
  "product_moderation_history",
  "product_moderation_queue",
  "product_moderation_detail",
  "shop_contact_value_is_safe",
  "shop_contact_decide",
  "shop_contact_moderation_queue",
  "product_slug_update",
] as const;

/* ── Seller rules — versioned document + acceptance (migration 20260814090000) ─
 * Product Owner decision 2026-08-12 #5. The submit RPC now refuses until the
 * server has seen an acceptance of the effective version, so these names are
 * registered here for the same reason as the others: the parity test fails if
 * one of them has no migration behind it.
 */

/** The version currently on offer. `body` is the text a seller must be shown
 *  before the checkbox may be enabled — not a summary of it. */
export interface SellerRulesDocument {
  document_key: string;
  version: string;
  /** Which programme this version governs. The pilot's rules are not the public
   *  launch's rules, and the column is what stops v1 being reused by default. */
  scope: "closed-pilot" | "public";
  title: string;
  body: string;
  content_hash: string;
  effective_at: string;
  /** Both null means DRAFT — and a draft is never served, so the UI will not
   *  see one through legal_current_document(). */
  approved_by: string | null;
  approved_at: string | null;
}

/** What `legal_accept` hands back. The hash is the SERVER's copy: it is what a
 *  moderator later checks the signature against. */
export interface SellerRulesReceipt {
  ok: true;
  replayed: boolean;
  document_key: string;
  version: string;
  content_hash: string;
  accepted_at: string;
}

/** `shop_application_rules_receipt` — answers "did they accept the version in
 *  force", not "have they ever accepted anything". `accepted: false` with
 *  `reason: "stale_version"` is the case worth rendering carefully: they did
 *  sign, just not this. */
export type SellerRulesReceiptView =
  | {
      accepted: true;
      title: string;
      version: string;
      content_hash: string;
      accepted_at: string;
    }
  | {
      accepted: false;
      reason: "no_effective_version" | "never_accepted" | "stale_version";
      current_version?: string;
      accepted_version?: string | null;
      accepted_at?: string | null;
    };

export const SHOP_RULES_TABLES = ["legal_documents", "legal_acceptances"] as const;

export const SHOP_RULES_RPCS = [
  "legal_current_document",
  "legal_accept",
  "shop_application_rules_receipt",
] as const;

/* ── Phase 3 — cart and orders (migrations 20260818090000 / 20260818100000) ──
 * Same contract as the lists above: the parity test reads these back out and
 * fails if a name here has no migration behind it, so the P3 screens cannot
 * call a table or an RPC that does not exist.
 */

export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

export type OrderAction = "confirm" | "ship" | "deliver" | "cancel";

/** Both behave identically as far as status is concerned (D2). `bank_transfer`
 *  means "the shop will send you its details" — there is no bank column, no QR
 *  and no reconciliation anywhere in Phase 3. */
export type PaymentMethod = "cod" | "bank_transfer";

/** Why a cart line cannot be bought right now. `null` means it can. */
export type CartLineUnavailableReason =
  | "product_unavailable"
  | "variant_retired"
  | "out_of_stock"
  | "shop_inactive"
  | "ordering_disabled";

export interface ShopCartItemRow {
  id: string;
  /** DEFAULT auth.uid(); the client has no INSERT privilege on this column. */
  user_id: string;
  variant_id: string;
  qty: number;
  created_at: string;
  updated_at: string;
}

/** One line of `shop_cart_view()`. Note what is NOT here: no reference price
 *  and no `price_changed` flag (§B.S5). `unit_price_vnd` is the CURRENT price,
 *  and price drift is caught once, at shop_order_create. */
export interface CartLine {
  cart_item_id: string;
  variant_id: string;
  qty: number;
  product_id: string;
  product_slug: string | null;
  product_title: string | null;
  option_values: Record<string, string> | null;
  sku: string | null;
  unit_price_vnd: number;
  line_total_vnd: number;
  /** NULL = the shop does not count this one, which is not the same as 0. */
  stock_on_hand: number | null;
  cover: {
    id: string;
    alt_text: string | null;
    public_path: string | null;
    width: number | null;
    height: number | null;
  } | null;
  unavailable_reason: CartLineUnavailableReason | null;
}

export interface CartGroup {
  shop: {
    slug: string;
    name: string;
    state: ShopState;
    /** D1 — false hides "add to cart" and makes shop_order_create refuse. */
    ordering_enabled: boolean;
    /** D3 — 0 renders as "Miễn phí", never as "0đ". */
    shipping_fee_vnd: number;
  };
  lines: CartLine[];
}

/**
 * `shop_orders`, as a client may read it.
 *
 * `buyer_user_id`, `client_token` and `cancelled_by` are absent because they
 * are not granted: REVOKE ALL then a column list that omits all three. The
 * seller identifies the buyer from the snapshotted name and phone, never from
 * an account id — and `cancelled_by` is an account id too, so the timeline
 * says who cancelled with `metadata->>'actor_kind'` instead.
 */
export interface ShopOrderRow {
  id: string;
  /** PH-YYMM-XXXX, random tail — a sequential one would leak the shop's volume. */
  code: string;
  shop_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  recipient_name: string;
  recipient_phone: string;
  /** One free-text field (D4). There is no province dropdown. */
  shipping_address: string;
  delivery_note: string | null;
  items_total_vnd: number;
  shipping_fee_vnd: number;
  /** GENERATED ALWAYS AS (items + shipping) STORED. Never sent by a client. */
  total_vnd: number;
  /** Seller-side working tool only (D6). No countdown for the buyer, no job. */
  confirm_due_at: string;
  tracking_code: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

/** Immutable snapshot: the order stays readable after the product is renamed,
 *  repriced or taken down. No client may write these. */
export interface ShopOrderItemRow {
  id: string;
  order_id: string;
  shop_id: string;
  product_id: string;
  variant_id: string;
  qty: number;
  product_title: string;
  variant_label: string | null;
  sku: string | null;
  unit_price_vnd: number;
  /** GENERATED ALWAYS AS (qty * unit_price_vnd) STORED. */
  line_total_vnd: number;
  created_at: string;
}

/** Append-only. No notify_key and no client_token: idempotency lives on
 *  shop_orders and in the guarded UPDATE. */
export interface ShopOrderEventRow {
  id: string;
  order_id: string;
  shop_id: string;
  /** A snapshot of who acted — no FK, so closing an account cannot fail on it. */
  actor_user_id: string | null;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  action: OrderAction | "create";
  metadata: Record<string, unknown>;
  created_at: string;
}

/** What shop_order_create and shop_order_transition hand back. */
export interface ShopOrderDetail extends Omit<ShopOrderRow, "shop_id"> {
  shop: { slug: string; name: string; state: ShopState };
  items: Omit<ShopOrderItemRow, "order_id" | "shop_id" | "created_at">[];
  events: Pick<
    ShopOrderEventRow,
    "id" | "action" | "from_status" | "to_status" | "metadata" | "created_at"
  >[];
}

export const SHOP_P3_TABLES = [
  "shop_cart_items",
  "shop_orders",
  "shop_order_items",
  "shop_order_events",
] as const;

export const SHOP_P3_RPCS = [
  "shop_cart_view",
  "shop_order_create",
  "shop_order_transition",
  "shop_order_json",
  "shop_order_is_party",
  /* ── 20260818120000 ── */
  "shop_last_shipping_address",
] as const;

/** `my_shop_orders` is a VIEW, not a table: shop_orders' policy admits every
 *  party to an order, and "Đơn của tôi" means the buyer's own. The view puts
 *  auth.uid() in the WHERE, which the client cannot do — buyer_user_id is not
 *  granted, so it is neither selectable nor filterable. */
export const SHOP_P3_VIEWS = ["my_shop_orders"] as const;

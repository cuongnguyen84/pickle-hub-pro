// ============================================================================
// Shop prototype — deterministic fixtures (F01)
// ----------------------------------------------------------------------------
// Board Rule 4: nothing invented that a real system would have to back up.
// So: NO ratings, NO "sold 1.2k", NO discount %, NO delivery-time promises,
// NO stock counts we could not actually know. Where a marketplace normally
// shows a trust number, this prototype shows a fact it can prove instead
// ("Shop mở từ 03/2026", "3 sản phẩm đang bán") or shows nothing.
//
// Every value below is a literal. No Math.random, no Date.now — two runs of
// the screenshot harness must produce byte-identical screens.
// ============================================================================

import type { Scenario } from "./scenario";

/** Fixed "today" for the whole prototype so relative dates never drift. */
export const PROTO_NOW = new Date("2026-08-10T09:00:00+07:00");

// ─── Types ──────────────────────────────────────────────────────────────────

export type ShopState =
  | "draft"
  | "pending_activation"
  | "active"
  | "suspended"
  | "closed";

export interface ProtoShop {
  id: string;
  slug: string;
  name: string;
  /** What we can actually prove about the seller — never a badge we invented. */
  verifiedMethod: "giay-phep-kinh-doanh" | "gap-truc-tiep" | null;
  verifiedAt: string | null;
  state: ShopState;
  city: string;
  openedAt: string;
  /** Free-text policy the seller wrote. Empty string = seller has not written one. */
  returnPolicy: string;
  shippingNote: string;
  productCount: number;
  logoInitials: string;
}

export type ProductStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "needs_changes"
  | "restricted"
  | "archived";

export interface ProtoVariantOption {
  name: string;
  values: string[];
}

export interface ProtoVariant {
  id: string;
  /** Values in the same order as `optionNames` on the product. */
  values: string[];
  sku: string;
  priceVnd: number;
  /** null = seller has not tracked stock for this variant. */
  stock: number | null;
  mediaIndex: number;
}

export interface ProtoProduct {
  id: string;
  slug: string;
  shopId: string;
  title: string;
  category: CategorySlug;
  condition: "moi" | "da-qua-su-dung";
  status: ProductStatus;
  /** Base price shown when no variant is selected. */
  priceVnd: number;
  /** Set when variants span a range. */
  priceMaxVnd: number | null;
  optionNames: string[];
  variants: ProtoVariant[];
  /** Media are colour+label placeholders — the prototype ships no stock photos. */
  media: { label: string; tone: string }[];
  attributes: { label: string; value: string }[];
  description: string;
  shippingFromCity: string;
  /** "" = seller has not set a return window; UI must say so, not guess. */
  returnWindow: string;
  moderationNote?: string;
}

export type CategorySlug =
  | "vot"
  | "giay"
  | "bong"
  | "tui-balo"
  | "grip-phu-kien"
  | "trang-phuc";

export interface ProtoCategory {
  slug: CategorySlug;
  name: string;
  nameEn: string;
}

export interface ProtoCartLine {
  productId: string;
  variantId: string | null;
  qty: number;
  /** Set when the fixture wants the "price changed since you added it" state. */
  priceWhenAddedVnd?: number;
  issue?: "out-of-stock" | "price-changed" | "seller-unavailable";
}

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "needs_changes"
  | "approved"
  | "rejected"
  | "withdrawn";

export interface ProtoApplication {
  id: string;
  status: ApplicationStatus;
  sellerType: "ca-nhan" | "ho-kinh-doanh" | "cong-ty";
  shopName: string;
  submittedAt: string | null;
  /** Admin-visible only. Never rendered on an applicant screen. */
  internalNote: string;
  /** Shown to the applicant verbatim. */
  applicantNote: string;
  completedSteps: number;
  documents: { label: string; state: "missing" | "uploaded" | "rejected" }[];
}

export type OrderStatus =
  | "cho-thanh-toan"
  | "dang-xu-ly"
  | "dang-giao"
  | "da-giao"
  | "da-huy"
  | "tra-hang"
  | "khieu-nai"
  | "da-hoan-tien";

export interface ProtoOrder {
  code: string;
  shopId: string;
  status: OrderStatus;
  placedAt: string;
  paymentMethod: "cod" | "vietqr";
  /** VietQR is manually reconciled — the UI must never imply auto-verification. */
  paymentConfirmedAt: string | null;
  lines: { productId: string; variantId: string | null; qty: number; unitVnd: number }[];
  shippingVnd: number;
  address: ProtoAddress;
  timeline: { at: string; label: string; by: "buyer" | "seller" | "admin" | "system" }[];
  /** Deadline the *seller* owes an action by, when one exists. */
  sellerDeadline: string | null;
  trackingCode: string | null;
}

export interface ProtoAddress {
  name: string;
  phone: string;
  line: string;
  ward: string;
  district: string;
  city: string;
}

export interface ProtoDispute {
  id: string;
  orderCode: string;
  reason: string;
  stage: "cho-nguoi-ban" | "cho-nguoi-mua" | "admin-xem-xet" | "xong-nguoi-mua" | "xong-nguoi-ban";
  openedAt: string;
  deadline: string | null;
  entries: {
    at: string;
    by: "buyer" | "seller" | "admin";
    text: string;
    evidence?: string[];
  }[];
  outcome: string | null;
}

export interface ProtoReturn {
  id: string;
  orderCode: string;
  eligible: boolean;
  ineligibleReason: string | null;
  reasons: { key: string; label: string; needsEvidence: boolean }[];
}

// ─── Categories ─────────────────────────────────────────────────────────────

export const CATEGORIES: ProtoCategory[] = [
  { slug: "vot", name: "Vợt pickleball", nameEn: "Paddles" },
  { slug: "giay", name: "Giày", nameEn: "Shoes" },
  { slug: "bong", name: "Bóng", nameEn: "Balls" },
  { slug: "tui-balo", name: "Túi & balo", nameEn: "Bags" },
  { slug: "grip-phu-kien", name: "Grip & phụ kiện", nameEn: "Grips & accessories" },
  { slug: "trang-phuc", name: "Trang phục", nameEn: "Apparel" },
];

// ─── Shops ──────────────────────────────────────────────────────────────────

export const SHOPS: ProtoShop[] = [
  {
    id: "shop-1",
    slug: "pickle-gear-sai-gon",
    name: "Pickle Gear Sài Gòn",
    verifiedMethod: "giay-phep-kinh-doanh",
    verifiedAt: "2026-06-18",
    state: "active",
    city: "TP. Hồ Chí Minh",
    openedAt: "2026-06-18",
    returnPolicy:
      "Đổi trả trong 7 ngày nếu sản phẩm còn nguyên tem, chưa qua sử dụng. Người mua chịu phí gửi trả.",
    shippingNote: "Gửi từ Quận 7, TP.HCM. Đóng gói trong ngày làm việc.",
    productCount: 6,
    logoInitials: "PG",
  },
  {
    id: "shop-2",
    slug: "san-nha-pickleball-ha-noi",
    name: "Sân Nhà Pickleball Hà Nội",
    verifiedMethod: "gap-truc-tiep",
    verifiedAt: "2026-07-02",
    state: "active",
    city: "Hà Nội",
    openedAt: "2026-07-02",
    returnPolicy: "",
    shippingNote: "Gửi từ Cầu Giấy, Hà Nội.",
    productCount: 3,
    logoInitials: "SN",
  },
  {
    id: "shop-3",
    slug: "vot-cu-da-nang",
    name: "Vợt Cũ Đà Nẵng — mua bán vợt pickleball đã qua sử dụng",
    verifiedMethod: null,
    verifiedAt: null,
    state: "suspended",
    city: "Đà Nẵng",
    openedAt: "2026-07-21",
    returnPolicy: "Không hỗ trợ đổi trả với hàng đã qua sử dụng.",
    shippingNote: "Gửi từ Hải Châu, Đà Nẵng.",
    productCount: 2,
    logoInitials: "VC",
  },
  {
    id: "shop-4",
    slug: "shop-moi-duyet",
    name: "Pickle Lab",
    verifiedMethod: "gap-truc-tiep",
    verifiedAt: "2026-08-09",
    state: "active",
    city: "TP. Hồ Chí Minh",
    openedAt: "2026-08-09",
    returnPolicy: "",
    shippingNote: "",
    productCount: 0,
    logoInitials: "PL",
  },
];

export const shopById = (id: string): ProtoShop =>
  SHOPS.find((s) => s.id === id) ?? SHOPS[0];
export const shopBySlug = (slug: string): ProtoShop | undefined =>
  SHOPS.find((s) => s.slug === slug);

// ─── Products ───────────────────────────────────────────────────────────────

const paddleAttrs = (o: {
  weight: string;
  thickness: string;
  face: string;
  core: string;
  shape: string;
  grip: string;
  style: string;
}) => [
  { label: "Trọng lượng", value: o.weight },
  { label: "Độ dày mặt vợt", value: o.thickness },
  { label: "Chất liệu mặt", value: o.face },
  { label: "Lõi", value: o.core },
  { label: "Dáng vợt", value: o.shape },
  { label: "Chu vi cán", value: o.grip },
  { label: "Lối chơi phù hợp", value: o.style },
];

export const PRODUCTS: ProtoProduct[] = [
  {
    id: "p-1",
    slug: "vot-carbon-16mm-control",
    shopId: "shop-1",
    title: "Vợt pickleball carbon T700 16mm — dòng control cho người chơi trình độ 3.5 trở lên",
    category: "vot",
    condition: "moi",
    status: "active",
    priceVnd: 2_450_000,
    priceMaxVnd: null,
    optionNames: [],
    variants: [
      { id: "p-1-v0", values: [], sku: "PG-CT16-STD", priceVnd: 2_450_000, stock: 4, mediaIndex: 0 },
    ],
    media: [
      { label: "Mặt vợt", tone: "a" },
      { label: "Cán vợt", tone: "b" },
      { label: "Cạnh vợt", tone: "c" },
    ],
    attributes: paddleAttrs({
      weight: "8.0 oz (227 g)",
      thickness: "16 mm",
      face: "Carbon sợi T700 (raw)",
      core: "Polymer tổ ong",
      shape: "Tiêu chuẩn",
      grip: "10.8 cm",
      style: "Control / dink",
    }),
    description:
      "Vợt mặt carbon nhám, độ dày 16mm cho cảm giác bóng bám lâu, phù hợp lối chơi kiểm soát ở khu bếp. Hàng nhập, còn nguyên seal.",
    shippingFromCity: "TP. Hồ Chí Minh",
    returnWindow: "7 ngày",
  },
  {
    id: "p-2",
    slug: "giay-pickleball-court-pro",
    shopId: "shop-1",
    title: "Giày pickleball Court Pro — đế bám sân cứng",
    category: "giay",
    condition: "moi",
    status: "active",
    priceVnd: 1_290_000,
    priceMaxVnd: 1_390_000,
    optionNames: ["Màu", "Size"],
    variants: [
      { id: "p-2-v1", values: ["Trắng", "39"], sku: "PG-CP-W39", priceVnd: 1_290_000, stock: 2, mediaIndex: 0 },
      { id: "p-2-v2", values: ["Trắng", "40"], sku: "PG-CP-W40", priceVnd: 1_290_000, stock: 0, mediaIndex: 0 },
      { id: "p-2-v3", values: ["Trắng", "41"], sku: "PG-CP-W41", priceVnd: 1_290_000, stock: 5, mediaIndex: 0 },
      { id: "p-2-v4", values: ["Đen", "39"], sku: "PG-CP-B39", priceVnd: 1_390_000, stock: 1, mediaIndex: 1 },
      { id: "p-2-v5", values: ["Đen", "40"], sku: "PG-CP-B40", priceVnd: 1_390_000, stock: 3, mediaIndex: 1 },
      { id: "p-2-v6", values: ["Đen", "41"], sku: "PG-CP-B41", priceVnd: 1_390_000, stock: 0, mediaIndex: 1 },
    ],
    media: [
      { label: "Bản trắng", tone: "b" },
      { label: "Bản đen", tone: "c" },
    ],
    attributes: [
      { label: "Đế", value: "Cao su non, gân xương cá" },
      { label: "Mũi giày", value: "Có ốp chống mài" },
      { label: "Trọng lượng", value: "≈ 340 g (size 40)" },
      { label: "Bề mặt phù hợp", value: "Sân cứng ngoài trời" },
    ],
    description:
      "Giày sân cứng, phần mũi có ốp chống mài khi trượt chân. Size theo bảng size châu Á, nếu bàn chân bè nên tăng nửa size.",
    shippingFromCity: "TP. Hồ Chí Minh",
    returnWindow: "7 ngày",
  },
  {
    id: "p-3",
    slug: "vot-da-qua-su-dung-6-thang",
    shopId: "shop-3",
    title: "Vợt đã qua sử dụng ~6 tháng, mặt còn nhám",
    category: "vot",
    condition: "da-qua-su-dung",
    status: "active",
    priceVnd: 950_000,
    priceMaxVnd: null,
    optionNames: [],
    variants: [
      { id: "p-3-v0", values: [], sku: "VC-U6M-01", priceVnd: 950_000, stock: 1, mediaIndex: 0 },
    ],
    media: [
      { label: "Tổng thể", tone: "c" },
      { label: "Vết xước cạnh", tone: "a" },
    ],
    attributes: paddleAttrs({
      weight: "8.2 oz (232 g)",
      thickness: "13 mm",
      face: "Fiberglass",
      core: "Polymer tổ ong",
      shape: "Thon dài",
      grip: "10.5 cm",
      style: "Tấn công",
    }),
    description:
      "Dùng khoảng 6 tháng, mỗi tuần 2 buổi. Cạnh vợt có vết xước do va sân (xem ảnh 2). Mặt vợt còn nhám, chưa bị bong.",
    shippingFromCity: "Đà Nẵng",
    returnWindow: "",
  },
  {
    id: "p-4",
    slug: "bong-thi-dau-ngoai-troi-hop-6",
    shopId: "shop-2",
    title: "Bóng thi đấu ngoài trời — hộp 6 quả",
    category: "bong",
    condition: "moi",
    status: "active",
    priceVnd: 320_000,
    priceMaxVnd: null,
    optionNames: [],
    variants: [
      { id: "p-4-v0", values: [], sku: "SN-BALL6", priceVnd: 320_000, stock: null, mediaIndex: 0 },
    ],
    media: [{ label: "Hộp 6 quả", tone: "a" }],
    attributes: [
      { label: "Số lỗ", value: "40" },
      { label: "Dùng cho", value: "Sân ngoài trời" },
      { label: "Số lượng", value: "6 quả / hộp" },
    ],
    description: "Bóng nhựa cứng dùng cho sân ngoài trời. Bán theo hộp 6 quả.",
    shippingFromCity: "Hà Nội",
    returnWindow: "3 ngày",
  },
  {
    id: "p-5",
    slug: "tui-vot-3-ngan",
    shopId: "shop-2",
    title: "Túi đựng vợt 3 ngăn, có ngăn giày riêng",
    category: "tui-balo",
    condition: "moi",
    status: "active",
    priceVnd: 690_000,
    priceMaxVnd: null,
    optionNames: [],
    variants: [
      { id: "p-5-v0", values: [], sku: "SN-BAG3", priceVnd: 690_000, stock: 7, mediaIndex: 0 },
    ],
    media: [
      { label: "Mặt trước", tone: "b" },
      { label: "Ngăn giày", tone: "a" },
    ],
    attributes: [
      { label: "Số ngăn", value: "3" },
      { label: "Sức chứa", value: "2–3 vợt" },
      { label: "Ngăn giày", value: "Có, tách riêng" },
    ],
    description: "Túi 3 ngăn, ngăn giày tách riêng có lỗ thoát khí. Quai đeo chéo tháo rời được.",
    shippingFromCity: "Hà Nội",
    returnWindow: "7 ngày",
  },
  {
    id: "p-6",
    slug: "overgrip-set-3",
    shopId: "shop-1",
    title: "Overgrip thấm hút — set 3 cuộn",
    category: "grip-phu-kien",
    condition: "moi",
    status: "active",
    priceVnd: 120_000,
    priceMaxVnd: null,
    optionNames: ["Màu"],
    variants: [
      { id: "p-6-v1", values: ["Đen"], sku: "PG-OG-BK", priceVnd: 120_000, stock: 12, mediaIndex: 0 },
      { id: "p-6-v2", values: ["Trắng"], sku: "PG-OG-WH", priceVnd: 120_000, stock: 9, mediaIndex: 0 },
    ],
    media: [{ label: "Set 3 cuộn", tone: "c" }],
    attributes: [
      { label: "Số lượng", value: "3 cuộn" },
      { label: "Độ dày", value: "0.6 mm" },
    ],
    description: "Overgrip mỏng, bề mặt nhám nhẹ. Set 3 cuộn cùng màu.",
    shippingFromCity: "TP. Hồ Chí Minh",
    returnWindow: "7 ngày",
  },
  // ── Non-active statuses, for the seller + admin screens ──────────────────
  {
    id: "p-7",
    slug: "vot-nhap-khau-cho-duyet",
    shopId: "shop-1",
    title: "Vợt nhập khẩu bản giới hạn 2026",
    category: "vot",
    condition: "moi",
    status: "pending_review",
    priceVnd: 3_900_000,
    priceMaxVnd: null,
    optionNames: [],
    variants: [
      { id: "p-7-v0", values: [], sku: "PG-LTD26", priceVnd: 3_900_000, stock: 2, mediaIndex: 0 },
    ],
    media: [{ label: "Mặt vợt", tone: "a" }],
    attributes: paddleAttrs({
      weight: "7.9 oz",
      thickness: "14 mm",
      face: "Carbon",
      core: "Polymer",
      shape: "Tiêu chuẩn",
      grip: "10.8 cm",
      style: "All-court",
    }),
    description: "Bản giới hạn, số lượng ít.",
    shippingFromCity: "TP. Hồ Chí Minh",
    returnWindow: "7 ngày",
  },
  {
    id: "p-8",
    slug: "vot-can-sua-mo-ta",
    shopId: "shop-1",
    title: "Vợt tập cho người mới",
    category: "vot",
    condition: "moi",
    status: "needs_changes",
    priceVnd: 550_000,
    priceMaxVnd: null,
    optionNames: [],
    variants: [
      { id: "p-8-v0", values: [], sku: "PG-BEG", priceVnd: 550_000, stock: 20, mediaIndex: 0 },
    ],
    media: [{ label: "Mặt vợt", tone: "b" }],
    attributes: [{ label: "Trọng lượng", value: "8.4 oz" }],
    description: "Vợt tập.",
    shippingFromCity: "TP. Hồ Chí Minh",
    returnWindow: "7 ngày",
    moderationNote:
      "Ảnh sản phẩm bị mờ và có chèn số điện thoại. Vui lòng thay bằng ảnh chụp rõ mặt vợt, không chèn thông tin liên hệ.",
  },
  {
    id: "p-9",
    slug: "ao-thi-dau-nhai-thuong-hieu",
    shopId: "shop-3",
    title: "Áo thi đấu in logo giải quốc tế",
    category: "trang-phuc",
    condition: "moi",
    status: "restricted",
    priceVnd: 180_000,
    priceMaxVnd: null,
    optionNames: [],
    variants: [
      { id: "p-9-v0", values: [], sku: "VC-TEE", priceVnd: 180_000, stock: 30, mediaIndex: 0 },
    ],
    media: [{ label: "Mặt trước", tone: "c" }],
    attributes: [{ label: "Chất liệu", value: "Polyester" }],
    description: "Áo in logo giải.",
    shippingFromCity: "Đà Nẵng",
    returnWindow: "",
    moderationNote: "Nghi ngờ sử dụng nhãn hiệu không được phép. Đã ẩn khỏi trang mua hàng.",
  },
  {
    id: "p-10",
    slug: "vot-nhap-nhap",
    shopId: "shop-1",
    title: "(Chưa đặt tên)",
    category: "vot",
    condition: "moi",
    status: "draft",
    priceVnd: 0,
    priceMaxVnd: null,
    optionNames: [],
    variants: [{ id: "p-10-v0", values: [], sku: "", priceVnd: 0, stock: null, mediaIndex: 0 }],
    media: [],
    attributes: [],
    description: "",
    shippingFromCity: "TP. Hồ Chí Minh",
    returnWindow: "",
  },
  {
    id: "p-11",
    slug: "bong-trong-nha-ngung-ban",
    shopId: "shop-1",
    title: "Bóng trong nhà — hộp 3 quả",
    category: "bong",
    condition: "moi",
    status: "archived",
    priceVnd: 180_000,
    priceMaxVnd: null,
    optionNames: [],
    variants: [
      { id: "p-11-v0", values: [], sku: "PG-IND3", priceVnd: 180_000, stock: 0, mediaIndex: 0 },
    ],
    media: [{ label: "Hộp 3 quả", tone: "a" }],
    attributes: [{ label: "Số lỗ", value: "26" }],
    description: "Bóng trong nhà.",
    shippingFromCity: "TP. Hồ Chí Minh",
    returnWindow: "7 ngày",
  },
];

export const productById = (id: string): ProtoProduct =>
  PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0];
export const productBySlug = (slug: string): ProtoProduct | undefined =>
  PRODUCTS.find((p) => p.slug === slug);
export const variantById = (p: ProtoProduct, id: string | null): ProtoVariant | null =>
  id ? (p.variants.find((v) => v.id === id) ?? null) : null;

/** Products a buyer may see: active status AND shop not suspended/closed. */
export const buyableProducts = (): ProtoProduct[] =>
  PRODUCTS.filter(
    (p) => p.status === "active" && ["active"].includes(shopById(p.shopId).state),
  );

// ─── Addresses ──────────────────────────────────────────────────────────────

export const ADDRESSES: ProtoAddress[] = [
  {
    name: "Nguyễn Thị Thanh Hương",
    phone: "0901 234 567",
    line: "Số 12, ngõ 43 đường Nguyễn Văn Linh",
    ward: "Phường Tân Phú",
    district: "Quận 7",
    city: "TP. Hồ Chí Minh",
  },
  {
    name: "Trần Minh Quân",
    phone: "0987 654 321",
    line: "Tầng 4, toà nhà B, 155 Cầu Giấy",
    ward: "Phường Quan Hoa",
    district: "Quận Cầu Giấy",
    city: "Hà Nội",
  },
];

// ─── Cart ───────────────────────────────────────────────────────────────────

export const CART_BY_SCENARIO: Record<Scenario, ProtoCartLine[]> = {
  normal: [
    { productId: "p-1", variantId: "p-1-v0", qty: 1 },
    { productId: "p-2", variantId: "p-2-v3", qty: 1 },
    { productId: "p-4", variantId: "p-4-v0", qty: 2 },
  ],
  empty: [],
  slow: [{ productId: "p-1", variantId: "p-1-v0", qty: 1 }],
  error: [{ productId: "p-1", variantId: "p-1-v0", qty: 1 }],
  suspended: [
    { productId: "p-1", variantId: "p-1-v0", qty: 1 },
    { productId: "p-3", variantId: "p-3-v0", qty: 1, issue: "seller-unavailable" },
  ],
  unavailable: [
    { productId: "p-2", variantId: "p-2-v2", qty: 1, issue: "out-of-stock" },
    { productId: "p-4", variantId: "p-4-v0", qty: 1, priceWhenAddedVnd: 290_000, issue: "price-changed" },
  ],
  denied: [{ productId: "p-1", variantId: "p-1-v0", qty: 1 }],
};

// ─── Seller application ─────────────────────────────────────────────────────

export const APPLICATIONS: Record<ApplicationStatus, ProtoApplication> = {
  draft: {
    id: "app-draft",
    status: "draft",
    sellerType: "ca-nhan",
    shopName: "Pickle Gear Sài Gòn",
    submittedAt: null,
    internalNote: "",
    applicantNote: "",
    completedSteps: 3,
    documents: [
      { label: "Ảnh mặt trước CCCD", state: "uploaded" },
      { label: "Ảnh mặt sau CCCD", state: "missing" },
    ],
  },
  submitted: {
    id: "app-1",
    status: "submitted",
    sellerType: "ho-kinh-doanh",
    shopName: "Pickle Gear Sài Gòn",
    submittedAt: "2026-08-08T14:20:00+07:00",
    internalNote: "",
    applicantNote: "",
    completedSteps: 6,
    documents: [
      { label: "Giấy phép hộ kinh doanh", state: "uploaded" },
      { label: "Ảnh mặt trước CCCD", state: "uploaded" },
      { label: "Ảnh mặt sau CCCD", state: "uploaded" },
    ],
  },
  under_review: {
    id: "app-2",
    status: "under_review",
    sellerType: "cong-ty",
    shopName: "Sân Nhà Pickleball Hà Nội",
    submittedAt: "2026-08-07T09:05:00+07:00",
    internalNote: "Tên trên GPKD khác tên shop — đã hỏi qua Zalo, chờ trả lời.",
    applicantNote: "",
    completedSteps: 6,
    documents: [
      { label: "Giấy chứng nhận đăng ký doanh nghiệp", state: "uploaded" },
      { label: "Ảnh mặt trước CCCD người đại diện", state: "uploaded" },
      { label: "Ảnh mặt sau CCCD người đại diện", state: "uploaded" },
    ],
  },
  needs_changes: {
    id: "app-3",
    status: "needs_changes",
    sellerType: "ho-kinh-doanh",
    shopName: "Vợt Cũ Đà Nẵng",
    submittedAt: "2026-08-06T16:40:00+07:00",
    internalNote: "Ảnh GPKD chụp thiếu góc dưới, không đọc được số.",
    applicantNote:
      "Ảnh giấy phép kinh doanh bị thiếu phần dưới nên không đọc được số đăng ký. Anh/chị chụp lại đủ 4 góc, để giấy phẳng và đủ sáng giúp mình nhé.",
    completedSteps: 6,
    documents: [
      { label: "Giấy phép hộ kinh doanh", state: "rejected" },
      { label: "Ảnh mặt trước CCCD", state: "uploaded" },
      { label: "Ảnh mặt sau CCCD", state: "uploaded" },
    ],
  },
  approved: {
    id: "app-4",
    status: "approved",
    sellerType: "ho-kinh-doanh",
    shopName: "Pickle Gear Sài Gòn",
    submittedAt: "2026-06-15T11:00:00+07:00",
    internalNote: "Gặp trực tiếp tại sân Tân Phú 18/06.",
    applicantNote: "",
    completedSteps: 6,
    documents: [
      { label: "Giấy phép hộ kinh doanh", state: "uploaded" },
      { label: "Ảnh mặt trước CCCD", state: "uploaded" },
      { label: "Ảnh mặt sau CCCD", state: "uploaded" },
    ],
  },
  rejected: {
    id: "app-5",
    status: "rejected",
    sellerType: "ca-nhan",
    shopName: "Shop bán vợt fake",
    submittedAt: "2026-08-01T08:00:00+07:00",
    internalNote: "Ảnh sản phẩm lấy từ shop khác, mô tả ghi rõ hàng rep 1:1.",
    applicantNote:
      "Hồ sơ chưa được duyệt vì sản phẩm dự kiến bán vi phạm quy định về hàng giả, hàng nhái. Anh/chị có thể nộp lại hồ sơ với danh mục sản phẩm khác.",
    completedSteps: 6,
    documents: [{ label: "Ảnh mặt trước CCCD", state: "uploaded" }],
  },
  withdrawn: {
    id: "app-6",
    status: "withdrawn",
    sellerType: "ca-nhan",
    shopName: "(đã rút hồ sơ)",
    submittedAt: "2026-07-28T10:00:00+07:00",
    internalNote: "",
    applicantNote: "",
    completedSteps: 4,
    documents: [],
  },
};

export const APPLICATION_QUEUE: ProtoApplication[] = [
  APPLICATIONS.submitted,
  APPLICATIONS.under_review,
  APPLICATIONS.needs_changes,
  APPLICATIONS.rejected,
  APPLICATIONS.withdrawn,
];

// ─── Orders ─────────────────────────────────────────────────────────────────

export const ORDERS: ProtoOrder[] = [
  {
    code: "PH-2608-0041",
    shopId: "shop-1",
    status: "cho-thanh-toan",
    placedAt: "2026-08-10T08:12:00+07:00",
    paymentMethod: "vietqr",
    paymentConfirmedAt: null,
    lines: [{ productId: "p-1", variantId: "p-1-v0", qty: 1, unitVnd: 2_450_000 }],
    shippingVnd: 35_000,
    address: ADDRESSES[0],
    timeline: [
      { at: "2026-08-10T08:12:00+07:00", label: "Người mua đặt đơn", by: "buyer" },
      { at: "2026-08-10T08:12:00+07:00", label: "Chờ người mua chuyển khoản", by: "system" },
    ],
    sellerDeadline: null,
    trackingCode: null,
  },
  {
    code: "PH-2608-0039",
    shopId: "shop-1",
    status: "dang-xu-ly",
    placedAt: "2026-08-09T19:30:00+07:00",
    paymentMethod: "cod",
    paymentConfirmedAt: null,
    lines: [
      { productId: "p-2", variantId: "p-2-v3", qty: 1, unitVnd: 1_290_000 },
      { productId: "p-6", variantId: "p-6-v1", qty: 2, unitVnd: 120_000 },
    ],
    shippingVnd: 35_000,
    address: ADDRESSES[0],
    timeline: [
      { at: "2026-08-09T19:30:00+07:00", label: "Người mua đặt đơn", by: "buyer" },
      { at: "2026-08-09T21:04:00+07:00", label: "Người bán xác nhận đơn", by: "seller" },
    ],
    sellerDeadline: "2026-08-11T19:30:00+07:00",
    trackingCode: null,
  },
  {
    code: "PH-2608-0031",
    shopId: "shop-2",
    status: "dang-giao",
    placedAt: "2026-08-06T10:00:00+07:00",
    paymentMethod: "vietqr",
    paymentConfirmedAt: "2026-08-06T13:22:00+07:00",
    lines: [{ productId: "p-5", variantId: "p-5-v0", qty: 1, unitVnd: 690_000 }],
    shippingVnd: 30_000,
    address: ADDRESSES[1],
    timeline: [
      { at: "2026-08-06T10:00:00+07:00", label: "Người mua đặt đơn", by: "buyer" },
      { at: "2026-08-06T13:22:00+07:00", label: "Quản trị viên xác nhận đã nhận chuyển khoản", by: "admin" },
      { at: "2026-08-07T09:15:00+07:00", label: "Người bán đã gửi hàng", by: "seller" },
    ],
    sellerDeadline: null,
    trackingCode: "VN0293841772",
  },
  {
    code: "PH-2607-0018",
    shopId: "shop-2",
    status: "da-giao",
    placedAt: "2026-07-28T15:40:00+07:00",
    paymentMethod: "cod",
    paymentConfirmedAt: "2026-07-30T11:10:00+07:00",
    lines: [{ productId: "p-4", variantId: "p-4-v0", qty: 2, unitVnd: 320_000 }],
    shippingVnd: 30_000,
    address: ADDRESSES[1],
    timeline: [
      { at: "2026-07-28T15:40:00+07:00", label: "Người mua đặt đơn", by: "buyer" },
      { at: "2026-07-29T08:00:00+07:00", label: "Người bán đã gửi hàng", by: "seller" },
      { at: "2026-07-30T11:10:00+07:00", label: "Đã giao, người mua thanh toán khi nhận", by: "system" },
    ],
    sellerDeadline: null,
    trackingCode: "VN0293800112",
  },
  {
    code: "PH-2607-0009",
    shopId: "shop-1",
    status: "da-huy",
    placedAt: "2026-07-20T09:00:00+07:00",
    paymentMethod: "vietqr",
    paymentConfirmedAt: null,
    lines: [{ productId: "p-6", variantId: "p-6-v2", qty: 1, unitVnd: 120_000 }],
    shippingVnd: 35_000,
    address: ADDRESSES[0],
    timeline: [
      { at: "2026-07-20T09:00:00+07:00", label: "Người mua đặt đơn", by: "buyer" },
      { at: "2026-07-22T09:00:00+07:00", label: "Huỷ do quá hạn chuyển khoản 48 giờ", by: "system" },
    ],
    sellerDeadline: null,
    trackingCode: null,
  },
  {
    code: "PH-2607-0022",
    shopId: "shop-1",
    status: "tra-hang",
    placedAt: "2026-07-25T14:00:00+07:00",
    paymentMethod: "vietqr",
    paymentConfirmedAt: "2026-07-25T16:30:00+07:00",
    lines: [{ productId: "p-2", variantId: "p-2-v5", qty: 1, unitVnd: 1_390_000 }],
    shippingVnd: 35_000,
    address: ADDRESSES[0],
    timeline: [
      { at: "2026-07-25T14:00:00+07:00", label: "Người mua đặt đơn", by: "buyer" },
      { at: "2026-07-26T08:30:00+07:00", label: "Người bán đã gửi hàng", by: "seller" },
      { at: "2026-07-29T17:00:00+07:00", label: "Đã giao", by: "system" },
      { at: "2026-07-30T20:15:00+07:00", label: "Người mua yêu cầu trả hàng: sai size", by: "buyer" },
    ],
    sellerDeadline: "2026-08-02T20:15:00+07:00",
    trackingCode: "VN0293799001",
  },
  {
    code: "PH-2607-0025",
    shopId: "shop-3",
    status: "khieu-nai",
    placedAt: "2026-07-26T11:20:00+07:00",
    paymentMethod: "vietqr",
    paymentConfirmedAt: "2026-07-26T12:00:00+07:00",
    lines: [{ productId: "p-3", variantId: "p-3-v0", qty: 1, unitVnd: 950_000 }],
    shippingVnd: 40_000,
    address: ADDRESSES[1],
    timeline: [
      { at: "2026-07-26T11:20:00+07:00", label: "Người mua đặt đơn", by: "buyer" },
      { at: "2026-07-27T09:00:00+07:00", label: "Người bán đã gửi hàng", by: "seller" },
      { at: "2026-07-31T16:00:00+07:00", label: "Đã giao", by: "system" },
      { at: "2026-08-01T09:30:00+07:00", label: "Người mua mở khiếu nại: hàng không đúng mô tả", by: "buyer" },
    ],
    sellerDeadline: "2026-08-04T09:30:00+07:00",
    trackingCode: "VN0293788456",
  },
  {
    code: "PH-2606-0003",
    shopId: "shop-1",
    status: "da-hoan-tien",
    placedAt: "2026-06-30T08:00:00+07:00",
    paymentMethod: "vietqr",
    paymentConfirmedAt: "2026-06-30T09:00:00+07:00",
    lines: [{ productId: "p-1", variantId: "p-1-v0", qty: 1, unitVnd: 2_450_000 }],
    shippingVnd: 35_000,
    address: ADDRESSES[0],
    timeline: [
      { at: "2026-06-30T08:00:00+07:00", label: "Người mua đặt đơn", by: "buyer" },
      { at: "2026-07-02T10:00:00+07:00", label: "Người bán báo hết hàng", by: "seller" },
      { at: "2026-07-03T15:00:00+07:00", label: "Quản trị viên hoàn tiền 2.485.000₫", by: "admin" },
    ],
    sellerDeadline: null,
    trackingCode: null,
  },
];

export const orderByCode = (code: string): ProtoOrder =>
  ORDERS.find((o) => o.code === code) ?? ORDERS[0];

export const orderTotal = (o: ProtoOrder): number =>
  o.lines.reduce((s, l) => s + l.unitVnd * l.qty, 0) + o.shippingVnd;

// ─── Returns + disputes ─────────────────────────────────────────────────────

export const RETURNS: Record<"eligible" | "ineligible", ProtoReturn> = {
  eligible: {
    id: "ret-1",
    orderCode: "PH-2607-0018",
    eligible: true,
    ineligibleReason: null,
    reasons: [
      { key: "sai-size", label: "Sai size / không vừa", needsEvidence: false },
      { key: "khong-dung-mo-ta", label: "Không đúng mô tả", needsEvidence: true },
      { key: "hu-hong", label: "Hàng hư hỏng khi nhận", needsEvidence: true },
      { key: "thieu-hang", label: "Thiếu hàng trong kiện", needsEvidence: true },
      { key: "doi-y", label: "Đổi ý, không còn nhu cầu", needsEvidence: false },
    ],
  },
  ineligible: {
    id: "ret-2",
    orderCode: "PH-2607-0025",
    eligible: false,
    ineligibleReason:
      "Người bán không nhận đổi trả với hàng đã qua sử dụng, và điều này đã hiển thị trên trang sản phẩm trước khi anh/chị đặt đơn. Anh/chị vẫn có thể mở khiếu nại nếu hàng không đúng mô tả.",
    reasons: [],
  },
};

export const DISPUTES: ProtoDispute[] = [
  {
    id: "dis-1",
    orderCode: "PH-2607-0025",
    reason: "Hàng không đúng mô tả",
    stage: "cho-nguoi-ban",
    openedAt: "2026-08-01T09:30:00+07:00",
    deadline: "2026-08-04T09:30:00+07:00",
    entries: [
      {
        at: "2026-08-01T09:30:00+07:00",
        by: "buyer",
        text: "Mô tả ghi mặt vợt còn nhám nhưng khi nhận thì mặt đã bóng, đánh bị trượt bóng. Ảnh đính kèm chụp cùng góc với ảnh đăng bán.",
        evidence: ["Ảnh mặt vợt khi nhận", "Ảnh cận bề mặt"],
      },
    ],
    outcome: null,
  },
  {
    id: "dis-2",
    orderCode: "PH-2607-0022",
    reason: "Thiếu hàng trong kiện",
    stage: "cho-nguoi-mua",
    openedAt: "2026-07-30T20:15:00+07:00",
    deadline: "2026-08-12T20:15:00+07:00",
    entries: [
      {
        at: "2026-07-30T20:15:00+07:00",
        by: "buyer",
        text: "Đặt 1 đôi giày kèm 2 cuộn overgrip nhưng kiện chỉ có giày.",
        evidence: ["Video mở kiện"],
      },
      {
        at: "2026-07-31T08:40:00+07:00",
        by: "seller",
        text: "Overgrip được gửi thành kiện thứ hai, mã VN0293799002. Nhờ anh/chị kiểm tra lại.",
        evidence: ["Ảnh biên nhận gửi hàng"],
      },
    ],
    outcome: null,
  },
  {
    id: "dis-3",
    orderCode: "PH-2606-0003",
    reason: "Người bán không phản hồi",
    stage: "admin-xem-xet",
    openedAt: "2026-07-02T10:30:00+07:00",
    deadline: null,
    entries: [
      { at: "2026-07-02T10:30:00+07:00", by: "buyer", text: "Đã chuyển khoản 3 ngày, người bán không phản hồi." },
      { at: "2026-07-03T09:00:00+07:00", by: "admin", text: "Đã liên hệ người bán qua Zalo, chưa nhận trả lời sau 24 giờ." },
    ],
    outcome: null,
  },
  {
    id: "dis-4",
    orderCode: "PH-2607-0018",
    reason: "Hàng hư hỏng khi nhận",
    stage: "xong-nguoi-mua",
    openedAt: "2026-07-30T09:00:00+07:00",
    deadline: null,
    entries: [
      { at: "2026-07-30T09:00:00+07:00", by: "buyer", text: "Hộp bóng bị móp, 2 quả nứt." },
      { at: "2026-07-30T14:00:00+07:00", by: "seller", text: "Mình gửi bù 2 quả, hoặc hoàn 1 phần tuỳ anh/chị chọn." },
      { at: "2026-07-31T10:00:00+07:00", by: "admin", text: "Hai bên đồng ý hoàn một phần 110.000₫." },
    ],
    outcome: "Hoàn một phần 110.000₫ cho người mua. Không cần gửi trả hàng.",
  },
  {
    id: "dis-5",
    orderCode: "PH-2607-0031",
    reason: "Sai phiên bản (màu/size)",
    stage: "xong-nguoi-ban",
    openedAt: "2026-07-25T09:00:00+07:00",
    deadline: null,
    entries: [
      { at: "2026-07-25T09:00:00+07:00", by: "buyer", text: "Đặt màu đen nhưng nhận màu trắng." },
      {
        at: "2026-07-25T15:00:00+07:00",
        by: "seller",
        text: "Ảnh chụp phiếu đóng gói và mã SKU trên hộp đúng với phiên bản trắng mà đơn đã chọn.",
        evidence: ["Ảnh phiếu đóng gói", "Ảnh SKU trên hộp"],
      },
      { at: "2026-07-26T11:00:00+07:00", by: "admin", text: "Đơn hàng ghi nhận phiên bản Trắng/41. Khiếu nại không có cơ sở." },
    ],
    outcome: "Giữ nguyên đơn hàng. Người mua có thể yêu cầu đổi trả theo chính sách 7 ngày của shop.",
  },
];

export const disputeById = (id: string): ProtoDispute =>
  DISPUTES.find((d) => d.id === id) ?? DISPUTES[0];

// ─── Wishlist ───────────────────────────────────────────────────────────────

export const WISHLIST_BY_SCENARIO: Record<Scenario, ProtoCartLine[]> = {
  normal: [
    { productId: "p-1", variantId: null, qty: 1 },
    { productId: "p-5", variantId: null, qty: 1 },
    { productId: "p-6", variantId: "p-6-v1", qty: 1 },
  ],
  empty: [],
  slow: [{ productId: "p-1", variantId: null, qty: 1 }],
  error: [{ productId: "p-1", variantId: null, qty: 1 }],
  suspended: [{ productId: "p-3", variantId: null, qty: 1, issue: "seller-unavailable" }],
  unavailable: [
    { productId: "p-11", variantId: null, qty: 1, issue: "out-of-stock" },
    { productId: "p-4", variantId: null, qty: 1, priceWhenAddedVnd: 290_000, issue: "price-changed" },
  ],
  denied: [],
};

// ─── Formatting helpers shared by prototype screens ─────────────────────────

export const vnd = (n: number): string => `${n.toLocaleString("vi-VN")}₫`;

/** "10/08/2026" */
export const dmy = (iso: string): string => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** "10/08/2026 08:12" */
export const dmyhm = (iso: string): string => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dmy(iso)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * Deadline phrasing relative to PROTO_NOW. Deliberately says "quá hạn" rather
 * than hiding an expired deadline — the seller screens depend on it being loud.
 */
export const untilDeadline = (iso: string): { text: string; overdue: boolean } => {
  const ms = new Date(iso).getTime() - PROTO_NOW.getTime();
  const overdue = ms < 0;
  const h = Math.round(Math.abs(ms) / 3_600_000);
  const text =
    h >= 48
      ? `${Math.round(h / 24)} ngày`
      : `${h} giờ`;
  return { text: overdue ? `quá hạn ${text}` : `còn ${text}`, overdue };
};

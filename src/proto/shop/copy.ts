// ============================================================================
// F08 — Shared copy + accessibility contract
// ----------------------------------------------------------------------------
// This is the enforceable half of F08: the glossary below is checked by
// src/proto/shop/__tests__/copy-contract.test.ts, so a screen that quietly
// reintroduces "Thanh toán thành công" or a bare "Đã xảy ra lỗi" fails CI
// instead of failing a reviewer's attention.
// ============================================================================

export interface GlossaryEntry {
  /** The approved Vietnamese term. */
  term: string;
  en: string;
  why: string;
  /** Strings that must never appear in prototype screens. */
  banned?: string[];
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "Người bán",
    en: "Seller",
    why: "Dùng thống nhất cho cả cá nhân và hộ kinh doanh. Không dùng “nhà bán hàng” (dài, dịch máy).",
    banned: ["nhà bán hàng"],
  },
  {
    term: "Shop",
    en: "Shop / store",
    why: "Người Việt chơi pickleball đã quen chữ “shop”. Không dịch thành “gian hàng”.",
    banned: ["gian hàng"],
  },
  {
    term: "Phiên bản",
    en: "Variant",
    why: "Màu/size của cùng một sản phẩm. Không dùng “biến thể” (nghe như sinh học).",
    banned: ["biến thể"],
  },
  {
    term: "Mã hàng (SKU)",
    en: "SKU",
    why: "Ghi cả hai vì người bán nhỏ chưa quen chữ SKU.",
  },
  {
    term: "Đơn hàng",
    en: "Order",
    why: "Không dùng “đơn đặt hàng” cho gọn nút.",
  },
  {
    term: "Đổi trả",
    en: "Return",
    why: "Gộp đổi và trả. “Hoàn trả” dễ nhầm với hoàn tiền.",
    banned: ["hoàn trả hàng"],
  },
  {
    term: "Khiếu nại",
    en: "Dispute",
    why: "Không dùng “tranh chấp” — nặng và mang màu pháp lý.",
    banned: ["tranh chấp"],
  },
  {
    term: "Đã xác minh",
    en: "Verified",
    why: "Chỉ nói về DANH TÍNH người bán, luôn kèm cách xác minh và ngày. Không bao giờ ngụ ý bảo đảm chất lượng hàng.",
    banned: ["uy tín", "chính hãng 100%"],
  },
  {
    term: "Chờ chuyển khoản",
    en: "Awaiting payment",
    why: "VietQR đối soát tay. Không được nói “thanh toán thành công” khi chưa có người xác nhận.",
    banned: ["thanh toán thành công", "đã thanh toán tự động"],
  },
  {
    term: "Tạm tính",
    en: "Subtotal",
    why: "Rõ là chưa gồm phí vận chuyển.",
  },
  {
    term: "Gửi từ",
    en: "Ships from",
    why: "Nói nơi gửi, không hứa ngày giao. Hệ thống chưa nối đơn vị vận chuyển nào.",
    banned: ["giao trong 24h", "giao hàng nhanh 2h", "dự kiến giao"],
  },
  {
    term: "Anh/chị",
    en: "you",
    why: "Xưng hô trung tính, hợp cả nam và nữ, không suồng sã như “bạn” trong ngữ cảnh mua bán tiền bạc.",
  },
];

/** Terms that must not appear anywhere in the prototype screens. */
export const BANNED_TERMS: string[] = GLOSSARY.flatMap((g) => g.banned ?? []);

// ─── Error copy pattern ─────────────────────────────────────────────────────

export interface ErrorCopy {
  /** What went wrong, in the user's terms. */
  what: string;
  /** Why — only when we actually know. Omit rather than guess. */
  cause?: string;
  /** What the user can do right now. Always present. */
  recovery: string;
}

export const ERROR_PATTERNS: { key: string; copy: ErrorCopy }[] = [
  {
    key: "add-to-cart-network",
    copy: {
      what: "Chưa thêm được vào giỏ.",
      cause: "Mất kết nối khi đang gửi.",
      recovery: "Sản phẩm vẫn còn trong kho, anh/chị thử lại giúp.",
    },
  },
  {
    key: "autosave-failed",
    copy: {
      what: "Chưa lưu được bản nháp lên máy chủ.",
      recovery: "Bản nháp vẫn nằm trên máy anh/chị. Đừng đóng tab, bấm Thử lại.",
    },
  },
  {
    key: "stock-changed",
    copy: {
      what: "Một sản phẩm trong giỏ vừa hết hàng.",
      cause: "Người bán cập nhật tồn kho sau khi anh/chị thêm vào giỏ.",
      recovery: "Bỏ sản phẩm đó ra để đặt phần còn lại, hoặc chọn phiên bản khác.",
    },
  },
  {
    key: "upload-too-big",
    copy: {
      what: "Ảnh vượt quá 8 MB nên chưa tải lên được.",
      recovery: "Chụp lại ở chế độ thường thay vì HDR, hoặc chọn ảnh khác.",
    },
  },
  {
    key: "permission-lost",
    copy: {
      what: "Anh/chị không còn quyền vào trang này.",
      cause: "Chủ shop đã đổi quyền của tài khoản.",
      recovery: "Liên hệ chủ shop, hoặc quay lại trang mua hàng.",
    },
  },
  {
    key: "concurrent-edit",
    copy: {
      what: "Sản phẩm này vừa được sửa ở nơi khác.",
      cause: "Một phiên đăng nhập khác đã lưu bản mới hơn.",
      recovery: "Xem bản mới trước khi ghi đè — nội dung anh/chị vừa gõ không bị mất.",
    },
  },
];

// ─── Accessible names for icon-only controls ────────────────────────────────

export const ICON_NAMES: { icon: string; name: string; note: string }[] = [
  { icon: "Giỏ hàng", name: "Giỏ hàng, {n} sản phẩm", note: "Số lượng nằm trong tên, không chỉ là badge nhìn thấy." },
  { icon: "Tim (lưu)", name: "Lưu {tên sản phẩm} / Bỏ lưu {tên sản phẩm}", note: "Kèm aria-pressed." },
  { icon: "Quay lại", name: "Quay lại", note: "" },
  { icon: "Đóng bảng lọc", name: "Đóng bộ lọc", note: "Không phải chỉ “Đóng”." },
  { icon: "Xoá chip lọc", name: "Bỏ lọc {tên bộ lọc}", note: "" },
  { icon: "Xoá từ khoá", name: "Xoá từ khoá", note: "" },
  { icon: "Tăng/giảm số lượng", name: "Tăng số lượng / Giảm số lượng", note: "" },
  { icon: "Hiện giấy tờ", name: "Hiện giấy tờ / Ẩn giấy tờ", note: "Việc mở được ghi nhật ký." },
];

// ─── Heading hierarchy + live regions ───────────────────────────────────────

export const HEADING_RULES = [
  "Mỗi màn hình có đúng MỘT <h1> — tên màn hình, không phải tên thương hiệu.",
  "Tiêu đề khu vực là <h2>. Tên sản phẩm trong lưới là <h3>.",
  "Không nhảy cấp (h1 → h3). Không dùng thẻ tiêu đề chỉ để chữ to.",
  "Thanh bản mẫu màu vàng KHÔNG chứa tiêu đề — nó là chrome, không phải nội dung.",
];

export const LIVE_REGION_RULES = [
  "Số kết quả tìm kiếm: role=status, aria-live=polite.",
  "Kết quả thêm vào giỏ / lưu nháp: role=status, aria-live=polite.",
  "Lỗi chặn thao tác (mất quyền, hết hàng khi đặt): role=alert.",
  "Thanh tiến trình tải ảnh: role=progressbar + aria-valuenow, KHÔNG đọc từng phần trăm.",
  "Không bao giờ đặt aria-live lên vùng đổi liên tục (đồng hồ đếm ngược) — sẽ đọc không ngừng.",
];

export const FOCUS_RULES = [
  "Mở bảng lọc / bảng chọn phiên bản: đưa tiêu điểm vào phần tử đầu tiên bên trong.",
  "Đóng bằng Esc hoặc nút X: trả tiêu điểm về đúng nút đã mở nó.",
  "Sau khi xoá một dòng trong giỏ: đưa tiêu điểm về nút Hoàn tác, không để rơi về <body>.",
  "Chuyển bước trong hồ sơ đăng ký: đưa tiêu điểm về tiêu đề bước mới (tabindex=-1).",
  "Không bẫy tiêu điểm ở bất kỳ đâu ngoài hộp thoại modal.",
];

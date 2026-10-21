// ============================================================================
// Postgres error → something a seller can act on.
// ----------------------------------------------------------------------------
// Two rules, and both are about what NOT to show:
//
//   * a raw Postgres string is noise to a seller and a schema disclosure to
//     everyone else, so nothing unrecognised is passed through;
//   * the RPCs already raise Vietnamese for everything a seller can cause, and
//     those messages are more specific than anything this file could invent —
//     "shop đang ở trạng thái suspended nên chưa đăng sản phẩm được" beats
//     "không lưu được". So a Vietnamese message wins over the code mapping.
// ============================================================================

import { COMPARE_AT_NOT_ABOVE } from "@/lib/shop/discount";

const VIETNAMESE = /[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềể]/i;

export function shopErrorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  const raw = e?.message ?? "";
  if (VIETNAMESE.test(raw)) return raw;
  switch (e?.code) {
    // PT409 is what the RPCs raise for a stale expected version; PostgREST maps
    // it to HTTP 409. 40001 is kept only because Postgres itself can still
    // raise a genuine serialisation failure under load.
    case "PT409":
    case "40001":
      return "Bản ghi vừa được cập nhật ở nơi khác. Tải lại để xem bản mới nhất.";
    case "23505":
      return "Giá trị này đã có nơi khác dùng.";
    case "23514":
      // Giá gốc là CHECK duy nhất người bán hay vấp; nhận dạng qua raw, câu trả
      // về không mang tên constraint.
      if (raw.includes("product_variants_compare_range")) return COMPARE_AT_NOT_ABOVE;
      // A CHECK the client mirror should have caught first. Saying which one
      // would leak the constraint name; saying nothing at all leaves the seller
      // clicking Save again.
      return "Có ô chưa hợp lệ. Kiểm tra lại giá, tồn kho và độ dài các ô chữ.";
    case "42501":
      return "Bạn không có quyền thực hiện thay đổi này.";
    case "PGRST116":
      return "Không tìm thấy bản ghi. Có thể nó vừa bị xoá hoặc ngừng bán.";
    default:
      return "Không lưu được. Thử lại giúp em.";
  }
}

// ─── Order errors: the machine-readable half ────────────────────────────────
// The order RPCs raise through shop_order_raise(), which puts a JSON object in
// DETAIL — PostgREST hands it over as `error.details`, a STRING. So the screen
// gets a Vietnamese sentence it can print (message) AND a reason it can switch
// on (details.reason) without scraping prose.
//
// Two rules here, both learned the hard way:
//   * details is not guaranteed to be JSON. Postgres raises plenty of errors
//     nobody wrote a DETAIL for, and JSON.parse on those throws inside a
//     render. Parsing is wrapped, and anything unparseable is `null`.
//   * an unknown reason gets the default sentence, never the raw string. A
//     code the client has no branch for is a code the buyer cannot act on.

/** The `reason` values shop_order_create / shop_order_transition can raise. */
export type ShopOrderReason =
  | "price_changed"
  | "shipping_fee_changed"
  | "insufficient_stock"
  | "variant_unavailable"
  | "product_unavailable"
  | "stale_status"
  | "ordering_disabled"
  | "shop_inactive"
  | "too_many_pending"
  | "forbidden"
  | "invalid_payload";

/** The parsed DETAIL, or null when there is not one. Never throws. */
export function shopErrorDetail(error: unknown): Record<string, unknown> | null {
  const raw = (error as { details?: unknown } | null)?.details;
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** The `reason`, or null. Callers switch on this; they never switch on text. */
export function shopErrorReason(error: unknown): string | null {
  const reason = shopErrorDetail(error)?.reason;
  return typeof reason === "string" && reason ? reason : null;
}

/**
 * One sentence per reason: what broke, why, what to do next.
 *
 * EN, for the day Shop joins useI18n:
 *   price_changed        — A price changed while you were filling this in. The
 *                          total below is recalculated — check it and order again.
 *   shipping_fee_changed — Shipping just changed. The total is recalculated —
 *                          check it and order again.
 *   insufficient_stock   — This item just sold out. Go back to the cart, remove
 *                          it, and order the rest.
 *   variant_unavailable  — This option is no longer for sale. Remove it from the
 *                          cart and order the rest.
 *   product_unavailable  — The shop just removed this product. Remove it from
 *                          the cart and order the rest.
 *   stale_status         — This order was just updated elsewhere. The page has
 *                          reloaded with the latest.
 *   ordering_disabled    — This shop has paused selling. Your items stay in the
 *                          cart; you can order once the shop reopens.
 *   shop_inactive        — This shop is not open right now, so it takes no
 *                          orders. Your items stay in the cart.
 *   too_many_pending     — You already have 5 orders waiting for a shop to
 *                          confirm. Wait for one, or cancel one, then order again.
 *   forbidden            — This order does not belong to the account you are
 *                          signed in with.
 *   invalid_payload      — Something in the form is not valid. Check the
 *                          delivery details and send it again.
 *   (default)            — That didn't go through. Try again in a moment.
 */
const ORDER_REASON_MESSAGE: Record<ShopOrderReason, string> = {
  price_changed:
    "Giá vừa thay đổi trong lúc anh/chị điền. Tổng bên dưới đã tính lại — xem lại rồi bấm đặt lần nữa.",
  shipping_fee_changed:
    "Phí vận chuyển vừa thay đổi. Tổng đã tính lại — xem lại rồi bấm đặt lần nữa.",
  insufficient_stock:
    "Món này vừa hết hàng. Về giỏ để bỏ món này ra rồi đặt phần còn lại.",
  variant_unavailable:
    "Phiên bản này vừa ngừng bán. Về giỏ để bỏ ra rồi đặt phần còn lại.",
  product_unavailable:
    "Shop vừa gỡ sản phẩm này. Về giỏ để bỏ ra rồi đặt phần còn lại.",
  stale_status:
    "Đơn vừa được cập nhật ở nơi khác. Trang đã tải lại số liệu mới nhất.",
  ordering_disabled:
    "Shop đang tạm ngưng bán. Sản phẩm vẫn nằm trong giỏ, anh/chị đặt được khi shop mở lại.",
  shop_inactive:
    "Shop này đang không mở bán nên chưa nhận đơn. Sản phẩm vẫn nằm trong giỏ.",
  too_many_pending:
    "Anh/chị đang có 5 đơn chờ shop xác nhận. Chờ shop xử lý xong một đơn, hoặc huỷ bớt, rồi đặt tiếp.",
  forbidden:
    "Đơn này không thuộc tài khoản đang đăng nhập. Đăng nhập đúng tài khoản rồi mở lại.",
  invalid_payload:
    "Có ô chưa hợp lệ. Kiểm tra lại thông tin nhận hàng rồi gửi lại.",
};

export const SHOP_ORDER_REASONS = Object.keys(ORDER_REASON_MESSAGE) as ShopOrderReason[];

const REASON_FALLBACK = "Chưa thực hiện được thao tác này. Anh/chị thử lại sau ít phút.";

/** The sentence for whatever the order RPC refused with. A reason this build
 *  has no branch for gets the default — never the raw code, never the SQL. */
export function shopReasonMessage(error: unknown): string {
  const reason = shopErrorReason(error);
  if (reason && reason in ORDER_REASON_MESSAGE) {
    return ORDER_REASON_MESSAGE[reason as ShopOrderReason];
  }
  return REASON_FALLBACK;
}

// ─── Edge Function errors ───────────────────────────────────────────────────
// supabase-js throws away nothing — it hands back the untouched `Response` —
// but every call site here used to drop it and show one hardcoded sentence for
// every cause. The publish leg is where that hurt: a shop that is not active,
// an expired session, a rejected rendition and a dead worker all looked the
// same to the seller AND to us. This reads the body once and answers with the
// sentence the seller can act on plus the short code they can screenshot.

const EDGE_CODE_MAX = 80;

/** What the seller sees, and the code that says which of the five it was. */
export interface EdgeErrorText {
  message: string;
  code: string;
}

const truncateCode = (code: string) =>
  code.length <= EDGE_CODE_MAX ? code : `${code.slice(0, EDGE_CODE_MAX - 1)}…`;

export async function edgeErrorMessage(
  error: unknown,
  response?: Response,
): Promise<EdgeErrorText> {
  const name = (error as { name?: string } | null)?.name ?? "";
  const status = response?.status ?? 0;

  // The Response supabase-js returns has NOT been read, so the body is still
  // there. A body that is not JSON is still evidence — keep the raw text.
  let detail = "";
  if (response) {
    try {
      const text = await response.text();
      try {
        const body = JSON.parse(text) as {
          error?: string;
          failed?: Array<{ error?: string }>;
        };
        detail = body?.error ?? body?.failed?.[0]?.error ?? text;
      } catch {
        detail = text;
      }
    } catch {
      detail = "";
    }
  }
  detail = detail.trim().slice(0, 200);

  const code = truncateCode(status ? `${status} · ${detail || name || "không rõ"}` : name || "không rõ");

  // Session first: a 401 and a JWT complaint mean the same thing to a seller,
  // and no other branch can fix it for them.
  if (status === 401 || /jwt|expired|not authenticated|invalid token/i.test(detail)) {
    return { message: "Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi bấm Thử lại giúp em.", code };
  }
  // No response at all: the request never came back — offline, DNS, or the
  // 20s abort the publish hook arms.
  if (!response || name === "AbortError" || name === "TimeoutError" || name === "FunctionsFetchError") {
    return { message: "Không kết nối được máy chủ. Kiểm tra mạng rồi bấm Thử lại.", code };
  }
  // The RPC's own Vietnamese refusal is more specific than anything here —
  // same rule as shopErrorMessage, so it is that function that decides.
  if (status === 403) {
    const passed = shopErrorMessage({ message: detail });
    if (passed === detail && detail) {
      return {
        message: `${detail} Ảnh đã lưu rồi, kích hoạt shop xong bấm lại là hiện.`,
        code,
      };
    }
  }
  // No status test: the product leg answers 422 with a top-level `error`, the
  // profile leg answers 502 with the SAME reason inside failed[0].error and
  // never 422 at all. The prefix is what identifies a photo refusal —
  // copy_failed and commit_failed are the worker's own steps and still fall
  // through to "lỗi hệ thống, thử lại", which is the truth for those two.
  if (detail.startsWith("rendition_")) {
    return { message: "Ảnh này máy chủ chưa nhận được. Thử chọn ảnh khác.", code };
  }
  return {
    message:
      "Lỗi từ phía hệ thống, không phải do ảnh của anh/chị. Em đã nhận được báo lỗi rồi, bấm Thử lại sau vài phút.",
    code,
  };
}

/** The thrown shape both publish hooks use: a normal Error for anything that
 *  only reads `.message`, with the code hung off it for the screen that shows
 *  both lines. */
export const edgeError = (text: EdgeErrorText): Error =>
  Object.assign(new Error(text.message), { code: text.code });

/** True when the save lost a race, i.e. the screen must offer a reconcile
 *  rather than a plain retry. Both spellings occur: the RPC raises 40001 with
 *  a Vietnamese message, which the mapper passes through untouched. */
export const isConflict = (error: unknown) => {
  const e = error as { code?: string; message?: string } | null;
  return (
    e?.code === "PT409" ||
    e?.code === "40001" ||
    /phiên bản|cập nhật ở nơi khác/i.test(e?.message ?? "")
  );
};

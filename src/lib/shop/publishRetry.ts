// Publish resilience for the bulk importer — pure, so it can be tested
// without dragging the whole hook (and its uncovered surface) into coverage.

/**
 * Safari reports any network-layer fetch failure as `TypeError: Load failed`
 * (Chrome: "Failed to fetch"). On mobile data a 15-product publish is ~150
 * requests including image uploads, so one dropped connection is expected,
 * not exceptional. Every write in publishRow (useBulkProductImport) carries an idempotent client
 * token, so replaying the whole row is safe.
 */
export const isTransientNetworkError = (error: unknown): boolean => {
  const message = (error as { message?: unknown })?.message;
  return (
    error instanceof TypeError
    || (typeof message === "string" && /load failed|failed to fetch|network ?error|NOT_FOUND_FUNCTION_BLOB/i.test(message))
  );
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withNetworkRetry<T>(work: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= retries || !isTransientNetworkError(error)) throw error;
      await sleep(800 * (attempt + 1));
    }
  }
}

export function publishErrorMessage(error: unknown): string {
  const detail = error as { message?: string; code?: string; details?: string; hint?: string };
  const message = detail.message ?? "";
  if (isTransientNetworkError(error)) return "Mất kết nối khi tải lên (đã tự thử lại 3 lần). Bấm Xuất bản lần nữa — sản phẩm đã lên sẽ không bị trùng.";
  if (message.includes("shop_unavailable")) return "Không tìm thấy shop đang hoạt động.";
  if (message.includes("no_products_selected")) return "Chọn ít nhất một sản phẩm đã sẵn sàng.";
  if (message.includes("invalid_product_data")) return "Tên sản phẩm, danh mục và giá bán là bắt buộc.";
  if (message.includes("product_image_required")) return "Cần một ảnh sản phẩm hợp lệ. Ảnh tìm tự động không tải được; hãy tải ảnh từ thiết bị rồi thử lại.";
  if (message.includes("product_preflight_failed")) return `Sản phẩm chưa đạt điều kiện xuất bản (${message.split(":")[1] || "dữ liệu chưa đủ"}).`;
  if (message.includes("duplicate") || message.includes("unique")) return "Có sản phẩm bị trùng. Hãy đổi tên rồi thử lại.";
  if (message.includes("row-level security") || message.includes("42501")) return "Tài khoản chưa có quyền thêm sản phẩm cho shop này.";
  if (message.includes("products_specs_shape")) return "Thông số AI có dữ liệu không hợp lệ. Hãy chạy AI lại hoặc thử xuất bản lần nữa.";
  if (message.includes("products_category_slug_fkey")) return "Danh mục sản phẩm không tồn tại trong hệ thống.";
  const diagnostic = [detail.code, message, detail.details].filter(Boolean).join(" · ");
  return diagnostic
    ? `Chưa lưu được sản phẩm: ${diagnostic}`
    : "Chưa lưu được sản phẩm. Dữ liệu chỉnh sửa vẫn còn nguyên — thử lại sau vài giây.";
}

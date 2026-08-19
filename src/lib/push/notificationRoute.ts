/**
 * Bấm vào một push thì đi đâu.
 *
 * Tách khỏi `usePushNotifications` để test khoá được — và nó cần được khoá:
 * hàm cũ điều hướng theo `data.entity_type` + `data.related_id`, nhưng **không
 * nơi nào trong dự án gửi hai khoá đó**. Grep toàn repo 19/08: không có một
 * producer nào. Nghĩa là nhánh switch ấy là mã chết, và mọi lần bấm vào push
 * đều rơi vào `if (!entityType) return;` — không mở gì cả, kể cả trang thông báo.
 *
 * Thứ các trigger DB thật sự gửi là đường dẫn: `url` (push của shop) hoặc
 * `link_url` (push đăng ký sự kiện và club admin). Nên đọc chúng trước.
 */

/** Chỉ nhận đường dẫn nội bộ. Push đến từ máy chủ, nhưng payload là dữ liệu —
 *  và một đường dẫn tuyệt đối trong dữ liệu là một open redirect chờ sẵn.
 *  `//evil.com` là đường dẫn giao thức-tương đối, trình duyệt coi là tuyệt đối. */
function internalPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

/** Luôn trả về một đường dẫn — xem ghi chú ở nhánh cuối. */
export function resolvePushRoute(data: Record<string, unknown>): string {
  const direct = internalPath(data.url) ?? internalPath(data.link_url);
  if (direct) return direct;

  const entityType = typeof data.entity_type === "string" ? data.entity_type : "";
  const relatedId = typeof data.related_id === "string" ? data.related_id : "";

  // Giữ lại hai nhánh cũ phòng khi có producer mới dùng hình dạng này.
  if ((entityType === "organization" || entityType === "tournament") && relatedId) {
    return `/live/${relatedId}`;
  }

  // Không biết đi đâu thì vẫn phải đi đâu đó: người dùng vừa chủ động bấm vào
  // một thông báo, mở trang thông báo còn hơn không phản hồi gì.
  return "/notifications";
}

import { describe, it, expect } from "vitest";
import { resolvePushRoute } from "../notificationRoute";

// Hàm cũ điều hướng theo entity_type/related_id, nhưng không producer nào
// trong dự án gửi hai khoá đó — nên mọi lần bấm vào push đều rơi vào
// `if (!entityType) return;` và không mở gì cả. File này khoá hình dạng payload
// mà các trigger DB THẬT SỰ gửi.

describe("resolvePushRoute", () => {
  it("đi theo `url` — hình dạng của push shop", () => {
    expect(
      resolvePushRoute({ type: "shop_order_new", url: "/seller/orders/PH-2026-AB12" }),
    ).toBe("/seller/orders/PH-2026-AB12");
  });

  it("đi theo `link_url` — hình dạng của push sự kiện và club admin", () => {
    expect(
      resolvePushRoute({ type: "event_registration", link_url: "/social/giai-abc/danh-sach" }),
    ).toBe("/social/giai-abc/danh-sach");
  });

  it("`url` thắng `link_url` khi có cả hai", () => {
    expect(resolvePushRoute({ url: "/a", link_url: "/b" })).toBe("/a");
  });

  // ── Chặn open redirect: payload là dữ liệu, không phải mã ────────────────
  it("từ chối đường dẫn tuyệt đối", () => {
    expect(resolvePushRoute({ url: "https://evil.example/x" })).toBe("/notifications");
  });

  it("từ chối đường dẫn giao thức-tương đối", () => {
    // `//evil.example` trình duyệt coi là tuyệt đối — đây là bẫy hay bị bỏ sót.
    expect(resolvePushRoute({ url: "//evil.example/x" })).toBe("/notifications");
  });

  it("từ chối chuỗi không bắt đầu bằng /", () => {
    expect(resolvePushRoute({ link_url: "javascript:alert(1)" })).toBe("/notifications");
  });

  it("bỏ qua giá trị không phải chuỗi", () => {
    expect(resolvePushRoute({ url: 42 })).toBe("/notifications");
  });

  // ── Hai nhánh cũ vẫn giữ ──────────────────────────────────────────────────
  it("giữ nhánh organization/tournament nếu có producer dùng lại", () => {
    expect(resolvePushRoute({ entity_type: "tournament", related_id: "t1" })).toBe("/live/t1");
    expect(resolvePushRoute({ entity_type: "organization", related_id: "o1" })).toBe("/live/o1");
  });

  it("entity_type có nhưng thiếu related_id thì không dựng đường dẫn cụt", () => {
    expect(resolvePushRoute({ entity_type: "tournament" })).toBe("/notifications");
  });

  // ── Luôn phải đi đâu đó ───────────────────────────────────────────────────
  it("payload rỗng vẫn mở trang thông báo, không im lặng", () => {
    // Đây chính là hành vi cũ bị thiếu: người dùng vừa chủ động bấm, mà app
    // không phản hồi gì.
    expect(resolvePushRoute({})).toBe("/notifications");
  });
});

// The three branches of activateErrorMessage — the strings a moderator reads
// when shop_activate refuses. Matched on substrings of the RAISE messages in
// migration 20260816090000; pgTAP pins the server side of the same contract.
import { describe, expect, it, vi } from "vitest";

// The hooks module pulls the supabase client at import time; the pure function
// under test never touches it.
vi.mock("@/integrations/supabase/shop-client", () => ({
  shopFrom: vi.fn(),
  shopRpc: vi.fn(),
}));

import { activateErrorMessage, decisionErrorMessage } from "@/hooks/shop/useShopApplicationQueue";

describe("activateErrorMessage", () => {
  it("admin_required → the 2FA re-login line (same wording as decisions)", () => {
    expect(activateErrorMessage(new Error("admin_required"))).toBe(
      "Phiên đăng nhập chưa đủ quyền. Đăng nhập lại bằng 2FA rồi thử lại.",
    );
  });

  it("shop_not_activatable:<state> → reload guidance, whatever the state", () => {
    expect(activateErrorMessage(new Error("shop_not_activatable:suspended"))).toBe(
      "Shop không còn ở trạng thái chờ kích hoạt — có thể đã đổi ở nơi khác. Tải lại trang để xem trạng thái mới.",
    );
  });

  it("everything else (shop_not_found, invalid method, network) → nothing changed, retry", () => {
    const fallback =
      "Chưa kích hoạt được. Shop vẫn ở trạng thái cũ, chưa có gì công khai. Thử lại hoặc kiểm tra kết nối.";
    expect(activateErrorMessage(new Error("shop_not_found"))).toBe(fallback);
    expect(activateErrorMessage(new Error("invalid_verified_method"))).toBe(fallback);
    expect(activateErrorMessage(new TypeError("Failed to fetch"))).toBe(fallback);
    expect(activateErrorMessage(undefined)).toBe(fallback);
  });
});

// Same contract, decision side — substrings of the RAISE messages in
// shop_application_decide() (migration 20260811100000).
describe("decisionErrorMessage", () => {
  it("admin_required → the 2FA re-login line", () => {
    expect(decisionErrorMessage(new Error("admin_required"))).toBe(
      "Phiên đăng nhập chưa đủ quyền. Đăng nhập lại bằng 2FA rồi thử lại.",
    );
  });

  it("applicant_note_required → why the note matters", () => {
    expect(decisionErrorMessage(new Error("applicant_note_required"))).toBe(
      "Cần viết ghi chú gửi người nộp — đây là thứ duy nhất họ nhận được.",
    );
  });

  it("requested_fields_required → tick at least one box", () => {
    expect(decisionErrorMessage(new Error("requested_fields_required"))).toBe(
      "Cần tick ít nhất một ô cần sửa.",
    );
  });

  it("application_not_decidable → someone else got there first, reload", () => {
    expect(decisionErrorMessage(new Error("application_not_decidable:approved"))).toBe(
      "Hồ sơ này đã được xử lý ở nơi khác. Tải lại để xem trạng thái mới.",
    );
  });

  it("everything else (network, unknown) → note kept, applicant received nothing", () => {
    const fallback =
      "Chưa gửi được quyết định. Ghi chú anh vừa gõ vẫn còn — người nộp CHƯA nhận được gì.";
    expect(decisionErrorMessage(new TypeError("Failed to fetch"))).toBe(fallback);
    expect(decisionErrorMessage(undefined)).toBe(fallback);
  });
});

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

import { activateErrorMessage } from "@/hooks/shop/useShopApplicationQueue";

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

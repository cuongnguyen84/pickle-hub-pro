import { describe, it, expect, vi } from "vitest";

// TheLineLayout kéo theo auth, supabase, react-query, presence heartbeat. Test
// này chỉ cần MẢNG nav nên chặn side-effect ở mức import, không dựng cả cây.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/styles/the-line.css", () => ({}));

const { NAV_ITEMS } = await import("../TheLineLayout");

const leaves = NAV_ITEMS.flatMap((item) =>
  "children" in item ? item.children : [item],
);

describe("NAV_ITEMS", () => {
  // Audit UI 19/08: TOÀN BỘ layout không có một chỗ nào nhắc `/shop` — không
  // header, không drawer, không chân trang, không thanh dưới. Người mua từ
  // Google rơi vào trang sản phẩm rồi hết đường quay lại chợ. Không gate nào
  // bắt được vì không gate nào nhìn vào đây.
  it("có đường vào chợ", () => {
    expect(leaves.map((l) => l.to)).toContain("/shop");
  });

  it("mục chợ có nhãn tiếng Việt riêng", () => {
    // Mảng này nuôi cả nav desktop lẫn drawer mobile, và 95% người đọc là
    // người Việt — để rơi labelVi là để họ nhìn thấy "Shop".
    const shop = leaves.find((l) => l.to === "/shop");
    expect(shop?.labelVi).toBe("Chợ");
  });

  it("mọi mục đều có key duy nhất", () => {
    // `active === item.key` quyết định mục nào sáng. Trùng key = hai mục cùng
    // sáng, và lỗi đó chỉ lộ ra bằng mắt trên đúng một trang.
    const keys = leaves.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("mọi đường dẫn đều là đường nội bộ tuyệt đối", () => {
    // Đường tương đối trong nav toàn cục sẽ nối thêm vào path hiện tại và
    // sinh ra /shop/product/abc/shop.
    for (const l of leaves) expect(l.to.startsWith("/")).toBe(true);
  });
});

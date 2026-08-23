import { describe, it, expect } from "vitest";
import { NAV_ITEMS } from "../navItems";

// Import thẳng, không mock gì: `navItems.ts` là dữ liệu thuần, không kéo theo
// auth/supabase/CSS nào. Bản đầu của file này import từ TheLineLayout và kéo
// 1100 dòng component vào mẫu số coverage — statements tụt 83% → 72% và gate
// Quality đỏ trong khi 3289 test đều xanh. Đó là lý do mảng nav được tách ra.

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

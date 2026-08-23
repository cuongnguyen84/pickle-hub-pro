import { describe, it, expect } from "vitest";
import { MORE_ITEMS, BAR_PATHS, isMorePath } from "../moreItems";
import { NAV_ITEMS } from "../navItems";

// Import dữ liệu thuần, không import BottomNav: kéo component vào đây là kéo
// cả cây React + supabase vào mẫu số coverage, đúng cái bẫy đã làm gate
// Quality đỏ hôm 19/08.

const leaves = NAV_ITEMS.flatMap((item) => ("children" in item ? item.children : [item]));

describe("MORE_ITEMS", () => {
  it("không lặp lại ô đã cố định trên thanh dưới", () => {
    // Trang chủ / Chợ / Bảng tin có ô riêng — hiện lại trong tấm trượt là nói
    // với người dùng rằng đó là hai chỗ khác nhau.
    for (const path of BAR_PATHS) {
      expect(MORE_ITEMS.map((i) => i.to)).not.toContain(path);
    }
  });

  it("GIỮ /live và /tools dù ô thứ hai đang hiện một trong hai", () => {
    // Ô thứ hai đổi mặt theo việc có trận live hay không. Loại theo nó thì nội
    // dung tấm trượt đổi giữa các ngày — người dùng mở ra và thấy danh sách
    // khác hôm qua, đó là thứ khó chịu hơn cả một mục trùng.
    expect(MORE_ITEMS.map((i) => i.to)).toContain("/live");
    expect(MORE_ITEMS.map((i) => i.to)).toContain("/tools");
  });

  it("Social nằm đầu tiên", () => {
    // Nó vừa mất ô xanh giữa thanh. Mất ô thì đừng mất luôn chỗ dễ thấy.
    expect(MORE_ITEMS[0].to).toBe("/social");
  });

  it("phủ hết mọi bề mặt trong nav mà thanh dưới không có ô riêng", () => {
    // Đây là điều khiến tấm trượt không bao giờ lỗi thời: thêm một mục vào
    // NAV_ITEMS là nó tự có mặt. Chợ vô hình nhiều tháng vì mỗi bề mặt điều
    // hướng giữ một danh sách viết tay riêng.
    const expected = leaves
      .map((l) => l.to)
      .filter((to) => !BAR_PATHS.includes(to as (typeof BAR_PATHS)[number]));
    expect(new Set(MORE_ITEMS.map((i) => i.to))).toEqual(new Set(expected));
  });

  it("mọi mục đều có nhãn hiện được", () => {
    for (const item of MORE_ITEMS) {
      expect((item.labelVi ?? item.label).length).toBeGreaterThan(0);
    }
  });

  it("ghi nhận đúng những mục CÒN hiện nhãn tiếng Anh cho người Việt", () => {
    // Đây là test ghi nhận hiện trạng, không phải test chúc mừng. Bản đầu chỉ
    // kiểm "nhãn không rỗng" và xanh ngay cả khi 5/9 mục hiện tiếng Anh trên
    // trang /vi — đúng kiểu test tự khen. Danh sách này là quyết định sản phẩm
    // đang treo (nav trên và drawer cũng hiện y hệt, có từ trước tấm trượt).
    //
    // Thêm một mục mới không có labelVi thì test này ĐỎ, và người thêm phải
    // quyết định thay vì để nó lặng lẽ ra tiếng Anh.
    const chuaDich = MORE_ITEMS.filter((i) => !i.labelVi).map((i) => i.to);
    expect(chuaDich).toEqual(["/live", "/tournaments", "/tools", "/rankings", "/blog"]);
  });
});

describe("isMorePath", () => {
  it("sáng ở trang nằm trong tấm trượt, cả bản /vi", () => {
    expect(isMorePath("/clubs")).toBe(true);
    expect(isMorePath("/vi/clubs")).toBe(true);
    expect(isMorePath("/rankings")).toBe(true);
  });

  it("sáng ở trang con của mục đó", () => {
    expect(isMorePath("/clubs/sai-gon-pickleball")).toBe(true);
    expect(isMorePath("/vi/san/quan-1")).toBe(true);
  });

  it("KHÔNG sáng ở trang có ô cố định riêng", () => {
    // Nếu nó sáng ở /shop thì hai ô cùng sáng, và lỗi đó chỉ lộ ra bằng mắt.
    expect(isMorePath("/")).toBe(false);
    expect(isMorePath("/vi")).toBe(false);
    expect(isMorePath("/shop")).toBe(false);
    expect(isMorePath("/shop/product/kaiwin-diamond")).toBe(false);
    expect(isMorePath("/feed")).toBe(false);
  });

  it("không khớp nhầm đường dẫn chỉ TRÙNG TIỀN TỐ", () => {
    // "/livestream-abc" không phải trang con của "/live".
    expect(isMorePath("/livestream-abc")).toBe(false);
  });
});

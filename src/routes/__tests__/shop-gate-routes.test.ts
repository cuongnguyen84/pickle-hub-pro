// ============================================================================
// Mọi lối DUYỆT chợ phải đi qua ShopGate.
// ----------------------------------------------------------------------------
// Đọc App.tsx như văn bản, không dựng cây React: một test render sẽ kéo
// TheLineLayout (1100 dòng) vào mẫu số coverage và làm đỏ gate Quality trong
// khi mọi test đều xanh — đúng cái bẫy đã dính hôm 19/08.
//
// Lỗi mà test này bắt: sau này thêm một route chợ mới (/shop/brand/:slug,
// /shop/deals…) mà quên bọc cổng. Cửa đóng nhưng có một ô cửa sổ mở, và không
// ai biết cho tới khi người dùng đi qua đó.
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "../../App.tsx"), "utf8");

/** Những route /shop CỐ Ý không bị cổng chặn, kèm lý do. */
const EXEMPT: Record<string, string> = {
  "/shop/orders":
    "tra cứu đơn của chính mình — đã có đơn thật chạy qua chợ, đóng cửa không có nghĩa là bỏ rơi người đã mua",
  "/shop/order/:code": "chi tiết một đơn đã đặt, cùng lý do trên",
};

function mirroredShopEntries(): { path: string; element: string }[] {
  const block = source.match(/const MIRRORED: MirroredRoute\[\] = \[\n([\s\S]*?)\n\];/);
  if (!block) throw new Error("không tìm thấy mảng MIRRORED trong App.tsx");
  return block[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{") && line.includes('path: "/shop'))
    .map((line) => {
      const m = line.match(/path: "([^"]+)", element: ([\s\S]*) \},$/);
      if (!m) throw new Error(`dòng MIRRORED không đọc được: ${line}`);
      return { path: m[1], element: m[2] };
    });
}

describe("cổng chợ ở tầng route", () => {
  const entries = mirroredShopEntries();

  it("đọc được các route /shop (chống trôi định dạng)", () => {
    // Nếu mảng đổi cách viết, các assert dưới sẽ xanh vì rỗng chứ không phải
    // vì đúng. Đây là chốt chặn kiểu xanh giả đó.
    expect(entries.length).toBeGreaterThanOrEqual(9);
  });

  it("mọi lối duyệt chợ đều bọc trong ShopGate", () => {
    const unguarded = entries
      .filter((e) => !(e.path in EXEMPT))
      .filter((e) => !e.element.startsWith("<ShopGate>"))
      .map((e) => e.path);
    expect(unguarded).toEqual([]);
  });

  it("route tra cứu đơn KHÔNG bị cổng chặn", () => {
    // Cố ý, và có test để lần sau ai đó "bọc nốt cho đều tay" thì thấy lý do.
    for (const path of Object.keys(EXEMPT)) {
      const entry = entries.find((e) => e.path === path);
      expect(entry, `thiếu route ${path}`).toBeTruthy();
      expect(entry!.element).not.toContain("ShopGate");
    }
  });

  it("kênh người bán không nằm trong tầm cổng", () => {
    // /seller/* không đi qua MIRRORED và không được bọc: đóng cửa hàng mà khoá
    // luôn phòng kho thì không sửa được hàng để mở lại.
    expect(source).not.toMatch(/<ShopGate>[^\n]*Seller/);
  });
});

/**
 * Nội dung tấm trượt "Thêm" của thanh dưới.
 *
 * KHÔNG phải một danh sách viết tay: nó DẪN XUẤT từ `NAV_ITEMS` — cùng cái
 * mảng nuôi nav desktop và drawer mobile. Thêm một bề mặt vào nav là nó tự có
 * mặt ở đây, và không có cái danh sách thứ hai để quên cập nhật. Chợ vô hình
 * suốt nhiều tháng chính vì mỗi bề mặt điều hướng giữ một danh sách riêng.
 *
 * Là DỮ LIỆU, tách khỏi component có chủ ý — cùng lý do với `navItems.ts`:
 * test được mà không kéo cả cây React vào mẫu số coverage.
 */

import { NAV_ITEMS, type NavLeaf } from "./navItems";

/** Những đường dẫn ĐÃ có ô cố định riêng trên thanh dưới. */
export const BAR_PATHS = ["/", "/shop", "/feed"] as const;

/**
 * `/live` và `/tools` KHÔNG bị loại, dù ô thứ hai của thanh đang hiện một
 * trong hai: ô đó đổi mặt theo việc có trận live hay không, nên loại theo nó
 * sẽ làm nội dung tấm trượt thay đổi giữa các ngày — người dùng mở ra và thấy
 * một danh sách khác hôm qua. Trùng một mục với thanh dưới là chuyện bình
 * thường của menu tràn; danh sách nhảy múa thì không.
 */
export const MORE_ITEMS: NavLeaf[] = (() => {
  const leaves = NAV_ITEMS.flatMap((item) => ("children" in item ? item.children : [item]));
  const rest = leaves.filter((leaf) => !BAR_PATHS.includes(leaf.to as (typeof BAR_PATHS)[number]));
  // Social lên đầu: nó vừa mất ô xanh giữa thanh, và 30 ngày qua vẫn là bề mặt
  // sinh nội dung nhiều nhất (16 buổi được tạo). Mất ô thì đừng mất luôn chỗ dễ thấy.
  const social = rest.filter((leaf) => leaf.to === "/social");
  return [...social, ...rest.filter((leaf) => leaf.to !== "/social")];
})();

/** Đường dẫn nào đang mở thì ô "Thêm" phải sáng — nếu không, có những trang
 *  không ô nào sáng và thanh dưới trông như đang hỏng. */
export const isMorePath = (pathname: string): boolean =>
  MORE_ITEMS.some((leaf) => {
    const vi = `/vi${leaf.to}`;
    return (
      pathname === leaf.to ||
      pathname === vi ||
      pathname.startsWith(`${leaf.to}/`) ||
      pathname.startsWith(`${vi}/`)
    );
  });

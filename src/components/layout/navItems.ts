/**
 * Thành phần của điều hướng chính — tách khỏi TheLineLayout.tsx có chủ ý.
 *
 * Lý do không để nguyên trong component: nó là DỮ LIỆU, và dữ liệu thì test
 * được mà không phải dựng cả cây React. Lần đầu thử test tại chỗ (19/08), việc
 * import TheLineLayout kéo 1100 dòng component vào mẫu số coverage trong khi
 * gần như không dòng nào chạy — statements tụt 83% → 72% và gate Quality đỏ,
 * dù mọi test đều xanh. File nhỏ này giữ mẫu số nhỏ.
 *
 * Mảng nuôi CẢ nav desktop lẫn drawer mobile, nên thêm một mục là thêm ở hai
 * bề mặt.
 */

export type Active =
  | "live" | "tournaments" | "lab" | "rankings" | "feed" | "stories" | "stats"
  | "home" | "events" | "clubs" | "social" | "venues" | "players" | "news"
  | "tools" | "blog" | "videos" | "search" | "shop";

export interface NavLeaf {
  label: string;
  labelVi?: string;
  to: string;
  key: Active;
}

/**
 * Mục có `children` render thành nút mở popup; bấm con mới điều hướng. Cha
 * không có `to` (chỉ là nút mở menu). Cha sáng khi bất kỳ con nào đang active.
 */
export interface NavParent {
  label: string;
  labelVi?: string;
  key: Active;
  children: NavLeaf[];
}

export type NavItem = NavLeaf | NavParent;

export const NAV_ITEMS: NavItem[] = [
  { label: "Live", to: "/live", key: "live" },
  { label: "Tournaments", to: "/tournaments", key: "tournaments" },
  {
    label: "Social",
    labelVi: "Social",
    key: "social",
    children: [
      { label: "Courts", labelVi: "Sân", to: "/san", key: "venues" },
      { label: "Find players", labelVi: "Tìm bạn chơi", to: "/tim-ban-choi", key: "players" },
      { label: "Tickets", labelVi: "Xé vé", to: "/social", key: "events" },
      { label: "Clubs", labelVi: "CLB", to: "/clubs", key: "clubs" },
    ],
  },
  // Chợ vào đây chứ không chỉ vào chân trang. Trước 19/08 toàn bộ layout không
  // có một chỗ nào nhắc `/shop` — người mua từ Google rơi vào trang sản phẩm
  // rồi hết đường đi tiếp. `/vi/shop` có thật: mảng MIRRORED trong App.tsx
  // mount mọi path hai lần.
  { label: "Shop", labelVi: "Chợ", to: "/shop", key: "shop" },
  { label: "Bracket Lab", to: "/tools", key: "lab" },
  { label: "Rankings", to: "/rankings", key: "rankings" },
  { label: "Feed", labelVi: "Bảng tin", to: "/feed", key: "feed" },
  { label: "Stories", to: "/blog", key: "stories" },
];

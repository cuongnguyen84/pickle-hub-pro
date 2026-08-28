// ============================================================================
// Cổng chợ, đặt ở tầng route.
// ----------------------------------------------------------------------------
// Bọc các lối DUYỆT chợ. Khi cổng đóng, mọi lối vào — nút Chợ trên thanh dưới,
// nav trên, chân trang, liên kết đã gửi cho nhau, kết quả tìm kiếm — đều tới
// cùng một trang "đang hoàn thiện", chứ không phải chỉ cái nút bị đổi đích.
//
// Quản trị viên đi xuyên qua: người phải sửa chỗ hỏng cần nhìn đúng cái người
// mua sẽ nhìn. Trong lúc chờ biết vai trò thì KHÔNG chớp qua trang đóng cửa
// rồi mới mở ra — đó là một lần nháy màn hình mỗi lần điều hướng.
// ============================================================================

import { Suspense, lazy, type ReactNode } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useShopPilotAccess } from "@/hooks/shop/useSellerApplication";
import { SHOP_PUBLIC_OPEN } from "@/lib/shop/shopGate";

// Chunk riêng, có lý do đo được: cổng này được import THẲNG trong App.tsx (nó
// quyết định cái gì được vẽ nên không lazy được), và bản đầu kéo luôn trang
// đóng cửa theo — trang đó kéo TheLineLayout + shop.css vào chunk đầu tiên và
// INITIAL nhảy 229,9 -> 240,5 KB gz. Mười KB đó rơi vào MỌI người vào trang
// chủ, để phục vụ một trang gần như không ai thấy.
const ShopComingSoon = lazy(() => import("@/pages/shop/ShopComingSoon"));

export function ShopGate({ children }: { children: ReactNode }) {
  // Cổng mở thì không hỏi vai trò làm gì — mọi truy vấn user_roles ở đây là
  // một truy vấn thừa trên mọi trang chợ, cho mọi người, mãi mãi.
  const { isAdmin, isLoading } = useAdminAuth();
  // Nhóm tester của pilot (bảng shop_pilot_members, admin thêm bằng tay) đi
  // qua cổng như admin. Cùng một allowlist với người được nộp đơn bán — "trong
  // pilot" là một chuyện, không phải hai.
  const pilot = useShopPilotAccess();

  if (SHOP_PUBLIC_OPEN) return <>{children}</>;
  // Chưa biết là ai: đứng yên. Vẽ trang đóng cửa trước rồi thay bằng chợ khi
  // biết là admin sẽ làm màn hình nháy ở mỗi lần chuyển trang.
  if (isLoading || pilot.isLoading) return null;
  if (isAdmin || pilot.data === true) return <>{children}</>;
  return (
    <Suspense fallback={null}>
      <ShopComingSoon />
    </Suspense>
  );
}

export default ShopGate;

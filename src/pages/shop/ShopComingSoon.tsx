// ============================================================================
// Trang người dùng thấy khi chợ còn đóng (SHOP_PUBLIC_OPEN = false).
// ----------------------------------------------------------------------------
// Nói THẲNG là chưa mở, và nói khi nào thì mở được — một trang "đang phát
// triển" không có lối đi tiếp là một ngõ cụt, và người dùng bấm nút Chợ trên
// thanh dưới xứng đáng có đường ra.
//
// Không hứa ngày. Không ô "báo cho tôi khi mở" — chưa có chỗ nào nhận email
// đó, và một cái ô gửi vào hư vô tệ hơn là không có ô nào.
// ============================================================================

import { Link } from "react-router-dom";
import { Hammer } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { useI18n } from "@/i18n";
import "@/styles/shop.css";

export default function ShopComingSoon() {
  const { language } = useI18n();
  const vi = language === "vi";
  const prefix = vi ? "/vi" : "";

  const title = vi ? "Chợ đang hoàn thiện" : "The shop is still being built";

  return (
    <TheLineLayout title={title}>
      {/* noindex: cửa còn đóng thì trang này không phải thứ đại diện cho /shop
          trong kết quả tìm kiếm. Bot vốn đã nhận vỏ noindex từ Pages Function
          (SHOP_PUBLIC_INDEXING đang tắt), đây là nửa còn lại của cùng câu trả
          lời cho nhánh SPA. */}
      <DynamicMeta title={title} noindex />
      <main className="tl-shop">
        <div className="tl-shop-page tl-shop-page--narrow">
          <div
            className="tl-shop-card"
            style={{ display: "grid", gap: 14, padding: "26px 22px", marginTop: 24 }}
          >
            <Hammer size={24} strokeWidth={1.5} aria-hidden="true" style={{ color: "var(--tl-green)" }} />
            <h1 className="tl-shop-h1" style={{ margin: 0 }}>
              {title}
            </h1>
            <p className="tl-shop-sub" style={{ margin: 0 }}>
              {vi
                ? "Chợ đã chạy được nhưng hàng hoá và thông tin người bán còn đang được hoàn thiện, nên tụi mình chưa mở cho mọi người vào mua. Mở cửa khi nào có đủ hàng để chọn cho tử tế."
                : "The marketplace works, but the catalogue and seller details are still being finished, so it is not open for shopping yet. It opens when there is enough on the shelves to choose from properly."}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              <Link to={prefix || "/"} className="tl-shop-btn tl-shop-btn--primary">
                {vi ? "Về trang chủ" : "Back home"}
              </Link>
              <Link to={`${prefix}/feed`} className="tl-shop-btn">
                {vi ? "Xem bảng tin" : "Open the feed"}
              </Link>
            </div>
            <p className="tl-shop-hint tl-shop-flush-b">
              {vi
                ? "Anh/chị muốn bán hàng trên ThePickleHub? Kênh người bán vẫn mở."
                : "Want to sell on ThePickleHub? The seller channel is still open."}{" "}
              <Link to={`${prefix}/sell`}>{vi ? "Đăng ký bán hàng" : "Apply to sell"}</Link>
            </p>
          </div>
        </div>
      </main>
    </TheLineLayout>
  );
}

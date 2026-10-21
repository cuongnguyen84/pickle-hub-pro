// ============================================================================
// F04 — Product discovery primitives, full state matrix
// ============================================================================

import { useState } from "react";
import {
  ProductCard,
  ProductPrice,
  SellerIdentity,
  VerificationBadge,
  CategoryShortcut,
  StockStatus,
  DeliverySummary,
  WishlistButton,
  ProductMedia,
} from "../components/Primitives";
import { MatrixSection, Cell, Cells } from "../components/Matrix";
import { CATEGORIES, PRODUCTS, SHOPS, productById, shopById } from "../fixtures";

export default function F04Discovery() {
  const [saved, setSaved] = useState<Record<string, boolean>>({ "p-1": true });
  const toggle = (id: string) => setSaved((s) => ({ ...s, [id]: !s[id] }));

  const simple = productById("p-1");
  const ranged = productById("p-2");
  const used = productById("p-3");
  const archived = productById("p-11");

  return (
    <main className="tl-shop-page">
      <p className="tl-shop-eyebrow">F04</p>
      <h1 className="tl-shop-h1">Thành phần khám phá sản phẩm</h1>
      <p className="tl-shop-sub">
        Không có sao đánh giá, không có &ldquo;đã bán 1,2k&rdquo;, không có phần trăm giảm
        giá — hệ thống chưa có dữ liệu nào chứng minh được những con số đó.
      </p>

      <MatrixSection
        id="f04-card"
        title="ProductCard"
        note="Thẻ sản phẩm luôn dành sẵn chỗ cho ảnh theo tỉ lệ 1:1, nên nội dung bên dưới không nhảy khi ảnh tải xong."
      >
        <Cells min={170}>
          <Cell label="Bình thường">
            <ProductCard product={simple} saved={saved["p-1"]} onToggleSave={() => toggle("p-1")} />
          </Cell>
          <Cell label="Khoảng giá theo phiên bản">
            <ProductCard product={ranged} saved={saved["p-2"]} onToggleSave={() => toggle("p-2")} />
          </Cell>
          <Cell label="Người bán đã đổi giá">
            <ProductCard
              product={productById("p-4")}
              previousPrice={{ vndAmount: 290_000, changedAt: "2026-08-05" }}
            />
          </Cell>
          <Cell label="Hàng đã qua sử dụng">
            <ProductCard product={used} />
          </Cell>
          <Cell label="Hết hàng">
            <ProductCard product={archived} forceUnavailable />
          </Cell>
          <Cell label="Người bán tạm ngưng">
            <ProductCard product={used} />
          </Cell>
          <Cell label="Đang tải">
            <div className="tl-shop-pcard" aria-busy="true">
              <div className="tl-shop-sk" style={{ aspectRatio: "1 / 1", borderRadius: "var(--tl-radius)" }} />
              <div className="tl-shop-sk" style={{ height: 13, width: "92%" }} />
              <div className="tl-shop-sk" style={{ height: 13, width: "64%" }} />
              <div className="tl-shop-sk" style={{ height: 17, width: "48%" }} />
            </div>
          </Cell>
        </Cells>
      </MatrixSection>

      <MatrixSection
        id="f04-price"
        title="ProductPrice"
        note="Giá cũ chỉ xuất hiện khi người bán thật sự đổi giá, và luôn kèm ngày đổi — đọc ra là lịch sử giá, không phải khuyến mãi bịa."
      >
        <Cells min={190}>
          <Cell label="Một giá">
            <ProductPrice vndAmount={2_450_000} />
          </Cell>
          <Cell label="Khoảng giá">
            <ProductPrice vndAmount={1_290_000} maxVnd={1_390_000} />
          </Cell>
          <Cell label="Đã đổi giá">
            <ProductPrice vndAmount={320_000} previous={{ vndAmount: 290_000, changedAt: "2026-08-05" }} />
          </Cell>
          <Cell label="Cỡ lớn (trang chi tiết)">
            <ProductPrice vndAmount={2_450_000} size="lg" />
          </Cell>
        </Cells>
      </MatrixSection>

      <MatrixSection
        id="f04-seller"
        title="SellerIdentity + VerificationBadge"
        note='"Đã xác minh" nói rõ đã xác minh bằng cách nào và ngày nào khi di chuột / đọc màn hình. Nó không có nghĩa là ThePickleHub bảo đảm chất lượng hàng.'
      >
        <Cells min={230}>
          {SHOPS.map((shop) => (
            <Cell key={shop.id} label={shop.state}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                <SellerIdentity shop={shop} />
                <VerificationBadge shop={shop} />
                <span className="tl-shop-hint">
                  {shop.verifiedMethod === "giay-phep-kinh-doanh"
                    ? "Đối chiếu giấy phép kinh doanh"
                    : shop.verifiedMethod === "gap-truc-tiep"
                      ? "Gặp trực tiếp người bán"
                      : "Chưa xác minh danh tính"}
                </span>
              </div>
            </Cell>
          ))}
        </Cells>
      </MatrixSection>

      <MatrixSection id="f04-cat" title="CategoryShortcut">
        <div className="tl-shop-cats">
          {CATEGORIES.map((c, i) => (
            <CategoryShortcut key={c.slug} slug={c.slug} name={c.name} current={i === 0} />
          ))}
        </div>
      </MatrixSection>

      <MatrixSection
        id="f04-stock"
        title="StockStatus"
        note="Chỉ nói con số khi biết chắc. Người bán không theo dõi tồn kho thì chỉ hiện “Còn hàng”, không bịa số. Hết hàng dùng màu xám, không dùng đỏ — hết hàng không phải là lỗi."
      >
        <Cells min={160}>
          <Cell label="stock = null (không theo dõi)">
            <StockStatus stock={null} />
          </Cell>
          <Cell label="stock = 12">
            <StockStatus stock={12} />
          </Cell>
          <Cell label="stock = 2">
            <StockStatus stock={2} />
          </Cell>
          <Cell label="stock = 0">
            <StockStatus stock={0} />
          </Cell>
        </Cells>
      </MatrixSection>

      <MatrixSection
        id="f04-deliv"
        title="DeliverySummary"
        note="Chỉ nói gửi từ đâu và chính sách đổi trả của người bán. Không hứa ngày giao — hệ thống chưa nối với đơn vị vận chuyển nào."
      >
        <Cells min={220}>
          <Cell label="Có đổi trả">
            <DeliverySummary product={simple} />
          </Cell>
          <Cell label="Không nhận đổi trả">
            <DeliverySummary product={used} />
          </Cell>
        </Cells>
      </MatrixSection>

      <MatrixSection
        id="f04-wish"
        title="Nút lưu sản phẩm"
        note="Vùng bấm 44×44px, trạng thái đọc được qua aria-pressed nên trình đọc màn hình biết đã lưu hay chưa."
      >
        <Cells min={150}>
          <Cell label="Chưa lưu">
            <div style={{ position: "relative", height: 90 }}>
              <ProductMedia label="Ảnh" />
              <WishlistButton saved={false} productTitle={simple.title} onToggle={() => {}} />
            </div>
          </Cell>
          <Cell label="Đã lưu">
            <div style={{ position: "relative", height: 90 }}>
              <ProductMedia label="Ảnh" />
              <WishlistButton saved productTitle={simple.title} onToggle={() => {}} />
            </div>
          </Cell>
        </Cells>
      </MatrixSection>

      <MatrixSection id="f04-all" title="Lưới sản phẩm thật (dữ liệu mẫu)">
        <div className="tl-shop-grid">
          {PRODUCTS.filter((p) => p.status === "active").map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              saved={!!saved[p.id]}
              onToggleSave={() => toggle(p.id)}
            />
          ))}
        </div>
        <p className="tl-shop-hint" style={{ marginTop: 10 }}>
          Bao gồm cả sản phẩm của shop đang tạm ngưng ({shopById("shop-3").name}) để thấy
          cách hiển thị khi người bán không bán được.
        </p>
      </MatrixSection>
    </main>
  );
}

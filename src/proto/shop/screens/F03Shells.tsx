// ============================================================================
// F03 — Shell + responsive navigation specimen
// ----------------------------------------------------------------------------
// ?variant=buyer | seller | admin  (default: buyer)
// ============================================================================

import { useLocation } from "react-router-dom";
import { readVariant } from "../scenario";
import { BuyerShell, SellerShell, AdminShopFrame } from "../components/Shells";

const Note = ({ children }: { children: React.ReactNode }) => (
  <div className="tl-shop-notice tl-shop-notice--info">
    <div>{children}</div>
  </div>
);

export default function F03Shells() {
  const location = useLocation();
  const variant = readVariant(location.search) || "buyer";

  if (variant === "seller") {
    return (
      <SellerShell active="orders" title="Đơn hàng" badges={{ orders: 3, products: 1 }}>
        <div className="tl-shop-page">
          <p className="tl-shop-eyebrow">F03 · Kênh người bán</p>
          <h1 className="tl-shop-h1">Khung Kênh người bán</h1>
          <Note>
            <strong>Máy tính:</strong> cột trái cố định 236px, mục đang mở có vạch xanh bên
            trái (không chỉ đổi màu chữ). <strong>Điện thoại:</strong> 4 tab dưới đáy, mỗi
            tab cao tối thiểu 44px và đã trừ vùng an toàn của iPhone.
          </Note>
          <Note>
            <strong>Không thêm mục thứ 6 vào thanh điều hướng dưới của ứng dụng.</strong>{" "}
            Đường dẫn <code>/seller/*</code> sẽ vào danh sách ẩn của <code>BottomNav</code>{" "}
            đúng như <code>/creator</code> và <code>/admin</code> hiện nay — nếu không sẽ có
            hai thanh chồng nhau ở đáy màn hình.
          </Note>
          <div className="tl-shop-card">
            <p style={{ margin: 0, color: "var(--tl-fg-3)", fontSize: 14 }}>
              Vùng nội dung. Thu hẹp cửa sổ xuống dưới 1024px để thấy cột trái chuyển thành
              thanh tab dưới đáy.
            </p>
          </div>
        </div>
      </SellerShell>
    );
  }

  if (variant === "admin") {
    return (
      <main className="tl-shop-page">
        <p className="tl-shop-eyebrow">F03 · Quản trị</p>
        <h1 className="tl-shop-h1">Shop nằm trong AdminLayout sẵn có</h1>
        <p className="tl-shop-sub">
          Không dựng khung quản trị riêng. Đề xuất: thêm <strong>một</strong> mục
          &ldquo;Shop&rdquo; có 3 mục con.
        </p>
        <Note>
          Cột trái của <code>AdminLayout</code> đang có 18 mục. Thêm 4 mục phẳng nữa sẽ phải
          cuộn trên laptop 13&quot;. Gộp thành 1 mục cha giữ nguyên số dòng nhìn thấy.
        </Note>
        <AdminShopFrame crumb="Shop · Hồ sơ đăng ký">
          <p style={{ margin: 0, color: "var(--tl-fg-3)", fontSize: 14 }}>
            Nội dung màn hình quản trị Shop hiển thị ở đây, dùng lại toàn bộ chrome của
            AdminLayout (kể cả cổng 2FA <code>AdminMFAGate</code>).
          </p>
        </AdminShopFrame>
      </main>
    );
  }

  return (
    <BuyerShell title="Shop" cartCount={3}>
      <main className="tl-shop-page">
        <p className="tl-shop-eyebrow">F03 · Người mua</p>
        <h1 className="tl-shop-h1">Khung trang mua hàng</h1>
        <Note>
          Thanh đầu trang dính theo cuộn, có ô tìm kiếm và giỏ hàng. Số trên giỏ hàng được
          đọc thành lời cho trình đọc màn hình (&ldquo;Giỏ hàng, 3 sản phẩm&rdquo;), không
          chỉ là con số trang trí.
        </Note>
        <Note>
          Trang mua hàng <strong>vẫn nằm dưới thanh điều hướng 5 mục sẵn có</strong> của ứng
          dụng. Mọi thanh hành động dính đáy đều cộng thêm khoảng trống 56px + vùng an toàn,
          nên không đè lên thanh đó.
        </Note>
        <div className="tl-shop-card">
          <p style={{ margin: 0, color: "var(--tl-fg-3)", fontSize: 14 }}>
            Cuộn xuống để kiểm tra thanh đầu trang dính và khoảng trống đáy.
          </p>
        </div>
        <div style={{ height: 700 }} aria-hidden="true" />
        <div className="tl-shop-card">
          <p style={{ margin: 0, fontSize: 14 }}>
            Cuối trang — thanh hành động dính bên dưới không che nội dung này.
          </p>
        </div>
      </main>
      <div className="tl-shop-stickybar">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "var(--tl-fg-3)" }}>Thanh hành động mẫu</div>
          <div style={{ fontWeight: 700 }}>2.450.000₫</div>
        </div>
        <button type="button" className="tl-shop-btn tl-shop-btn--primary">
          Thêm vào giỏ
        </button>
      </div>
    </BuyerShell>
  );
}

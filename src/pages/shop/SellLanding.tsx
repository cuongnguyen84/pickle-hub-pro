// ============================================================================
// /shop/sell — prototype S01 in production.
// ----------------------------------------------------------------------------
// Requirements are readable BEFORE the user starts, and nothing here invents a
// review SLA or a permanent fee promise — the pilot has measured neither.
// ============================================================================

import { Link } from "react-router-dom";
import { Check, Clock, ShieldCheck } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { ShopScrollShell, ShopHeader } from "@/components/shop/ShopShell";
import { LoadingState } from "@/components/states/PageStates";
import { useAuth } from "@/hooks/useAuth";
import { useMyApplication, useShopPilotAccess } from "@/hooks/shop/useSellerApplication";
import { canEdit, isTerminal } from "@/lib/shop/applicationState";

const REQUIREMENTS = [
  { t: "Tài khoản ThePickleHub đã đăng nhập được",
    d: "Nếu anh/chị mở đường dẫn này từ Zalo hoặc Messenger, đăng nhập Google sẽ bị chặn. Mở bằng Chrome hoặc Safari." },
  { t: "Số điện thoại liên hệ",
    d: "Chỉ quản trị viên và người mua đã đặt hàng của anh/chị nhìn thấy. Không hiện công khai." },
  { t: "Địa chỉ gửi hàng",
    d: "Chỉ hiện tên tỉnh/thành trên trang sản phẩm, không hiện địa chỉ chi tiết." },
];

export default function SellLanding() {
  const { user } = useAuth();
  const pilot = useShopPilotAccess();
  const app = useMyApplication();

  if (user && (pilot.isLoading || app.isLoading)) return <LoadingState fullScreen />;

  const status = app.data?.status;
  const cta = (() => {
    if (!user) return { to: "/login?redirect=%2Fshop%2Fsell", label: "Đăng nhập để bắt đầu" };
    if (!pilot.data) return null;
    // Wave 0: an ACTIVE seller landed here and was invited to "Bắt đầu đăng
    // ký" — approved is terminal, but it is the one terminal state with a
    // door, and the door is the seller channel.
    if (status === "approved") return { to: "/seller", label: "Vào kênh người bán" };
    if (!status || isTerminal(status)) return { to: "/seller/application", label: "Bắt đầu đăng ký" };
    if (canEdit(status)) return { to: "/seller/application", label: "Làm tiếp hồ sơ" };
    return { to: "/seller/application/status", label: "Xem trạng thái hồ sơ" };
  })();

  return (
    <ShopScrollShell>
      <DynamicMeta title="Bán hàng trên ThePickleHub" noindex />
      <ShopHeader title="Bán hàng trên ThePickleHub" backTo="/" />
      <main className="tl-shop-page tl-shop-page--narrow">
        <h1 className="tl-shop-h1">Bán đồ pickleball trên ThePickleHub</h1>
        <p className="tl-shop-sub">
          Người chơi đã ở đây để xem giải đấu và tìm sân. Đăng sản phẩm để họ tìm thấy anh/chị.
        </p>

        {user && !pilot.data && (
          <div className="tl-shop-notice tl-shop-notice--warn">
            <div>
              <strong>Shop đang chạy thử nghiệm kín.</strong> Tài khoản của anh/chị chưa nằm
              trong nhóm thử nghiệm. Nếu muốn tham gia, nhắn cho ThePickleHub.
            </div>
          </div>
        )}

        {cta && (
          <div style={{ margin: "20px 0 28px" }}>
            <Link to={cta.to} className="tl-shop-btn tl-shop-btn--primary">{cta.label}</Link>
            <p className="tl-shop-hint">Điền được tới đâu lưu tới đó, không phải làm một lần.</p>
          </div>
        )}

        <section aria-labelledby="s01-req">
          <h2 className="tl-shop-h2" id="s01-req">Cần chuẩn bị gì</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {REQUIREMENTS.map((r) => (
              <li key={r.t} className="tl-shop-card" style={{ display: "flex", gap: 10 }}>
                <Check size={16} aria-hidden="true" style={{ flex: "none", marginTop: 2, color: "var(--shop-stock-ok)" }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.t}</div>
                  <p className="tl-shop-hint" style={{ marginTop: 3 }}>{r.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="s01-docs">
          <h2 className="tl-shop-h2" id="s01-docs">Giấy tờ</h2>
          <div className="tl-shop-notice">
            <div>
              <strong>Giai đoạn thử nghiệm không thu giấy tờ.</strong> Không cần ảnh CCCD, không
              cần tài khoản ngân hàng. Nếu cần đối chiếu, quản trị viên liên hệ trực tiếp.
            </div>
          </div>
        </section>

        <section aria-labelledby="s01-time">
          <h2 className="tl-shop-h2" id="s01-time">Bao lâu thì được duyệt</h2>
          <div className="tl-shop-notice">
            <Clock size={16} aria-hidden="true" />
            <div>
              Hồ sơ do <strong>người</strong> xem, không phải máy tự duyệt. Chúng tôi chưa cam
              kết thời gian cụ thể vì lượng hồ sơ còn ít và chưa đo được.
            </div>
          </div>
        </section>

        <section aria-labelledby="s01-fee">
          <h2 className="tl-shop-h2" id="s01-fee">Phí</h2>
          <div className="tl-shop-notice">
            <div>
              <strong>Hiện chưa thu phí</strong> đăng bán hay hoa hồng. Nếu sau này có thu, chúng
              tôi báo trước và anh/chị được quyền dừng bán. Chúng tôi không nói &ldquo;miễn phí
              trọn đời&rdquo; vì không hứa được điều đó.
            </div>
          </div>
        </section>

        <section aria-labelledby="s01-verify">
          <h2 className="tl-shop-h2" id="s01-verify">Huy hiệu &ldquo;Đã xác minh&rdquo;</h2>
          <div className="tl-shop-notice tl-shop-notice--info">
            <ShieldCheck size={16} aria-hidden="true" />
            <div>
              Huy hiệu nói rằng ThePickleHub đã kiểm tra <strong>anh/chị là ai</strong>. Nó không
              phải bảo đảm chất lượng hàng hoá, và người mua được cho biết đúng như vậy.
            </div>
          </div>
        </section>
      </main>
    </ShopScrollShell>
  );
}

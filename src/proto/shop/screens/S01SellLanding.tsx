// ============================================================================
// S01 — Sell landing /shop/sell
// ----------------------------------------------------------------------------
// Acceptance: requirements clear BEFORE the user starts; no invented review SLA.
// So the page leads with what you must have ready, and the review-time line
// says what is actually true — a person reads it, and we do not promise a
// turnaround we have never measured.
//
// Fee state is likewise the truth as of today: no fee, and a commitment to
// announce before that changes. Not "miễn phí trọn đời".
// ============================================================================

import { Link, useLocation } from "react-router-dom";
import { Check, FileText, Clock, ShieldCheck, AlertTriangle } from "lucide-react";
import { readVariant } from "../scenario";
import { BuyerShell } from "../components/Shells";
import { APPLICATIONS } from "../fixtures";

type Who = "anonymous" | "eligible" | "draft" | "review" | "approved";

const REQUIREMENTS = [
  {
    t: "Tài khoản ThePickleHub đã đăng nhập được",
    d: "Nếu anh/chị mở đường dẫn này từ Zalo hoặc Messenger, đăng nhập Google sẽ bị chặn. Mở bằng Chrome hoặc Safari.",
  },
  {
    t: "Số điện thoại liên hệ",
    d: "Chỉ quản trị viên và người mua đã đặt hàng của anh/chị nhìn thấy. Không hiện công khai.",
  },
  {
    t: "Địa chỉ gửi hàng",
    d: "Chỉ hiện tên tỉnh/thành trên trang sản phẩm, không hiện địa chỉ chi tiết.",
  },
  {
    t: "Ảnh sản phẩm tự chụp",
    d: "Ảnh lấy từ shop khác sẽ bị từ chối. Chụp bằng điện thoại là đủ.",
  },
];

const STEPS = [
  "Chọn loại người bán (cá nhân / hộ kinh doanh / công ty)",
  "Điền thông tin liên hệ",
  "Đặt tên shop và mô tả ngắn",
  "Thêm địa chỉ gửi hàng",
  "Nộp giấy tờ (nếu là hộ kinh doanh hoặc công ty)",
  "Xem lại và gửi hồ sơ",
];

const OBLIGATIONS = [
  "Bán đúng mô tả. Sai mô tả là lý do khiếu nại có cơ sở.",
  "Không bán hàng giả, hàng nhái nhãn hiệu.",
  "Trả lời đơn hàng trong vòng 2 ngày làm việc.",
  "Tự chịu trách nhiệm về hàng hoá, hoá đơn và nghĩa vụ thuế của mình.",
];

export default function S01SellLanding() {
  const location = useLocation();
  const who = (readVariant(location.search) || "anonymous") as Who;

  const cta = () => {
    switch (who) {
      case "anonymous":
        return (
          <>
            <Link to="/proto/shop/seller/application" className="tl-shop-btn tl-shop-btn--primary">
              Đăng nhập để bắt đầu
            </Link>
            <p className="tl-shop-hint">
              Chưa có tài khoản? Đăng nhập bằng Google hoặc số điện thoại, mất khoảng 1 phút.
            </p>
          </>
        );
      case "draft":
        return (
          <>
            <Link to="/proto/shop/seller/application?variant=restored" className="tl-shop-btn tl-shop-btn--primary">
              Làm tiếp hồ sơ ({APPLICATIONS.draft.completedSteps}/6 bước)
            </Link>
            <p className="tl-shop-hint">
              Bản nháp của anh/chị vẫn còn nguyên, kể cả khi đã đóng trình duyệt.
            </p>
          </>
        );
      case "review":
        return (
          <>
            <Link to="/proto/shop/seller/status?variant=under_review" className="tl-shop-btn">
              Xem trạng thái hồ sơ
            </Link>
            <p className="tl-shop-hint">Hồ sơ đã gửi ngày 07/08/2026, đang được xem.</p>
          </>
        );
      case "approved":
        return (
          <>
            <Link to="/proto/shop/seller" className="tl-shop-btn tl-shop-btn--primary">
              Vào Kênh người bán
            </Link>
            <p className="tl-shop-hint">Shop của anh/chị đã được duyệt.</p>
          </>
        );
      default:
        return (
          <>
            <Link to="/proto/shop/seller/application" className="tl-shop-btn tl-shop-btn--primary">
              Bắt đầu đăng ký
            </Link>
            <p className="tl-shop-hint">Điền được tới đâu lưu tới đó, không phải làm một lần.</p>
          </>
        );
    }
  };

  return (
    <BuyerShell title="Bán hàng trên ThePickleHub" backTo="/proto/shop/home" cartCount={null}>
      <main className="tl-shop-page tl-shop-page--narrow">
        <h1 className="tl-shop-h1">Bán đồ pickleball trên ThePickleHub</h1>
        <p className="tl-shop-sub">
          Người chơi đã ở đây để xem giải đấu và tìm sân. Đăng sản phẩm để họ tìm thấy anh/chị.
        </p>

        {who === "approved" && (
          <div className="tl-shop-notice tl-shop-notice--info">
            <Check size={16} aria-hidden="true" />
            <div>Anh/chị đã là người bán. Trang này chỉ để tham khảo lại điều kiện.</div>
          </div>
        )}
        {who === "review" && (
          <div className="tl-shop-notice tl-shop-notice--warn">
            <Clock size={16} aria-hidden="true" />
            <div>Hồ sơ của anh/chị đang được xem. Chưa cần làm gì thêm.</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "20px 0 28px" }}>{cta()}</div>

        <section aria-labelledby="s01-req">
          <h2 className="tl-shop-h2" id="s01-req">
            Cần chuẩn bị gì
          </h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {REQUIREMENTS.map((r) => (
              <li key={r.t} className="tl-shop-card" style={{ display: "flex", gap: 10 }}>
                <Check size={16} aria-hidden="true" style={{ flex: "none", marginTop: 2, color: "var(--shop-stock-ok)" }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.t}</div>
                  <p className="tl-shop-hint" style={{ marginTop: 3 }}>
                    {r.d}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="s01-docs">
          <h2 className="tl-shop-h2" id="s01-docs">
            Giấy tờ
          </h2>
          <div className="tl-shop-card" style={{ display: "grid", gap: 12, fontSize: 13.5, lineHeight: 1.55 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <FileText size={16} aria-hidden="true" style={{ flex: "none", marginTop: 2, color: "var(--tl-fg-3)" }} />
              <div>
                <strong>Bán cá nhân, ít món:</strong> không cần giấy tờ. Chúng tôi liên hệ qua
                điện thoại để xác nhận anh/chị là người thật.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <FileText size={16} aria-hidden="true" style={{ flex: "none", marginTop: 2, color: "var(--tl-fg-3)" }} />
              <div>
                <strong>Hộ kinh doanh / công ty:</strong> ảnh giấy phép kinh doanh, để đối
                chiếu tên shop với tên đăng ký. Ảnh được lưu riêng, chỉ quản trị viên xem được,
                không bao giờ hiện công khai.
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="s01-steps">
          <h2 className="tl-shop-h2" id="s01-steps">
            6 bước, làm được tới đâu lưu tới đó
          </h2>
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8, fontSize: 14, lineHeight: 1.55, color: "var(--tl-fg-2)" }}>
            {STEPS.map((st) => (
              <li key={st}>{st}</li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="s01-time">
          <h2 className="tl-shop-h2" id="s01-time">
            Bao lâu thì được duyệt
          </h2>
          <div className="tl-shop-notice">
            <Clock size={16} aria-hidden="true" />
            <div>
              Hồ sơ do <strong>người</strong> xem, không phải máy tự duyệt. Chúng tôi chưa
              cam kết thời gian cụ thể vì lượng hồ sơ còn ít và chưa đo được. Anh/chị sẽ nhận
              thông báo ngay khi có kết quả, và xem trạng thái bất cứ lúc nào ở trang Hồ sơ.
            </div>
          </div>
        </section>

        <section aria-labelledby="s01-fee">
          <h2 className="tl-shop-h2" id="s01-fee">
            Phí
          </h2>
          <div className="tl-shop-notice">
            <div>
              <strong>Hiện chưa thu phí</strong> đăng bán hay phí hoa hồng. Nếu sau này có
              thu, chúng tôi sẽ báo trước và anh/chị được quyền dừng bán. Chúng tôi không nói
              &ldquo;miễn phí trọn đời&rdquo; vì không hứa được điều đó.
            </div>
          </div>
        </section>

        <section aria-labelledby="s01-verify">
          <h2 className="tl-shop-h2" id="s01-verify">
            Huy hiệu &ldquo;Đã xác minh&rdquo;
          </h2>
          <div className="tl-shop-notice tl-shop-notice--info">
            <ShieldCheck size={16} aria-hidden="true" />
            <div>
              Huy hiệu này nói rằng ThePickleHub đã kiểm tra <strong>anh/chị là ai</strong> —
              qua giấy phép kinh doanh hoặc gặp trực tiếp. Nó không phải bảo đảm chất lượng
              hàng hoá, và người mua được cho biết đúng như vậy.
            </div>
          </div>
        </section>

        <section aria-labelledby="s01-oblig">
          <h2 className="tl-shop-h2" id="s01-oblig">
            Nghĩa vụ của người bán
          </h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {OBLIGATIONS.map((o) => (
              <li key={o} style={{ display: "flex", gap: 10, fontSize: 14, lineHeight: 1.55 }}>
                <AlertTriangle size={15} aria-hidden="true" style={{ flex: "none", marginTop: 3, color: "var(--shop-warning)" }} />
                {o}
              </li>
            ))}
          </ul>
          <p className="tl-shop-hint">
            Bản đầy đủ nằm trong &ldquo;Quy chế người bán&rdquo;, anh/chị đọc và bấm đồng ý ở
            bước cuối.
          </p>
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 28 }}>{cta()}</div>
      </main>
    </BuyerShell>
  );
}

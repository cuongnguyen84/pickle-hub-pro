// ============================================================================
// S10 — Seller settings /seller/settings
// ----------------------------------------------------------------------------
// Bank data is masked and behind a re-authentication step, because changing a
// payout account is the highest-value action an attacker can take with a
// stolen session.
//
// Design note carried from the approved proposal: the pilot does NOT collect
// bank details at all. This section is built because the board asks for it, and
// it is marked as out of scope for slice 1 on the screen itself.
// ============================================================================

import { useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle, Lock, ShieldCheck } from "lucide-react";
import { readVariant } from "../scenario";
import { SellerShell } from "../components/Shells";
import { DeniedState } from "../components/States";
import { shopById } from "../fixtures";

type State = "normal" | "reverify" | "bank-reauth" | "no-permission";

const STAFF = [
  { name: "Nguyễn Thị Thanh Hương", role: "Chủ shop", email: "huong@example.com" },
  { name: "Trần Minh Quân", role: "Nhân viên đóng gói", email: "quan@example.com" },
];

const Group = ({ id, title, children, note }: { id: string; title: string; children: React.ReactNode; note?: string }) => (
  <section aria-labelledby={id} style={{ marginBottom: 30 }}>
    <h2 className="tl-shop-h2" id={id} style={{ marginTop: 0 }}>
      {title}
    </h2>
    {note && (
      <p className="tl-shop-hint" style={{ marginTop: -6, marginBottom: 12 }}>
        {note}
      </p>
    )}
    {children}
  </section>
);

export default function S10Settings() {
  const location = useLocation();
  const state = (readVariant(location.search) || "normal") as State;
  const shop = shopById("shop-1");
  const [closeOpen, setCloseOpen] = useState(false);

  if (state === "no-permission")
    return (
      <SellerShell active="settings" title="Cài đặt shop">
        <div className="tl-shop-page">
          <DeniedState
            what="Anh/chị không có quyền xem cài đặt shop."
            cause="Chủ shop đã đặt tài khoản của anh/chị ở vai trò “Nhân viên đóng gói”."
            recovery="Vai trò này vào được Đơn hàng và Sản phẩm. Nhờ chủ shop đổi vai trò nếu cần thêm quyền."
          />
        </div>
      </SellerShell>
    );

  return (
    <SellerShell active="settings" title="Cài đặt shop">
      <div className="tl-shop-page tl-shop-page--narrow">
        <h1 className="tl-shop-sr">Cài đặt shop</h1>

        {state === "reverify" && (
          <div className="tl-shop-notice tl-shop-notice--warn">
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              <strong>Cần xác minh lại.</strong> Giấy phép kinh doanh anh/chị nộp đã hết hạn từ
              01/08/2026. Huy hiệu &ldquo;Đã xác minh&rdquo; đang tạm ẩn khỏi trang shop. Nộp
              bản mới để bật lại.
              <div style={{ marginTop: 10 }}>
                <button type="button" className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--primary">
                  Nộp giấy phép mới
                </button>
              </div>
            </div>
          </div>
        )}

        <Group id="s10-public" title="Thông tin công khai" note="Đây là phần người mua nhìn thấy.">
          <label className="tl-shop-field">
            <span className="tl-shop-label">Tên shop</span>
            <input className="tl-shop-input" defaultValue={shop.name} />
          </label>
          <label className="tl-shop-field">
            <span className="tl-shop-label">Giới thiệu ngắn</span>
            <textarea className="tl-shop-textarea" defaultValue="" placeholder="1–2 câu về shop." />
          </label>
          <label className="tl-shop-field">
            <span className="tl-shop-label">Tỉnh/thành gửi hàng</span>
            <input className="tl-shop-input" defaultValue={shop.city} />
            <span className="tl-shop-hint">Hiển thị là &ldquo;Gửi từ {shop.city}&rdquo;.</span>
          </label>
        </Group>

        <Group
          id="s10-legal"
          title="Thông tin pháp lý"
          note="Chỉ quản trị viên xem được. Không bao giờ hiện trên trang shop."
        >
          <div className="tl-shop-card" style={{ display: "grid", gap: 10, fontSize: 13.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <span style={{ color: "var(--tl-fg-3)" }}>Loại người bán</span>
              <span>Hộ kinh doanh</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <span style={{ color: "var(--tl-fg-3)" }}>Giấy phép</span>
              <span>
                <Lock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> Đã nộp ·{" "}
                <span className="tl-shop-pill tl-shop-pill--info">
                  <ShieldCheck size={11} aria-hidden="true" />
                  Xác minh 18/06/2026
                </span>
              </span>
            </div>
          </div>
        </Group>

        <Group id="s10-addr" title="Địa chỉ" note="Địa chỉ chi tiết chỉ dùng để in phiếu gửi hàng.">
          <label className="tl-shop-field">
            <span className="tl-shop-label">Địa chỉ gửi hàng</span>
            <input className="tl-shop-input" defaultValue="Số 12, ngõ 43 đường Nguyễn Văn Linh, Quận 7" />
          </label>
          <label className="tl-shop-field">
            <span className="tl-shop-label">Địa chỉ nhận hàng trả</span>
            <input className="tl-shop-input" defaultValue="" placeholder="Để trống nếu trùng địa chỉ gửi" />
          </label>
        </Group>

        <Group id="s10-ship" title="Vận chuyển">
          <label className="tl-shop-field">
            <span className="tl-shop-label">Phí vận chuyển mặc định (₫)</span>
            <input className="tl-shop-input" inputMode="numeric" defaultValue={35000} />
            <span className="tl-shop-hint">
              Áp cho sản phẩm mới. Chưa nối đơn vị vận chuyển nên không có tính phí theo cân
              nặng.
            </span>
          </label>
        </Group>

        <Group id="s10-policy" title="Chính sách đổi trả">
          <label className="tl-shop-field">
            <span className="tl-shop-label">Nội dung hiển thị cho người mua</span>
            <textarea className="tl-shop-textarea" defaultValue={shop.returnPolicy} />
            <span className="tl-shop-hint">
              Để trống thì trang sản phẩm sẽ ghi &ldquo;Người bán chưa đăng chính sách đổi
              trả&rdquo; — im lặng không phải là mặc định &ldquo;có đổi trả&rdquo;.
            </span>
          </label>
        </Group>

        <Group id="s10-bank" title="Tài khoản nhận tiền">
          <div className="tl-shop-notice tl-shop-notice--warn">
            <div>
              <strong>Ghi chú thiết kế:</strong> giai đoạn thử nghiệm{" "}
              <strong>không thu tài khoản ngân hàng</strong> (proposal §2). Phần này dựng sẵn
              cho giai đoạn có thanh toán qua nền tảng.
            </div>
          </div>
          {state === "bank-reauth" ? (
            <div className="tl-shop-notice tl-shop-notice--danger">
              <Lock size={16} aria-hidden="true" />
              <div>
                <strong>Nhập lại mật khẩu để đổi tài khoản nhận tiền.</strong> Đây là thao tác
                dễ bị lợi dụng nhất nếu ai đó chiếm được phiên đăng nhập của anh/chị.
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <input className="tl-shop-input" type="password" style={{ maxWidth: 200 }} aria-label="Mật khẩu" />
                  <button type="button" className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--primary">
                    Xác nhận
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="tl-shop-card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180, fontSize: 13.5 }}>
                <div style={{ color: "var(--tl-fg-3)" }}>Ngân hàng</div>
                <div>Vietcombank · •••• •••• 4821</div>
              </div>
              <button type="button" className="tl-shop-btn tl-shop-btn--sm">
                Đổi tài khoản
              </button>
            </div>
          )}
        </Group>

        <Group id="s10-staff" title="Nhân sự &amp; quyền">
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {STAFF.map((s) => (
              <li key={s.email} className="tl-shop-card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 170 }}>
                  <div style={{ fontWeight: 650, fontSize: 14 }}>{s.name}</div>
                  <div className="tl-shop-hint" style={{ marginTop: 2 }}>
                    {s.email}
                  </div>
                </div>
                <span className="tl-shop-pill">{s.role}</span>
              </li>
            ))}
          </ul>
          <p className="tl-shop-hint">
            &ldquo;Nhân viên đóng gói&rdquo; vào được Đơn hàng và Sản phẩm, không vào được Cài
            đặt và không đổi được tài khoản nhận tiền.
          </p>
        </Group>

        <Group id="s10-notif" title="Thông báo">
          {[
            ["Đơn hàng mới", true],
            ["Yêu cầu trả hàng / khiếu nại", true],
            ["Sản phẩm bị yêu cầu sửa", true],
            ["Tin tức từ ThePickleHub", false],
          ].map(([label, on]) => (
            <label key={String(label)} className="tl-shop-check">
              <input type="checkbox" defaultChecked={on as boolean} />
              {label}
            </label>
          ))}
        </Group>

        <Group id="s10-close" title="Đóng shop">
          {!closeOpen ? (
            <button type="button" className="tl-shop-btn tl-shop-btn--danger" onClick={() => setCloseOpen(true)}>
              Đóng shop
            </button>
          ) : (
            <div className="tl-shop-notice tl-shop-notice--danger">
              <AlertTriangle size={16} aria-hidden="true" />
              <div>
                <strong>Đóng shop sẽ:</strong>
                <ul style={{ margin: "8px 0", paddingLeft: 18, lineHeight: 1.6 }}>
                  <li>Ẩn toàn bộ sản phẩm khỏi trang mua hàng ngay lập tức.</li>
                  <li>
                    <strong>Không huỷ</strong> đơn đang xử lý — anh/chị vẫn phải gửi hàng hoặc
                    huỷ đúng quy trình cho từng đơn.
                  </li>
                  <li>Giữ dữ liệu 90 ngày, mở lại được trong thời gian đó.</li>
                </ul>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="tl-shop-btn tl-shop-btn--danger">
                    Vẫn đóng shop
                  </button>
                  <button type="button" className="tl-shop-btn" onClick={() => setCloseOpen(false)}>
                    Huỷ
                  </button>
                </div>
              </div>
            </div>
          )}
        </Group>
      </div>
    </SellerShell>
  );
}

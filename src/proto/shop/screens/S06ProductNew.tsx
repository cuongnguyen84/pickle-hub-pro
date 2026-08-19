// ============================================================================
// S06 — Create product /seller/products/new
// ----------------------------------------------------------------------------
// Acceptance: a first-time seller can create a valid simple product without
// meeting the advanced variant controls until they need them.
//
// So variants are OFF by default and section 5 shows one price + one stock
// field. Turning on "Sản phẩm có nhiều phiên bản" is what reveals the matrix.
// Every other section is answerable by someone photographing a paddle on their
// living-room floor.
// ============================================================================

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, Check, Image as ImageIcon, Upload } from "lucide-react";
import { readVariant } from "../scenario";
import { SellerShell } from "../components/Shells";
import { ProductMedia } from "../components/Primitives";
import { AutosaveIndicator, VariantMatrix, type AutosaveState } from "../components/Forms";
import { CATEGORIES, productById, vnd } from "../fixtures";

type Fixture = "paddle" | "shoes" | "used";
type State =
  | "normal"
  | "autosave"
  | "category-change"
  | "media-error"
  | "invalid-attrs"
  | "duplicate-sku"
  | "bulk"
  | "preview-errors"
  | "submitted";

const SECTIONS = [
  { id: "cat", label: "1. Danh mục" },
  { id: "basic", label: "2. Thông tin cơ bản" },
  { id: "media", label: "3. Ảnh" },
  { id: "attrs", label: "4. Thông số" },
  { id: "price", label: "5. Giá, phiên bản, tồn kho" },
  { id: "ship", label: "6. Vận chuyển" },
  { id: "policy", label: "7. Đổi trả & khai báo" },
  { id: "preview", label: "8. Xem trước & gửi duyệt" },
];

const Section = ({
  id,
  title,
  children,
  note,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  note?: string;
}) => (
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

export default function S06ProductNew() {
  const location = useLocation();
  const preset = (readVariant(location.search) || "normal") as State | Fixture;
  const fixture: Fixture = preset === "shoes" ? "shoes" : preset === "used" ? "used" : "paddle";
  const state = (["shoes", "used"].includes(preset) ? "normal" : preset) as State;

  const [hasVariants, setHasVariants] = useState(
    fixture === "shoes" || state === "bulk" || state === "duplicate-sku",
  );
  const [autosave] = useState<AutosaveState>(state === "autosave" ? "saving" : "saved");
  const [cat, setCat] = useState(fixture === "shoes" ? "giay" : "vot");
  const [condition, setCondition] = useState<"moi" | "da-qua-su-dung">(
    fixture === "used" ? "da-qua-su-dung" : "moi",
  );

  const shoes = productById("p-2");

  return (
    <SellerShell active="products" title="Thêm sản phẩm">
      <div className="tl-shop-page tl-shop-page--narrow">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <AutosaveIndicator state={autosave} savedAt="09:41" />
          <span className="tl-proto-spacer" />
          <span className="tl-shop-hint" style={{ marginTop: 0 }}>
            Nháp lưu tự động. Đóng trang không mất.
          </span>
        </div>

        <h1 className="tl-shop-h1">Thêm sản phẩm</h1>
        <p className="tl-shop-sub">
          Bắt buộc: danh mục, tên, ảnh, giá. Phần còn lại điền được thì tốt, không điền cũng
          đăng được.
        </p>

        <nav aria-label="Các phần" style={{ marginBottom: 24 }}>
          <div className="tl-shop-cats">
            {SECTIONS.map((sc) => (
              <a key={sc.id} href={`#${sc.id}`} className="tl-shop-cat">
                {sc.label}
              </a>
            ))}
          </div>
        </nav>

        {state === "submitted" && (
          <div className="tl-shop-notice tl-shop-notice--info" role="status">
            <Check size={16} aria-hidden="true" />
            <div>
              <strong>Đã gửi duyệt.</strong> Sản phẩm chuyển sang trạng thái &ldquo;Chờ
              duyệt&rdquo;. Người mua chưa nhìn thấy cho tới khi được duyệt.{" "}
              <Link to="/proto/shop/seller/products">Xem danh sách sản phẩm</Link>
            </div>
          </div>
        )}

        <Section
          id="cat"
          title="1. Danh mục"
          note="Danh mục quyết định phần thông số ở bước 4. Đổi danh mục sau khi đã điền thông số sẽ mất phần đó."
        >
          <label className="tl-shop-field">
            <span className="tl-shop-label">Danh mục</span>
            <select className="tl-shop-select" value={cat} onChange={(e) => setCat(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {state === "category-change" && (
            <div className="tl-shop-notice tl-shop-notice--warn">
              <AlertTriangle size={16} aria-hidden="true" />
              <div>
                <strong>Đổi danh mục sẽ xoá 7 thông số đã điền</strong> (trọng lượng, độ dày,
                chất liệu…) vì danh mục mới dùng bộ thông số khác. Ảnh, tên và giá vẫn giữ
                nguyên.
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--danger">
                    Vẫn đổi
                  </button>
                  <button type="button" className="tl-shop-btn tl-shop-btn--sm">
                    Giữ danh mục cũ
                  </button>
                </div>
              </div>
            </div>
          )}
        </Section>

        <Section id="basic" title="2. Thông tin cơ bản">
          <label className="tl-shop-field">
            <span className="tl-shop-label">Tên sản phẩm</span>
            <input
              className="tl-shop-input"
              defaultValue={
                fixture === "shoes"
                  ? shoes.title
                  : fixture === "used"
                    ? "Vợt đã qua sử dụng ~6 tháng, mặt còn nhám"
                    : "Vợt pickleball carbon T700 16mm"
              }
            />
            <span className="tl-shop-hint">
              Viết như anh/chị nói với khách: loại + chất liệu + điểm đáng chú ý. Không cần
              nhồi từ khoá.
            </span>
          </label>

          <fieldset style={{ border: 0, padding: 0, margin: "0 0 16px" }}>
            <legend className="tl-shop-label" style={{ padding: 0 }}>
              Tình trạng
            </legend>
            <div className="tl-shop-optrow">
              {(
                [
                  ["moi", "Mới"],
                  ["da-qua-su-dung", "Đã qua sử dụng"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  className="tl-shop-opt"
                  aria-pressed={condition === v}
                  onClick={() => setCondition(v)}
                >
                  {l}
                </button>
              ))}
            </div>
            {condition === "da-qua-su-dung" && (
              <p className="tl-shop-hint">
                Hàng cũ bắt buộc mô tả rõ vết xước, mức mòn và chụp ảnh chỗ hỏng. Đây là lý do
                khiếu nại phổ biến nhất.
              </p>
            )}
          </fieldset>

          <label className="tl-shop-field">
            <span className="tl-shop-label">Mô tả</span>
            <textarea className="tl-shop-textarea" defaultValue="" placeholder="Vài câu về sản phẩm." />
          </label>
        </Section>

        <Section id="media" title="3. Ảnh" note="Tối đa 8 MB mỗi ảnh. Ảnh chụp bằng điện thoại là đủ.">
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}>
            <div style={{ position: "relative" }}>
              <ProductMedia label="Ảnh 1 · ảnh bìa" />
            </div>
            <div style={{ position: "relative" }}>
              <ProductMedia tone="b" label="Ảnh 2" />
            </div>
            <button
              type="button"
              className="tl-shop-media"
              style={{ borderStyle: "dashed", cursor: "pointer", flexDirection: "column", gap: 6 }}
              aria-label="Thêm ảnh sản phẩm"
            >
              <Upload size={20} aria-hidden="true" />
              <span className="tl-shop-media-label">Thêm ảnh</span>
            </button>
          </div>
          {state === "media-error" && (
            <div className="tl-shop-notice tl-shop-notice--danger" style={{ marginTop: 12 }}>
              <ImageIcon size={16} aria-hidden="true" />
              <div>
                <strong>Ảnh &ldquo;IMG_2043.HEIC&rdquo; vượt quá 8 MB nên chưa tải lên được.</strong>{" "}
                Chụp lại ở chế độ thường thay vì HDR, hoặc chọn ảnh khác.
                <div style={{ marginTop: 8 }}>
                  <button type="button" className="tl-shop-btn tl-shop-btn--sm">
                    Thử lại
                  </button>
                </div>
              </div>
            </div>
          )}
          <p className="tl-shop-hint">
            Ảnh lấy từ shop khác sẽ bị từ chối. Đừng chèn số điện thoại lên ảnh — người mua đã
            có cách liên hệ trong đơn hàng.
          </p>
        </Section>

        <Section id="attrs" title="4. Thông số" note="Điền được cái nào tốt cái đó. Người mua lọc theo đúng những trường này.">
          {[
            "Trọng lượng (oz)",
            "Độ dày mặt vợt (mm)",
            "Chất liệu mặt",
            "Lõi",
            "Dáng vợt",
            "Chu vi cán (cm)",
          ].map((label, i) => (
            <label key={label} className="tl-shop-field" style={{ marginBottom: 12 }}>
              <span className="tl-shop-label">{label}</span>
              <input
                className="tl-shop-input"
                aria-invalid={state === "invalid-attrs" && i === 0 ? true : undefined}
                defaultValue={state === "invalid-attrs" && i === 0 ? "tám phẩy không" : ""}
              />
              {state === "invalid-attrs" && i === 0 && (
                <span className="tl-shop-error">
                  <AlertTriangle size={13} aria-hidden="true" />
                  Trọng lượng phải là số, ví dụ 8.0. Người mua lọc theo khoảng trọng lượng nên
                  chữ sẽ không lọc được.
                </span>
              )}
            </label>
          ))}
        </Section>

        <Section id="price" title="5. Giá, phiên bản, tồn kho">
          <label className="tl-shop-check" style={{ marginBottom: 14 }}>
            <input type="checkbox" checked={hasVariants} onChange={(e) => setHasVariants(e.target.checked)} />
            Sản phẩm có nhiều phiên bản (màu, size…)
          </label>

          {!hasVariants ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                <span className="tl-shop-label">Giá (₫)</span>
                <input className="tl-shop-input" inputMode="numeric" defaultValue={2450000} />
                <span className="tl-shop-hint">Hiển thị: {vnd(2450000)}</span>
              </label>
              <label>
                <span className="tl-shop-label">Tồn kho</span>
                <input className="tl-shop-input" inputMode="numeric" placeholder="để trống nếu không đếm" />
                <span className="tl-shop-hint">Bỏ trống thì trang chỉ ghi &ldquo;Còn hàng&rdquo;.</span>
              </label>
            </div>
          ) : (
            <>
              <VariantMatrix product={shoes} onBulk={() => {}} />
              {state === "duplicate-sku" && (
                <div className="tl-shop-notice tl-shop-notice--danger" style={{ marginTop: 12 }}>
                  <AlertTriangle size={16} aria-hidden="true" />
                  <div>
                    <strong>Mã hàng &ldquo;PG-CP-W40&rdquo; bị trùng</strong> giữa Trắng/40 và
                    Đen/40. Mã hàng phải khác nhau để in phiếu gửi không nhầm.
                  </div>
                </div>
              )}
              {state === "bulk" && (
                <div className="tl-shop-notice tl-shop-notice--info" style={{ marginTop: 12 }}>
                  <div>
                    <strong>Đặt giá cho 6 phiên bản cùng lúc.</strong>
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <input className="tl-shop-input" style={{ maxWidth: 150 }} inputMode="numeric" defaultValue={1290000} />
                      <button type="button" className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--primary">
                        Áp cho tất cả
                      </button>
                      <button type="button" className="tl-shop-btn tl-shop-btn--sm">
                        Huỷ
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </Section>

        <Section id="ship" title="6. Vận chuyển">
          <label className="tl-shop-field">
            <span className="tl-shop-label">Gửi từ</span>
            <input className="tl-shop-input" defaultValue="TP. Hồ Chí Minh" />
            <span className="tl-shop-hint">
              Người mua chỉ thấy tên tỉnh/thành. Địa chỉ chi tiết nằm trong Cài đặt shop.
            </span>
          </label>
          <label className="tl-shop-field">
            <span className="tl-shop-label">Phí vận chuyển (₫)</span>
            <input className="tl-shop-input" inputMode="numeric" defaultValue={35000} />
            <span className="tl-shop-hint">
              Phí cố định cho mỗi đơn. Chưa nối với đơn vị vận chuyển nào nên không có tính phí
              tự động, và trang sản phẩm không hứa ngày giao.
            </span>
          </label>
        </Section>

        <Section id="policy" title="7. Đổi trả & khai báo">
          <label className="tl-shop-field">
            <span className="tl-shop-label">Thời hạn đổi trả</span>
            <select className="tl-shop-select" defaultValue="7">
              <option value="">Không nhận đổi trả</option>
              <option value="3">3 ngày</option>
              <option value="7">7 ngày</option>
              <option value="14">14 ngày</option>
            </select>
            <span className="tl-shop-hint">
              Chọn &ldquo;Không nhận đổi trả&rdquo; thì trang sản phẩm sẽ ghi rõ như vậy trước
              khi người mua bấm mua.
            </span>
          </label>
          <label className="tl-shop-check" style={{ alignItems: "flex-start" }}>
            <input type="checkbox" style={{ marginTop: 3 }} />
            <span>
              Tôi xác nhận sản phẩm này là hàng chính hãng hoặc hàng cũ đúng mô tả, không phải
              hàng giả, hàng nhái nhãn hiệu.
            </span>
          </label>
        </Section>

        <Section id="preview" title="8. Xem trước & gửi duyệt">
          {state === "preview-errors" ? (
            <div className="tl-shop-notice tl-shop-notice--danger">
              <AlertTriangle size={16} aria-hidden="true" />
              <div>
                <strong>Còn 2 chỗ chưa xong:</strong>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  <li>
                    <a href="#media">Ảnh</a> — cần ít nhất 1 ảnh.
                  </li>
                  <li>
                    <a href="#price">Giá</a> — chưa điền giá.
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="tl-shop-notice tl-shop-notice--info">
              <div>
                Sau khi gửi, sản phẩm ở trạng thái <strong>Chờ duyệt</strong>. Người mua chưa
                nhìn thấy. Nếu cần sửa, quản trị viên sẽ ghi rõ cần sửa gì.
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="tl-shop-btn tl-shop-btn--primary" disabled={state === "preview-errors"}>
              Gửi duyệt
            </button>
            <button type="button" className="tl-shop-btn">
              Xem trước như người mua
            </button>
            <button type="button" className="tl-shop-btn tl-shop-btn--ghost">
              Lưu nháp và thoát
            </button>
          </div>
        </Section>
      </div>
    </SellerShell>
  );
}

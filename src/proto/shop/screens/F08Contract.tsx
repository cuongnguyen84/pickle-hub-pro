// ============================================================================
// F08 — Shared copy + accessibility contract (reference screen)
// ============================================================================

import {
  GLOSSARY,
  ERROR_PATTERNS,
  ICON_NAMES,
  HEADING_RULES,
  LIVE_REGION_RULES,
  FOCUS_RULES,
} from "../copy";
import { MatrixSection } from "../components/Matrix";

const List = ({ items }: { items: string[] }) => (
  <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8, fontSize: 13.5, lineHeight: 1.55, color: "var(--tl-fg-2)" }}>
    {items.map((r) => (
      <li key={r}>{r}</li>
    ))}
  </ul>
);

export default function F08Contract() {
  return (
    <main className="tl-shop-page tl-shop-page--narrow">
      <p className="tl-shop-eyebrow">F08</p>
      <h1 className="tl-shop-h1">Quy ước chữ nghĩa &amp; tiếp cận</h1>
      <p className="tl-shop-sub">
        Danh sách từ cấm bên dưới được kiểm tra tự động
        (<code>src/proto/shop/__tests__/copy-contract.test.ts</code>) — màn hình nào lén dùng
        lại sẽ làm hỏng bài kiểm tra, không phụ thuộc vào việc người duyệt có để ý hay không.
      </p>

      <MatrixSection id="f08-glossary" title="Từ điển thuật ngữ">
        <div className="tl-shop-tablewrap">
          <table className="tl-shop-table">
            <thead>
              <tr>
                <th scope="col">Dùng</th>
                <th scope="col">EN</th>
                <th scope="col">Vì sao</th>
              </tr>
            </thead>
            <tbody>
              {GLOSSARY.map((g) => (
                <tr key={g.term}>
                  <td style={{ fontWeight: 650, whiteSpace: "nowrap" }}>{g.term}</td>
                  <td style={{ color: "var(--tl-fg-3)", whiteSpace: "nowrap" }}>{g.en}</td>
                  <td style={{ lineHeight: 1.5 }}>
                    {g.why}
                    {g.banned && (
                      <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {g.banned.map((b) => (
                          <span key={b} className="tl-shop-pill tl-shop-pill--danger">
                            cấm: {b}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MatrixSection>

      <MatrixSection
        id="f08-errors"
        title="Khuôn câu báo lỗi: chuyện gì → vì sao → làm gì tiếp"
        note="Phần “vì sao” được phép bỏ khi không biết thật. Phần “làm gì tiếp” thì không bao giờ được bỏ."
      >
        <div style={{ display: "grid", gap: 12 }}>
          {ERROR_PATTERNS.map(({ key, copy }) => (
            <div key={key} className="tl-shop-card">
              <p className="tl-shop-eyebrow" style={{ display: "block", marginBottom: 8 }}>
                {key}
              </p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
                <strong>{copy.what}</strong> {copy.cause} {copy.recovery}
              </p>
            </div>
          ))}
        </div>
      </MatrixSection>

      <MatrixSection id="f08-icons" title="Tên đọc được của nút chỉ có biểu tượng">
        <div className="tl-shop-tablewrap">
          <table className="tl-shop-table">
            <thead>
              <tr>
                <th scope="col">Nút</th>
                <th scope="col">aria-label</th>
              </tr>
            </thead>
            <tbody>
              {ICON_NAMES.map((i) => (
                <tr key={i.icon}>
                  <td style={{ whiteSpace: "nowrap" }}>{i.icon}</td>
                  <td>
                    <code style={{ fontSize: 12 }}>{i.name}</code>
                    {i.note && <div className="tl-shop-hint">{i.note}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MatrixSection>

      <MatrixSection id="f08-headings" title="Cấu trúc tiêu đề">
        <List items={HEADING_RULES} />
      </MatrixSection>

      <MatrixSection id="f08-live" title="Vùng thông báo động (live region)">
        <List items={LIVE_REGION_RULES} />
      </MatrixSection>

      <MatrixSection id="f08-focus" title="Quy tắc trả tiêu điểm bàn phím">
        <List items={FOCUS_RULES} />
      </MatrixSection>
    </main>
  );
}

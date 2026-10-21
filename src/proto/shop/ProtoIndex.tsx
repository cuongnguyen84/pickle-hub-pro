// ============================================================================
// Shop prototype — screen index (F01 "development navigation")
// ----------------------------------------------------------------------------
// The page the product owner opens first. Lists every built screen grouped by
// delivery batch, with its board task id and every scenario link that the
// screenshot harness captures — so a reviewer can reach any screenshot state
// by clicking, not by guessing query strings.
// ============================================================================

import { Link } from "react-router-dom";
import { BATCH_LABEL, screensByBatch, type Batch } from "./registry";
import { SCENARIOS, SCENARIO_LABEL_VI } from "./scenario";

const BATCH_ORDER: Batch[] = ["F", "B1", "S1", "S2", "B2", "A", "Q"];

export default function ProtoIndex() {
  const byBatch = screensByBatch();
  const total = BATCH_ORDER.reduce((n, b) => n + byBatch[b].length, 0);

  return (
    <main className="tl-shop-page">
      <p className="tl-shop-eyebrow">ThePickleHub · Shop</p>
      <h1 className="tl-shop-h1">Bản mẫu màn hình Shop</h1>
      <p className="tl-shop-sub">
        {total} màn hình đã dựng. Toàn bộ dữ liệu là giả lập và cố định — mở cùng một
        đường dẫn hai lần luôn cho ra cùng một màn hình.
      </p>

      <div className="tl-shop-notice tl-shop-notice--warn">
        <div>
          <strong>Đây không phải trang thật.</strong> Không có thanh toán, không ghi vào cơ
          sở dữ liệu, không có sản phẩm thật. Trang này chặn công cụ tìm kiếm ở 3 lớp
          (thẻ noindex, robots.txt, header X-Robots-Tag).
        </div>
      </div>

      <section aria-labelledby="proto-scenarios">
        <h2 className="tl-shop-h2" id="proto-scenarios">
          Kịch bản dùng chung
        </h2>
        <p className="tl-shop-hint" style={{ marginTop: 0, marginBottom: 12 }}>
          Thêm <code>?scenario=…</code> vào bất kỳ đường dẫn nào, hoặc dùng ô chọn trên
          thanh vàng ở đầu trang.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SCENARIOS.map((sc) => (
            <span key={sc} className="tl-shop-pill">
              <code style={{ fontSize: 10.5 }}>{sc}</code> · {SCENARIO_LABEL_VI[sc]}
            </span>
          ))}
        </div>
      </section>

      {BATCH_ORDER.filter((b) => byBatch[b].length > 0).map((batch) => (
        <section key={batch} aria-labelledby={`batch-${batch}`}>
          <h2 className="tl-shop-h2" id={`batch-${batch}`}>
            {BATCH_LABEL[batch]}
          </h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {byBatch[batch].map((sc) => (
              <li key={sc.id} className="tl-shop-card">
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <code className="tl-shop-eyebrow">{sc.id}</code>
                  <Link
                    to={`/proto/shop/${sc.route}`}
                    style={{ color: "var(--tl-fg)", fontWeight: 650, fontSize: 15 }}
                  >
                    {sc.title}
                  </Link>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {sc.shots.map((shot) => (
                    <Link
                      key={shot.label}
                      to={`/proto/shop${shot.url}`}
                      className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--ghost"
                    >
                      {shot.label}
                      <span style={{ color: "var(--tl-fg-3)", fontWeight: 400 }}>
                        {shot.widths.join(" · ")}px
                      </span>
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

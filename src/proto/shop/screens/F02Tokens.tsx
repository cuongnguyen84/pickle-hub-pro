// ============================================================================
// F02 — Shop design tokens (specimen + contrast check)
// ----------------------------------------------------------------------------
// The specimen is also the check: contrast ratios are computed from the LIVE
// computed styles, so if someone later edits a token to something illegible the
// screen says FAIL instead of looking fine in a screenshot. Toggle light/dark
// on the page to validate both modes without leaving it.
// ============================================================================

import { useEffect, useMemo, useState } from "react";

// ─── Contrast maths (WCAG 2.1 relative luminance) ───────────────────────────

const srgbToLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

/** Accepts any colour the browser can resolve; returns [r,g,b] 0-255. */
const parseRgb = (css: string): [number, number, number] => {
  const m = css.match(/-?[\d.]+/g);
  if (!m) return [0, 0, 0];
  return [Number(m[0]), Number(m[1]), Number(m[2])];
};

const luminance = (rgb: [number, number, number]) => {
  const [r, g, b] = rgb.map((v) => srgbToLinear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (fg: string, bg: string): number => {
  const a = luminance(parseRgb(fg));
  const b = luminance(parseRgb(bg));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

/** Resolve a CSS custom property to a concrete rgb() string via the browser. */
const resolve = (host: HTMLElement, value: string): string => {
  const probe = document.createElement("span");
  probe.style.color = value;
  probe.style.display = "none";
  host.appendChild(probe);
  const out = getComputedStyle(probe).color;
  probe.remove();
  return out;
};

// ─── Token tables ───────────────────────────────────────────────────────────

const BASE_TOKENS = [
  { name: "--tl-bg", note: "Nền trang" },
  { name: "--tl-surface", note: "Thẻ, panel" },
  { name: "--tl-surface-2", note: "Nền nổi, input" },
  { name: "--tl-border", note: "Đường viền mảnh" },
  { name: "--tl-border-2", note: "Viền nút, viền rõ" },
  { name: "--tl-fg", note: "Chữ chính" },
  { name: "--tl-fg-2", note: "Chữ phụ" },
  { name: "--tl-fg-3", note: "Chữ mờ, chú thích" },
  { name: "--tl-green", note: "Hành động chính" },
];

const COMMERCE_TOKENS = [
  { name: "--shop-price", alias: "--tl-fg", note: "Số tiền người mua trả" },
  { name: "--shop-price-was", alias: "--tl-fg-3", note: "Giá cũ gạch ngang" },
  { name: "--shop-stock-ok", alias: "--tl-accent-qt", note: "Còn hàng" },
  { name: "--shop-stock-low", alias: "--tl-gold", note: "Còn ít — chỉ khi biết số thật" },
  { name: "--shop-stock-out", alias: "--tl-fg-3", note: "Hết hàng (xám, không đỏ)" },
  { name: "--shop-verified", alias: "--tl-blue", note: "Danh tính đã xác minh" },
  { name: "--shop-warning", alias: "--tl-gold", note: "Cần người dùng để ý" },
  { name: "--shop-danger", alias: "--tl-live", note: "Huỷ / hoàn tiền / mất dữ liệu" },
  { name: "--shop-used", alias: "--tl-accent-team", note: "Hàng đã qua sử dụng" },
];

/** Pairs that carry meaning and therefore must pass WCAG AA (4.5:1 for text). */
const CONTRAST_PAIRS: { fg: string; bg: string; label: string; min: number }[] = [
  { fg: "var(--tl-fg)", bg: "var(--tl-bg)", label: "Chữ chính / nền", min: 4.5 },
  { fg: "var(--tl-fg-2)", bg: "var(--tl-surface)", label: "Chữ phụ / thẻ", min: 4.5 },
  { fg: "var(--tl-fg-3)", bg: "var(--tl-surface)", label: "Chú thích / thẻ", min: 4.5 },
  { fg: "var(--shop-price)", bg: "var(--tl-surface)", label: "Giá / thẻ", min: 4.5 },
  { fg: "var(--shop-stock-ok)", bg: "var(--tl-surface)", label: "Còn hàng / thẻ", min: 4.5 },
  { fg: "var(--shop-stock-low)", bg: "var(--tl-surface)", label: "Còn ít / thẻ", min: 4.5 },
  { fg: "var(--shop-stock-out)", bg: "var(--tl-surface)", label: "Hết hàng / thẻ", min: 4.5 },
  { fg: "var(--shop-verified)", bg: "var(--tl-surface)", label: "Đã xác minh / thẻ", min: 4.5 },
  { fg: "var(--shop-warning)", bg: "var(--tl-surface)", label: "Cảnh báo / thẻ", min: 4.5 },
  { fg: "var(--shop-danger)", bg: "var(--tl-surface)", label: "Nguy hiểm / thẻ", min: 4.5 },
  { fg: "var(--shop-used)", bg: "var(--tl-surface)", label: "Hàng cũ / thẻ", min: 4.5 },
  { fg: "#101803", bg: "var(--tl-green)", label: "Chữ trên nút chính", min: 4.5 },
  { fg: "#17140a", bg: "var(--tl-gold)", label: "Chữ trên thanh bản mẫu", min: 4.5 },
];

export default function F02Tokens() {
  const [mode, setMode] = useState<"dark" | "light">(
    () => (document.documentElement.getAttribute("data-mode") === "light" ? "light" : "dark"),
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "light") root.setAttribute("data-mode", "light");
    else root.removeAttribute("data-mode");
    // Recompute after the attribute lands so ratios reflect the visible mode.
    const id = requestAnimationFrame(() => setTick((t) => t + 1));
    return () => cancelAnimationFrame(id);
  }, [mode]);

  const results = useMemo(() => {
    void tick;
    const host = document.querySelector(".tl-shop") as HTMLElement | null;
    if (!host) return [];
    return CONTRAST_PAIRS.map((p) => {
      const ratio = contrastRatio(resolve(host, p.fg), resolve(host, p.bg));
      return { ...p, ratio, pass: ratio >= p.min };
    });
  }, [tick]);

  const failures = results.filter((r) => !r.pass);

  return (
    <main className="tl-shop-page">
      <p className="tl-shop-eyebrow">F02</p>
      <h1 className="tl-shop-h1">Token thiết kế Shop</h1>
      <p className="tl-shop-sub">
        Shop không thêm màu mới, không thêm font mới. Mỗi token thương mại chỉ là tên gọi
        khác của một token The Line đã có, để khi bảng màu đổi thì Shop đổi theo.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          className={`tl-shop-btn tl-shop-btn--sm ${mode === "dark" ? "tl-shop-btn--primary" : ""}`}
          onClick={() => setMode("dark")}
          aria-pressed={mode === "dark"}
        >
          Nền tối
        </button>
        <button
          type="button"
          className={`tl-shop-btn tl-shop-btn--sm ${mode === "light" ? "tl-shop-btn--primary" : ""}`}
          onClick={() => setMode("light")}
          aria-pressed={mode === "light"}
        >
          Nền sáng
        </button>
      </div>

      <h2 className="tl-shop-h2">Token The Line dùng lại</h2>
      <div className="tl-spec-grid">
        {BASE_TOKENS.map((t) => (
          <div key={t.name} className="tl-spec-chip">
            <div className="tl-spec-swatch" style={{ background: `var(${t.name})` }} />
            <div className="tl-spec-meta">
              <code>{t.name}</code>
              {t.note}
            </div>
          </div>
        ))}
      </div>

      <h2 className="tl-shop-h2">Token ngữ nghĩa thương mại (mới)</h2>
      <div className="tl-spec-grid">
        {COMMERCE_TOKENS.map((t) => (
          <div key={t.name} className="tl-spec-chip">
            <div className="tl-spec-swatch" style={{ background: `var(${t.name})` }} />
            <div className="tl-spec-meta">
              <code>{t.name}</code>
              <code style={{ color: "var(--tl-fg-4)" }}>= {t.alias}</code>
              {t.note}
            </div>
          </div>
        ))}
      </div>

      <h2 className="tl-shop-h2">Kiểm tra tương phản (đo trực tiếp trên màn hình này)</h2>
      <div
        className={`tl-shop-notice ${failures.length ? "tl-shop-notice--danger" : "tl-shop-notice--info"}`}
        role="status"
      >
        <div>
          {failures.length === 0 ? (
            <>
              <strong>Đạt.</strong> {results.length}/{results.length} cặp màu đạt WCAG AA
              (≥ 4.5:1) ở chế độ {mode === "light" ? "nền sáng" : "nền tối"}.
            </>
          ) : (
            <>
              <strong>{failures.length} cặp không đạt</strong> ở chế độ{" "}
              {mode === "light" ? "nền sáng" : "nền tối"}: {failures.map((f) => f.label).join(", ")}.
            </>
          )}
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 420, borderCollapse: "collapse", fontSize: 13.5 }}>
          <caption className="tl-shop-sr">
            Tỉ lệ tương phản của từng cặp màu chữ trên nền
          </caption>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--tl-fg-3)" }}>
              <th scope="col" style={{ padding: "8px 10px", fontWeight: 600 }}>Cặp màu</th>
              <th scope="col" style={{ padding: "8px 10px", fontWeight: 600 }}>Tỉ lệ</th>
              <th scope="col" style={{ padding: "8px 10px", fontWeight: 600 }}>Kết quả</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.label} style={{ borderTop: "1px solid var(--tl-border)" }}>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ background: r.bg, color: r.fg, padding: "2px 8px", borderRadius: 6 }}>
                    {r.label}
                  </span>
                </td>
                <td style={{ padding: "8px 10px", fontVariantNumeric: "tabular-nums" }}>
                  {r.ratio.toFixed(2)}:1
                </td>
                <td style={{ padding: "8px 10px" }}>
                  <span className={`tl-shop-pill ${r.pass ? "tl-shop-pill--ok" : "tl-shop-pill--danger"}`}>
                    {r.pass ? "Đạt AA" : "Không đạt"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="tl-shop-h2">Chữ</h2>
      <div className="tl-shop-card">
        <p style={{ margin: 0, fontSize: 13, color: "var(--tl-fg-3)" }}>
          Không thêm font mới. Shop dùng đúng bộ chữ của The Line:
        </p>
        <p style={{ fontFamily: "Geist, system-ui, sans-serif", fontSize: 22, fontWeight: 650, margin: "12px 0 4px" }}>
          Geist — Vợt pickleball carbon 16mm
        </p>
        <p style={{ fontFamily: '"Geist Mono", ui-monospace, monospace', fontSize: 15, margin: "0 0 4px", color: "var(--tl-fg-2)" }}>
          Geist Mono — PH-2608-0041 · 2.450.000₫
        </p>
        <p style={{ fontFamily: '"Instrument Serif", serif', fontStyle: "italic", fontSize: 26, margin: 0, color: "var(--tl-fg-2)" }}>
          Instrument Serif — chỉ dùng cho tiêu đề biên tập
        </p>
      </div>
    </main>
  );
}

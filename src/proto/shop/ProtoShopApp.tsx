// ============================================================================
// Shop prototype — isolated entry (F01)
// ----------------------------------------------------------------------------
// Mounted at /proto/shop/* from App.tsx as a single lazy chunk, so production
// pages never download prototype code.
//
// Three separate guards keep this off Google (board Rule 8):
//   1. <DynamicMeta noindex> here
//   2. Disallow: /proto in public/robots.txt AND functions/robots.txt.ts
//   3. NOINDEX_PATTERNS in functions/_middleware.ts → X-Robots-Tag header
//      plus the noindex bot shell, so a crawler never even sees the SPA.
// ============================================================================

import { Suspense, useEffect } from "react";
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { SCREENS } from "./registry";
import ProtoIndex from "./ProtoIndex";
import { SCENARIOS, SCENARIO_LABEL_VI, readScenario, type Scenario } from "./scenario";
import "@/styles/the-line.css";
import "@/styles/shop.css";

/** Sticky, unmissable "this is not production" chrome + the scenario switch. */
const ProtoBanner = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const scenario = readScenario(location.search);
  const isIndex = location.pathname.replace(/\/+$/, "").endsWith("/proto/shop");

  const setScenario = (next: Scenario) => {
    const p = new URLSearchParams(location.search);
    if (next === "normal") p.delete("scenario");
    else p.set("scenario", next);
    const q = p.toString();
    navigate(`${location.pathname}${q ? `?${q}` : ""}`, { replace: true });
  };

  return (
    <div className="tl-proto-banner" role="region" aria-label="Thanh công cụ bản mẫu">
      <span aria-hidden="true">▲</span>
      <span>Bản mẫu — dữ liệu giả lập, không phải trang thật</span>
      <span className="tl-proto-spacer" />
      {!isIndex && (
        <label>
          <span className="tl-shop-sr">Kịch bản hiển thị</span>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as Scenario)}
            aria-label="Kịch bản hiển thị"
          >
            {SCENARIOS.map((sc) => (
              <option key={sc} value={sc}>
                {SCENARIO_LABEL_VI[sc]}
              </option>
            ))}
          </select>
        </label>
      )}
      <Link to="/proto/shop">Danh sách màn hình</Link>
    </div>
  );
};

const ProtoFallback = () => (
  <div className="tl-shop-page" aria-busy="true">
    <div className="tl-shop-sk" style={{ height: 28, width: "42%", marginBottom: 14 }} />
    <div className="tl-shop-sk" style={{ height: 180 }} />
  </div>
);

export default function ProtoShopApp() {
  // Pin The Line the same way TheLineLayout / AdminLayout do, and restore the
  // previous value on unmount so leaving the prototype does not recolour the app.
  useEffect(() => {
    const root = document.documentElement;
    const prevTheme = root.getAttribute("data-theme");
    const prevMode = root.getAttribute("data-mode");
    root.setAttribute("data-theme", "the-line");
    const stored = typeof window !== "undefined" ? localStorage.getItem("tl-theme-mode") : null;
    if (stored === "light") root.setAttribute("data-mode", "light");
    else root.removeAttribute("data-mode");
    return () => {
      if (prevTheme) root.setAttribute("data-theme", prevTheme);
      else root.removeAttribute("data-theme");
      if (prevMode) root.setAttribute("data-mode", prevMode);
      else root.removeAttribute("data-mode");
    };
  }, []);

  // The screenshot harness (scripts/proto-shop-shots.mjs) reads the shot list
  // from here instead of duplicating it, so a new screen is captured the moment
  // it lands in registry.tsx.
  useEffect(() => {
    (window as unknown as { __PROTO_SHOTS__?: unknown }).__PROTO_SHOTS__ = SCREENS.map((sc) => ({
      id: sc.id,
      title: sc.title,
      batch: sc.batch,
      shots: sc.shots,
    }));
  }, []);

  // html / body / #root are all `overflow: hidden; height: 100%` (src/index.css),
  // so the document never scrolls — every page has to own its scroll container.
  // Same split as .tl-root / .tl-scroll in the-line.css: the outer box is fixed
  // to the viewport, the inner one scrolls. The banner sits OUTSIDE the scroller
  // so it stays put without needing `position: sticky`.
  return (
    <div className="tl-shop">
      <DynamicMeta
        title="Shop — bản mẫu màn hình"
        description="Bản mẫu giao diện Shop. Dữ liệu giả lập, không phải trang thật."
        noindex
      />
      <ProtoBanner />
      <div className="tl-shop-scroll">
        <Suspense fallback={<ProtoFallback />}>
          <Routes>
            <Route index element={<ProtoIndex />} />
            {SCREENS.map((sc) => (
              <Route key={sc.id} path={sc.route} element={<sc.Component />} />
            ))}
            <Route path="*" element={<Navigate to="/proto/shop" replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}

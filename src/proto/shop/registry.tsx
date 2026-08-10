// ============================================================================
// Shop prototype — screen registry (F01)
// ----------------------------------------------------------------------------
// Single source of truth for three consumers:
//   1. ProtoShopApp     — builds <Route> entries
//   2. ProtoIndex       — the prototype navigation the product owner browses
//   3. scripts/proto-shop-shots.mjs — the screenshot harness (reads `shots`)
//
// Adding a screen means adding one entry here. Nothing else needs to change.
// ============================================================================

import { lazy, type LazyExoticComponent, type ComponentType } from "react";

export type Batch = "F" | "B1" | "B2" | "S1" | "S2" | "A" | "Q";

export interface Shot {
  /** Short label used in the screenshot filename. */
  label: string;
  /** URL relative to /proto/shop, including any ?scenario= / ?variant=. */
  url: string;
  /** Viewport widths this shot must be captured at (board-specified). */
  widths: number[];
}

export interface ProtoScreen {
  /** Task id from the board, e.g. "B04". */
  id: string;
  title: string;
  batch: Batch;
  /** React Router path relative to /proto/shop. */
  route: string;
  Component: LazyExoticComponent<ComponentType>;
  shots: Shot[];
}

const s = (label: string, url: string, widths: number[]): Shot => ({ label, url, widths });

export const SCREENS: ProtoScreen[] = [
  // ── F — shared foundation ────────────────────────────────────────────────
  {
    id: "F02",
    title: "Token specimen",
    batch: "F",
    route: "tokens",
    Component: lazy(() => import("./screens/F02Tokens")),
    shots: [s("specimen", "/tokens", [375, 1440])],
  },
  {
    id: "F03",
    title: "Shell — buyer / seller / admin",
    batch: "F",
    route: "shells",
    Component: lazy(() => import("./screens/F03Shells")),
    shots: [
      s("buyer", "/shells?variant=buyer", [375, 768, 1440]),
      s("seller", "/shells?variant=seller", [375, 768, 1440]),
      s("admin", "/shells?variant=admin", [375, 768, 1440]),
    ],
  },
  {
    id: "F04",
    title: "Discovery primitives",
    batch: "F",
    route: "primitives/discovery",
    Component: lazy(() => import("./screens/F04Discovery")),
    shots: [s("matrix", "/primitives/discovery", [320, 1440])],
  },
  {
    id: "F05",
    title: "Search + filter primitives",
    batch: "F",
    route: "primitives/search",
    Component: lazy(() => import("./screens/F05Search")),
    shots: [
      s("matrix", "/primitives/search", [375, 1440]),
      s("sheet-open", "/primitives/search?variant=sheet", [375]),
    ],
  },
  {
    id: "F06",
    title: "Commerce action primitives",
    batch: "F",
    route: "primitives/commerce",
    Component: lazy(() => import("./screens/F06Commerce")),
    shots: [s("matrix", "/primitives/commerce", [375, 1440])],
  },
  {
    id: "F07",
    title: "Seller / admin form primitives",
    batch: "F",
    route: "primitives/forms",
    Component: lazy(() => import("./screens/F07Forms")),
    shots: [s("matrix", "/primitives/forms", [375, 1024])],
  },
  {
    id: "F08",
    title: "Copy + accessibility contract",
    batch: "F",
    route: "contract",
    Component: lazy(() => import("./screens/F08Contract")),
    shots: [s("contract", "/contract", [375, 1024])],
  },
];

export const screensByBatch = (): Record<Batch, ProtoScreen[]> => {
  const out = { F: [], B1: [], B2: [], S1: [], S2: [], A: [], Q: [] } as Record<Batch, ProtoScreen[]>;
  for (const sc of SCREENS) out[sc.batch].push(sc);
  return out;
};

export const BATCH_LABEL: Record<Batch, string> = {
  F: "F — Nền tảng dùng chung",
  B1: "B1 — Người mua: khám phá",
  B2: "B2 — Người mua: giao dịch & hỗ trợ",
  S1: "S1 — Người bán: đăng ký",
  S2: "S2 — Người bán: vận hành",
  A: "A — Quản trị",
  Q: "Q — Kiểm tra chéo",
};

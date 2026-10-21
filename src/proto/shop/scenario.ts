// ============================================================================
// Shop prototype — scenario switch (F01)
// ----------------------------------------------------------------------------
// Every prototype screen reads its state from `?scenario=`, never from a
// network call. That makes each screenshot in the task board reproducible from
// a URL alone: paste the link, get the exact state back.
//
// PROTOTYPE ONLY. Nothing here touches Supabase, and no fixture value is ever
// written to a real table (board Rule 6 + F01 "Do not").
// ============================================================================

export const SCENARIOS = [
  "normal",
  "empty",
  "slow",
  "error",
  "suspended",
  "unavailable",
  "denied",
] as const;

export type Scenario = (typeof SCENARIOS)[number];

export const SCENARIO_LABEL_VI: Record<Scenario, string> = {
  normal: "Bình thường",
  empty: "Trống",
  slow: "Mạng chậm",
  error: "Lỗi tải",
  suspended: "Shop bị tạm ngưng",
  unavailable: "Hết hàng / ngừng bán",
  denied: "Không đủ quyền",
};

const isScenario = (v: string | null): v is Scenario =>
  !!v && (SCENARIOS as readonly string[]).includes(v);

/**
 * Read the active scenario from the current URL. Falls back to "normal".
 * Deliberately reads `window.location` rather than a React Router hook so
 * fixture modules can call it outside a component tree.
 */
export const readScenario = (search?: string): Scenario => {
  const qs = search ?? (typeof window !== "undefined" ? window.location.search : "");
  const v = new URLSearchParams(qs).get("scenario");
  return isScenario(v) ? v : "normal";
};

/** Extra state flags some screens need on top of the shared scenario list. */
export const readVariant = (search?: string): string => {
  const qs = search ?? (typeof window !== "undefined" ? window.location.search : "");
  return new URLSearchParams(qs).get("variant") ?? "";
};

/** Build a link to the same screen in a different scenario. */
export const scenarioHref = (pathname: string, scenario: Scenario, variant?: string): string => {
  const p = new URLSearchParams();
  if (scenario !== "normal") p.set("scenario", scenario);
  if (variant) p.set("variant", variant);
  const q = p.toString();
  return q ? `${pathname}?${q}` : pathname;
};

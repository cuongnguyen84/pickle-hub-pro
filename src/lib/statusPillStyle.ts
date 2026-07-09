import type { CSSProperties } from "react";

/**
 * Token-driven status-pill colours so they track light/dark mode.
 * Shared by TeamMatchList / TeamMatchView / MyTournaments — was an
 * identical copy-paste in each. "active" is treated the same as "ongoing".
 */
export function statusPillStyle(status: string): CSSProperties {
  if (status === "completed") return { background: "var(--tl-surface)", color: "var(--tl-fg-3)" };
  if (status === "ongoing" || status === "active") return { background: "var(--tl-green-glow)", color: "var(--tl-green)" };
  if (status === "registration") return { background: "var(--tl-blue-glow)", color: "var(--tl-blue)" };
  return { background: "var(--tl-gold-glow)", color: "var(--tl-gold)" };
}

import { useI18n } from "@/i18n";
import type { PullToRefreshState } from "@/hooks/usePullToRefresh";

/**
 * Visual feedback for pull-to-refresh. Sits above page content and
 * occupies vertical space equal to the current pull distance, so the
 * page content shifts down naturally as the user drags.
 *
 * The Line aesthetic:
 *   - Geist Mono micro-label (REFRESH / REFRESHING)
 *   - Single-tone caret arrow that rotates 180° once threshold hit
 *   - No spinner during refresh — just the green accent bar pulsing
 */
interface Props {
  state: PullToRefreshState;
}

export function PullToRefreshIndicator({ state }: Props) {
  const { language } = useI18n();
  const { pullDistance, isRefreshing, triggered } = state;

  if (pullDistance === 0 && !isRefreshing) return null;

  const label = isRefreshing
    ? (language === "vi" ? "ĐANG LÀM MỚI…" : "REFRESHING…")
    : triggered
    ? (language === "vi" ? "THẢ ĐỂ LÀM MỚI" : "RELEASE TO REFRESH")
    : (language === "vi" ? "KÉO ĐỂ LÀM MỚI" : "PULL TO REFRESH");

  return (
    <div
      style={{
        height: pullDistance,
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        pointerEvents: "none",
        transition: isRefreshing ? "height 200ms ease" : pullDistance === 0 ? "height 280ms ease" : "none",
      }}
      aria-live="polite"
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          paddingBottom: 12,
          fontFamily: "'Geist Mono', ui-monospace, monospace",
          fontSize: 10,
          letterSpacing: "0.12em",
          color: triggered || isRefreshing ? "var(--tl-green, #00b96b)" : "var(--tl-fg-3, #888)",
          opacity: Math.min(pullDistance / 30, 1),
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{
            transform: `rotate(${triggered || isRefreshing ? 180 : 0}deg)`,
            transition: "transform 180ms ease",
            animation: isRefreshing ? "tl-ptr-spin 800ms linear infinite" : undefined,
          }}
        >
          <path d="M12 4v16m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{label}</span>
      </div>
      <style>{`
        @keyframes tl-ptr-spin {
          from { transform: rotate(180deg); }
          to { transform: rotate(540deg); }
        }
      `}</style>
    </div>
  );
}

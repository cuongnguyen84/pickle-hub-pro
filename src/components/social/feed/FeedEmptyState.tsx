import { Link } from "react-router-dom";
import type { Language } from "@/lib/social/feed-formatters";

export type FeedEmptyVariant =
  | "no_follows"           // Following tab + 0 follows
  | "no_recent_matches"    // Following tab + has follows + 0 recent matches
  | "trending_empty";      // Trending tab + 0 results (rare)

interface FeedEmptyStateProps {
  variant: FeedEmptyVariant;
  language: Language;
  /** Optional: pass a callback to switch tab when CTA fires (no_recent_matches). */
  onSwitchToTrending?: () => void;
}

/**
 * Italic-poetry empty states matching mockup Frame 06. Different glyph per
 * variant so they're distinguishable at a glance during QA.
 *   - no_follows         → ∅
 *   - no_recent_matches  → ◌
 *   - trending_empty     → ·
 */
export function FeedEmptyState({
  variant,
  language,
  onSwitchToTrending,
}: FeedEmptyStateProps) {
  if (variant === "no_follows") {
    return (
      <div className="tl-feed-empty">
        <div className="tl-feed-empty-mark" aria-hidden="true">∅</div>
        <h2 className="tl-feed-empty-title">
          {language === "vi" ? (
            <>Chưa theo dõi <em>ai.</em></>
          ) : (
            <>Following <em>no one yet.</em></>
          )}
        </h2>
        <p className="tl-feed-empty-sub">
          {language === "vi"
            ? "Khám phá người chơi để xem trận đấu của họ xuất hiện ở đây mỗi khi cộng đồng vào sân."
            : "Discover players so their matches appear here every time the community plays."}
        </p>
        <Link
          to={language === "vi" ? "/vi/rankings" : "/rankings"}
          className="tl-btn primary"
          style={{ display: "inline-flex", gap: 10 }}
        >
          {language === "vi" ? "Khám phá người chơi" : "Discover players"}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    );
  }

  if (variant === "no_recent_matches") {
    return (
      <div className="tl-feed-empty">
        <div className="tl-feed-empty-mark" aria-hidden="true">◌</div>
        <h2 className="tl-feed-empty-title">
          {language === "vi" ? (
            <>Một <em>tuần yên ắng.</em></>
          ) : (
            <>A <em>quiet week.</em></>
          )}
        </h2>
        <p className="tl-feed-empty-sub">
          {language === "vi"
            ? "Người bạn theo dõi chưa log trận trong 7 ngày qua. Trong khi chờ, ghé qua bảng thịnh hành xem cộng đồng đang đánh gì."
            : "The players you follow haven't logged matches in the last 7 days. Browse Trending while you wait."}
        </p>
        {onSwitchToTrending && (
          <button
            type="button"
            onClick={onSwitchToTrending}
            className="tl-btn"
            style={{ display: "inline-flex", gap: 10 }}
          >
            {language === "vi" ? "Xem thịnh hành" : "View Trending"}
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    );
  }

  // trending_empty — rare passive state, no CTA
  return (
    <div className="tl-feed-empty">
      <div className="tl-feed-empty-mark" aria-hidden="true">·</div>
      <h2 className="tl-feed-empty-title">
        {language === "vi" ? (
          <>Sân <em>còn vắng.</em></>
        ) : (
          <>The <em>court is quiet.</em></>
        )}
      </h2>
      <p className="tl-feed-empty-sub">
        {language === "vi"
          ? "Chưa có trận đấu nổi bật trong 7 ngày qua. Quay lại sau khi cộng đồng có thêm trận."
          : "No trending matches yet. Check back after the community plays more."}
      </p>
    </div>
  );
}

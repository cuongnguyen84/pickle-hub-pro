import { useRef, type KeyboardEvent } from "react";
import type { FeedTab } from "@/lib/social/feed-tab-logic";
import type { Language } from "@/lib/social/feed-formatters";

interface FeedTabsProps {
  activeTab: FeedTab;
  followingCount: number;
  /** Use string for the live indicator (e.g. ∞) or number for count. */
  trendingCount?: number | string;
  onTabChange: (tab: FeedTab) => void;
  /** False when the viewer is anonymous — Following tab is hidden entirely. */
  showFollowing: boolean;
  language: Language;
}

/**
 * Two-tab switcher for /feed. Keyboard arrow-left/right cycles between
 * tabs (matches WAI-ARIA tablist pattern). Active tab carries
 * aria-selected="true" + lime-green underline.
 *
 * When showFollowing=false (anonymous), the Following button is omitted
 * entirely rather than disabled — disabling teaches users an empty
 * affordance.
 */
export function FeedTabs({
  activeTab,
  followingCount,
  trendingCount = "∞",
  onTabChange,
  showFollowing,
  language,
}: FeedTabsProps) {
  const tablistRef = useRef<HTMLDivElement>(null);

  const labels = {
    following: language === "vi" ? "ĐANG THEO DÕI" : "FOLLOWING",
    trending: language === "vi" ? "THỊNH HÀNH" : "TRENDING",
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!showFollowing) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next: FeedTab = activeTab === "following" ? "trending" : "following";
    onTabChange(next);
    requestAnimationFrame(() => {
      const buttons = tablistRef.current?.querySelectorAll<HTMLButtonElement>(
        "button[role='tab']",
      );
      const target = Array.from(buttons ?? []).find(
        (b) => b.dataset.tab === next,
      );
      target?.focus();
    });
  };

  return (
    <div
      ref={tablistRef}
      className="tl-feed-tabs"
      role="tablist"
      aria-label={language === "vi" ? "Chọn tab bảng tin" : "Select feed tab"}
    >
      {showFollowing && (
        <button
          type="button"
          role="tab"
          data-tab="following"
          aria-selected={activeTab === "following"}
          tabIndex={activeTab === "following" ? 0 : -1}
          className="tl-feed-tab"
          onClick={() => onTabChange("following")}
          onKeyDown={handleKeyDown}
        >
          {labels.following}
          <span className="ct">{followingCount}</span>
        </button>
      )}
      <button
        type="button"
        role="tab"
        data-tab="trending"
        aria-selected={activeTab === "trending"}
        tabIndex={activeTab === "trending" ? 0 : -1}
        className="tl-feed-tab"
        onClick={() => onTabChange("trending")}
        onKeyDown={handleKeyDown}
      >
        {labels.trending}
        <span className="ct">{trendingCount}</span>
      </button>
    </div>
  );
}

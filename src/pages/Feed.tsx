import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useFollowingCount } from "@/hooks/social/useFollowingCount";
import { useFollowingFeed, type FeedMatch } from "@/hooks/social/useFollowingFeed";
import { useTrendingFeed } from "@/hooks/social/useTrendingFeed";
import { useFeedTab } from "@/hooks/social/useFeedTab";
import { FeedMatchCard } from "@/components/social/feed/FeedMatchCard";
import { FeedTabs } from "@/components/social/feed/FeedTabs";
import { FeedEmptyState } from "@/components/social/feed/FeedEmptyState";
import { FeedSignInNudge } from "@/components/social/feed/FeedSignInNudge";

/**
 * /feed — Sprint 4 Phase 4A entry point for the social loop.
 *
 * Read-only timeline. Two tabs:
 *   - Following: matches from people the viewer follows (+ own matches)
 *   - Trending:  recency-weighted public matches in the last 7 days
 *
 * Anonymous viewers see Trending only (Following tab hidden) plus a
 * sign-in nudge above the stream. Tab state is URL-controlled
 * (?tab=following / ?tab=trending) for deep-linking + browser back.
 *
 * Mockup: .claude/mockups/feed-page-mockup.html
 * Anti-scope: no kudos (4B), no comments (4C), no real-time (Sprint 5),
 * no filter chips, no avatars on cards.
 */
const Feed = () => {
  const { language } = useI18n();
  const { user } = useAuth();
  const isAuthenticated = !!user;

  const followingCountQuery = useFollowingCount(user?.id);
  const followingCount = followingCountQuery.data ?? 0;

  const { tab, setTab } = useFeedTab({
    isAuthenticated,
    followingCount: followingCountQuery.data,
  });

  const followingFeed = useFollowingFeed(
    tab === "following" ? user?.id : undefined,
  );
  const trendingFeed = useTrendingFeed();

  const activeQuery = tab === "following" ? followingFeed : trendingFeed;
  const matches: FeedMatch[] = useMemo(
    () => activeQuery.data?.pages.flat() ?? [],
    [activeQuery.data],
  );

  const isLoadingFirstPage =
    activeQuery.isLoading ||
    (activeQuery.isFetching && matches.length === 0);

  const pageTitle = language === "vi" ? "Bảng tin" : "Feed";
  const pageDescription =
    language === "vi"
      ? "Trận đấu mới từ cộng đồng pickleball Việt Nam — theo dõi người chơi và xem trận đấu của họ."
      : "New matches from the Vietnamese pickleball community — follow players and see their matches.";

  return (
    <TheLineLayout
      title={pageTitle}
      description={pageDescription}
      active="feed"
    >
      <div className="tl-shell" style={{ paddingBottom: 56 }}>
        {/* Page head */}
        <header className="tl-page-head" style={{ padding: "48px 0 32px" }}>
          <div className="tl-eyebrow" aria-hidden="true">
            <span className="pip" />
            <span>{language === "vi" ? "BẢNG TIN" : "THE FEED"}</span>
            <span className="sep">·</span>
            <span>{language === "vi" ? "CẬP NHẬT TRỰC TIẾP" : "LIVE NOW"}</span>
          </div>
          <h1
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: "clamp(48px, 7vw, 96px)",
              lineHeight: 0.95,
              letterSpacing: "-0.025em",
              margin: "0 0 16px",
              color: "var(--tl-fg)",
            }}
          >
            {language === "vi" ? (
              <>
                <em>Trên sân</em>
                <br />
                <span style={{ color: "var(--tl-green)" }}>gần đây.</span>
              </>
            ) : (
              <>
                <em>Recently</em>
                <br />
                <span style={{ color: "var(--tl-green)" }}>on the court.</span>
              </>
            )}
          </h1>
          <p
            style={{
              fontSize: 16,
              color: "var(--tl-fg-2)",
              maxWidth: "56ch",
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            {language === "vi"
              ? "Trận đấu mới từ những người bạn theo dõi. Cuộn để xem thêm, chạm vào tên người chơi để mở hồ sơ."
              : "New matches from across the community. Tap a player name to open their profile, scroll for older results."}
          </p>
        </header>

        {/* Anonymous nudge */}
        {!isAuthenticated && <FeedSignInNudge language={language} />}

        {/* Tabs */}
        <FeedTabs
          activeTab={tab}
          followingCount={followingCount}
          trendingCount="∞"
          onTabChange={setTab}
          showFollowing={isAuthenticated}
          language={language}
        />

        {/* Stream */}
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {isLoadingFirstPage ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "64px 0",
              }}
            >
              <Loader2
                className="h-5 w-5 animate-spin"
                style={{ color: "var(--tl-fg-3)" }}
              />
            </div>
          ) : matches.length === 0 ? (
            <FeedEmptyState
              variant={
                tab === "following"
                  ? followingCount === 0
                    ? "no_follows"
                    : "no_recent_matches"
                  : "trending_empty"
              }
              language={language}
              onSwitchToTrending={
                tab === "following" && followingCount > 0
                  ? () => setTab("trending")
                  : undefined
              }
            />
          ) : (
            <>
              {matches.map((match, i) => (
                <FeedMatchCard
                  key={match.match_id}
                  match={match}
                  language={language}
                  staggerIndex={i}
                />
              ))}

              {activeQuery.hasNextPage && (
                <button
                  type="button"
                  className="tl-feed-loadmore"
                  onClick={() => activeQuery.fetchNextPage()}
                  disabled={activeQuery.isFetchingNextPage}
                  style={{ marginTop: 32 }}
                >
                  {activeQuery.isFetchingNextPage && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {language === "vi" ? "Tải thêm" : "Load more"}
                  <span className="ct">
                    {language === "vi" ? "— trận trước đó" : "— earlier matches"}
                  </span>
                </button>
              )}

              <div className="tl-feed-foot">
                {language === "vi"
                  ? "Cập nhật theo thời gian thực · Thịnh hành = trọng số tương tác, 7 ngày gần đây"
                  : "Real-time updates · Trending = engagement-weighted, last 7 days"}
              </div>
            </>
          )}
        </div>
      </div>
    </TheLineLayout>
  );
};

export default Feed;

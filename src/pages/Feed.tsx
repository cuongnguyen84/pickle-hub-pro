import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useFollowingCount } from "@/hooks/social/useFollowingCount";
import { useFollowingFeed, type FeedMatch } from "@/hooks/social/useFollowingFeed";
import {
  useFeedTimeline,
  type FeedTimelineItem,
} from "@/hooks/social/useFeedTimeline";
import { useFeedTab } from "@/hooks/social/useFeedTab";
import { FeedMatchCard } from "@/components/social/feed/FeedMatchCard";
import { FeedBlogCard } from "@/components/social/feed/FeedBlogCard";
import { FeedVideoCard } from "@/components/social/feed/FeedVideoCard";
import { FeedTabs } from "@/components/social/feed/FeedTabs";
import { FeedEmptyState } from "@/components/social/feed/FeedEmptyState";
import { FeedSignInNudge } from "@/components/social/feed/FeedSignInNudge";
import { FeedConnectCard } from "@/components/dupr/FeedConnectCard";

/**
 * /feed — social discovery surface. Two tabs:
 *
 *   - Following: matches from people the viewer follows (+ own matches).
 *                Stays matches-only (Sprint 7 anti-scope).
 *   - Trending:  Sprint 7 mixed timeline — matches + VI/EN blog + videos
 *                sorted purely by recency (no engagement weighting).
 *
 * Anonymous viewers see Trending only (Following tab hidden) plus a
 * sign-in nudge above the stream. Tab state is URL-controlled
 * (?tab=following / ?tab=trending) for deep-linking + browser back.
 *
 * Sprint 7 product change: Trending used to be engagement-weighted and
 * matches-only. We swapped in get_feed_timeline so the page becomes a
 * Facebook-style single chronological stream across all three sources.
 * useTrendingFeed remains exported for backward compatibility but is
 * intentionally no longer wired up here.
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
  const timelineFeed = useFeedTimeline();
  const activeQuery = tab === "following" ? followingFeed : timelineFeed;

  const followingMatches: FeedMatch[] = useMemo(
    () => followingFeed.data?.pages.flat() ?? [],
    [followingFeed.data],
  );
  const timelineItems: FeedTimelineItem[] = useMemo(() => {
    const all = timelineFeed.data?.pages.flat() ?? [];
    // Blog posts are file-shipped per locale (VI in vi_blog_posts, EN in
    // src/content/blog/metadata.ts) — same article appears once per lang.
    // Hide the off-locale copy so EN viewers don't see the VI version
    // stacked above the EN version (and vice-versa). Matches and videos
    // stay unfiltered: they're locale-agnostic activity.
    return all.filter(
      (item) => item.type !== "blog" || item.lang === language,
    );
  }, [timelineFeed.data, language]);

  const itemCount =
    tab === "following" ? followingMatches.length : timelineItems.length;

  const isLoadingFirstPage =
    activeQuery.isLoading ||
    (activeQuery.isFetching && itemCount === 0);

  const pageTitle = language === "vi" ? "Bảng tin" : "Feed";
  const pageDescription =
    language === "vi"
      ? "Trận đấu, bài viết và video mới từ cộng đồng pickleball Việt Nam."
      : "Latest matches, posts, and videos from the Vietnamese pickleball community.";

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
              ? "Trận đấu, bài viết và video mới từ cộng đồng. Cuộn để xem thêm, chạm vào tên người chơi để mở hồ sơ."
              : "New matches, articles, and videos from across the community. Tap a player name to open their profile, scroll for older items."}
          </p>
        </header>

        {/* Anonymous nudge */}
        {!isAuthenticated && <FeedSignInNudge language={language} />}

        {/* Connect DUPR — visible only for authed users not yet linked.
            FeedConnectCard internally guards on useDuprConnection, so this
            renders nothing for connected users. */}
        <FeedConnectCard />

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
          ) : itemCount === 0 ? (
            <FeedEmptyState
              variant={
                tab === "following"
                  ? followingCount === 0
                    ? "no_follows"
                    : "no_recent_matches"
                  : "timeline_empty"
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
              {tab === "following"
                ? followingMatches.map((match, i) => (
                    <FeedMatchCard
                      key={match.match_id}
                      match={match}
                      language={language}
                      staggerIndex={i}
                    />
                  ))
                : timelineItems.map((item, i) => (
                    <TimelineRow
                      key={`${item.type}:${item.cursor_id}`}
                      item={item}
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
                    {language === "vi"
                      ? "— mục cũ hơn"
                      : "— earlier items"}
                  </span>
                </button>
              )}

              <div className="tl-feed-foot">
                {language === "vi"
                  ? "Cập nhật theo thời gian thực · Sắp xếp theo thời gian, 30 ngày gần đây"
                  : "Real-time updates · Sorted by recency, last 30 days"}
              </div>
            </>
          )}
        </div>
      </div>
    </TheLineLayout>
  );
};

/**
 * Discriminated dispatch — picks the right card per timeline item. Kept
 * inline (not exported) because the union shape is tightly coupled to the
 * useFeedTimeline hook and only this page renders it today.
 */
function TimelineRow({
  item,
  language,
  staggerIndex,
}: {
  item: FeedTimelineItem;
  language: import("@/lib/social/feed-formatters").Language;
  staggerIndex: number;
}) {
  if (item.type === "match") {
    return (
      <FeedMatchCard
        match={item}
        language={language}
        staggerIndex={staggerIndex}
      />
    );
  }
  if (item.type === "blog") {
    return (
      <FeedBlogCard
        slug={item.slug}
        title={item.title}
        excerpt={item.excerpt}
        cover_image_url={item.cover_image_url}
        category={item.category}
        published_at={item.published_at}
        lang={item.lang}
        language={language}
        staggerIndex={staggerIndex}
      />
    );
  }
  return (
    <FeedVideoCard
      id={item.id}
      title={item.title}
      description={item.description}
      thumbnail_url={item.thumbnail_url}
      duration_seconds={item.duration_seconds}
      video_type={item.video_type}
      published_at={item.published_at}
      language={language}
      staggerIndex={staggerIndex}
    />
  );
}

export default Feed;

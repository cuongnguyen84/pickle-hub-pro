import { useMemo, useRef } from "react";
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
import { useFeedNews, type FeedNewsItem } from "@/hooks/social/useFeedNews";
import { useFeedTab } from "@/hooks/social/useFeedTab";
import { useFeedViewedTracking } from "@/hooks/social/useFeedViewedTracking";
import { FeedMatchCard } from "@/components/social/feed/FeedMatchCard";
import { FeedMlpMatchCard } from "@/components/social/feed/FeedMlpMatchCard";
import { FeedBlogCard } from "@/components/social/feed/FeedBlogCard";
import { FeedVideoCard } from "@/components/social/feed/FeedVideoCard";
import { FeedNewsCard } from "@/components/social/feed/FeedNewsCard";

// Local union extending the RPC-driven FeedTimelineItem with news items
// merged client-side (see useFeedNews). News is intentionally NOT in the
// get_feed_timeline RPC — surfacing it through the same client merge that
// already handles EN blog overlays keeps the SQL function untouched.
type StreamItem = FeedTimelineItem | FeedNewsItem;

// Tiny FNV-1a 32-bit hash for the per-mount jitter. Deterministic so two
// renders inside the same mount produce the same ordering — React Query
// reconciliation depends on stable keys.
function hashStr(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

import { FeedTabs } from "@/components/social/feed/FeedTabs";
import { FeedEmptyState } from "@/components/social/feed/FeedEmptyState";
import { FeedSignInNudge } from "@/components/social/feed/FeedSignInNudge";

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
  // Per-mount stable jitter seed for tie-breaking in the score sort. Resets
  // on every page navigation TO /feed (React unmounts/remounts the route)
  // so each visit reshuffles items in the same score band.
  const sessionSeedRef = useRef(((Math.random() * 0x7fffffff) | 0));
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
  const newsFeed = useFeedNews(language === "vi" ? "vi" : "en");
  const activeQuery = tab === "following" ? followingFeed : timelineFeed;
  const viewed = useFeedViewedTracking();

  const followingMatches: FeedMatch[] = useMemo(
    () => followingFeed.data?.pages.flat() ?? [],
    [followingFeed.data],
  );
  const timelineItems: StreamItem[] = useMemo(() => {
    const all = timelineFeed.data?.pages.flat() ?? [];
    const filtered: StreamItem[] = all.filter(
      (item) => item.type !== "blog" || item.lang === language,
    );

    // Window news into the loaded RPC cursor (codex P2 #135).
    const news = newsFeed.data ?? [];
    const isLastPage = !timelineFeed.hasNextPage;
    const loadedFloor = filtered.length > 0
      ? Math.min(...filtered.map((i) => i.score))
      : -Infinity;
    const windowedNews = isLastPage
      ? news
      : news.filter((n) => n.score >= loadedFloor);

    const merged: StreamItem[] = windowedNews.length === 0
      ? filtered
      : [...filtered, ...windowedNews];

    // Effective score = RPC score × age_mult × viewed_mult × jitter.
    //
    // 2026-05-19 v2 (Anh feedback: "refresh không thấy data thay đổi"):
    //   - Tightened age curve to start at 12h, not 24h. Pro-tour matches
    //     get a large pro_tour_boost from the RPC; without faster decay,
    //     yesterday's PPA Asia finals were still dominating today's view.
    //   - Per-mount session jitter inside a ±15% band so the order
    //     reshuffles between visits without the SQL/data changing. Seed
    //     is stable for the lifetime of the Feed component instance
    //     (set in a ref), so React re-renders don't reshuffle mid-scroll.
    //   - Stale-content hide: items older than 14 days are dropped from
    //     /feed entirely (still visible on /news, /blog directly).
    const sessionSeed = sessionSeedRef.current;
    const now = Date.now();
    const effectiveScore = (item: StreamItem): number => {
      const ageHours = Math.max(
        0,
        (now - Date.parse(item.published_at)) / 3_600_000,
      );
      let mult = 1;
      if (ageHours > 12 && ageHours <= 24) mult *= 0.85;
      else if (ageHours > 24 && ageHours <= 72) mult *= 0.55;
      else if (ageHours > 72 && ageHours <= 168) mult *= 0.25;
      else if (ageHours > 168 && ageHours <= 336) mult *= 0.08;
      else if (ageHours > 336) return -Infinity; // >14d: drop from feed
      if (viewed.viewedSet.has(item.cursor_id)) mult *= 0.4;
      // Jitter: deterministic per (sessionSeed, cursor_id) so the same
      // mount produces a stable order. fnv1a-style hash → fraction in
      // [0.85, 1.15].
      const seed = sessionSeed ^ hashStr(item.cursor_id);
      const jitter = 0.85 + ((seed >>> 0) % 1000) / 1000 * 0.3;
      return item.score * mult * jitter;
    };

    const scored = merged
      .map((item) => ({ item, eff: effectiveScore(item) }))
      .filter((row) => Number.isFinite(row.eff))
      .sort((a, b) => {
        if (a.eff === b.eff) {
          return a.item.cursor_id < b.item.cursor_id ? 1 : -1;
        }
        return b.eff - a.eff;
      });

    // Pin news into the top 20. Pro-tour boost on matches can starve news
    // from the first screenful; reserve every 4th slot for the highest
    // remaining news item until we've placed at least 5 (or run out).
    const TOP_WINDOW = 20;
    const MIN_NEWS_IN_TOP = 5;
    const head = scored.slice(0, TOP_WINDOW);
    const tail = scored.slice(TOP_WINDOW);
    const headNewsCount = head.filter((r) => r.item.type === "news").length;
    if (headNewsCount >= MIN_NEWS_IN_TOP) {
      return [...head, ...tail].map((r) => r.item);
    }
    const headNonNews = head.filter((r) => r.item.type !== "news");
    const headNews = head.filter((r) => r.item.type === "news");
    const reserveNews = scored
      .filter((r) => r.item.type === "news")
      .slice(0, MIN_NEWS_IN_TOP);
    const reserveIds = new Set(reserveNews.map((r) => r.item.cursor_id));
    const remainingHeadNonNews = headNonNews.filter(
      (r) => !reserveIds.has(r.item.cursor_id),
    );
    const remainingHeadNews = headNews.filter(
      (r) => !reserveIds.has(r.item.cursor_id),
    );
    const merged2: typeof scored = [];
    let nonNewsCursor = 0;
    let newsCursor = 0;
    const otherNewsQueue = remainingHeadNews;
    for (let i = 0; i < TOP_WINDOW; i += 1) {
      const slotIsNews = i % 4 === 3 && newsCursor < reserveNews.length;
      if (slotIsNews) {
        merged2.push(reserveNews[newsCursor]);
        newsCursor += 1;
        continue;
      }
      if (nonNewsCursor < remainingHeadNonNews.length) {
        merged2.push(remainingHeadNonNews[nonNewsCursor]);
        nonNewsCursor += 1;
      } else if (newsCursor < reserveNews.length) {
        merged2.push(reserveNews[newsCursor]);
        newsCursor += 1;
      } else if (otherNewsQueue.length > 0) {
        const next = otherNewsQueue.shift();
        if (next) merged2.push(next);
      }
    }
    return [...merged2, ...tail].map((r) => r.item);
  }, [
    timelineFeed.data,
    timelineFeed.hasNextPage,
    language,
    newsFeed.data,
    viewed.viewedSet,
  ]);

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
                ? followingMatches.map((match, i) =>
                    // Codex P1 fix: FeedMlpMatchCard returns null when notes
                    // can't be parsed, which silently drops the row. Fall back
                    // to the generic card so the match still renders. Also
                    // guard against the Following RPC not yet returning notes.
                    match.source_provider === "mlp" && match.notes ? (
                      <FeedMlpMatchCard
                        key={match.match_id}
                        match={match}
                        language={language}
                        staggerIndex={i}
                      />
                    ) : (
                      <FeedMatchCard
                        key={match.match_id}
                        match={match}
                        language={language}
                        staggerIndex={i}
                      />
                    )
                  )
                : timelineItems.map((item, i) => (
                    <div
                      key={`${item.type}:${item.cursor_id}`}
                      onClickCapture={() => viewed.markViewed(item.cursor_id)}
                    >
                      <TimelineRow
                        item={item}
                        language={language}
                        staggerIndex={i}
                      />
                    </div>
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
  item: StreamItem;
  language: import("@/lib/social/feed-formatters").Language;
  staggerIndex: number;
}) {
  if (item.type === "news") {
    return (
      <FeedNewsCard
        slug={item.slug}
        title={item.title}
        summary={item.summary}
        image_url={item.image_url}
        source={item.source}
        lang={item.language}
        language={language}
        published_at={item.published_at}
        aiTranslated={item.ai_translated}
        staggerIndex={staggerIndex}
      />
    );
  }
  if (item.type === "match") {
    // Codex P1 fix: only route to MLP card when notes are present + parseable.
    // FeedMlpMatchCard returns null on invalid notes, which would silently
    // drop the row from the feed. Guard at the dispatch site instead.
    if (item.source_provider === "mlp" && item.notes) {
      return (
        <FeedMlpMatchCard
          match={item}
          language={language}
          staggerIndex={staggerIndex}
        />
      );
    }
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

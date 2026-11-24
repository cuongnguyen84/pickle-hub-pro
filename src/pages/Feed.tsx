import { lazy, Suspense, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAssistantContext } from "@/lib/assistant-context";
import { Loader2 } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { useI18n } from "@/i18n";
import { languageChosenOutsideFeed } from "@/i18n/initial-language";
import { isVietnamesePath } from "@/i18n/loader";
import { useAuth } from "@/hooks/useAuth";
import { useFollowingCount } from "@/hooks/social/useFollowingCount";
import { useFollowingFeed, type FeedMatch } from "@/hooks/social/useFollowingFeed";
import {
  useFeedResults,
  useFeedTimeline,
  type FeedTimelineItem,
} from "@/hooks/social/useFeedTimeline";
import { useFeedNews, type FeedNewsItem } from "@/hooks/social/useFeedNews";
import { useFeedEmbeds, type FeedEmbedItem } from "@/hooks/social/useFeedEmbeds";
import { useFeedHappenings, type FeedHappeningItem } from "@/hooks/social/useFeedHappenings";
import { useFeedHighlights, type FeedHighlightItem } from "@/hooks/social/useFeedHighlights";
import { useSocialPosts, type FeedSocialPostItem } from "@/hooks/social/useSocialPosts";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useFeedTab } from "@/hooks/social/useFeedTab";
import { useFeedViewedTracking } from "@/hooks/social/useFeedViewedTracking";
import { FeedMatchCard } from "@/components/social/feed/FeedMatchCard";
import { FeedMlpMatchCard } from "@/components/social/feed/FeedMlpMatchCard";
import { FeedBlogCard } from "@/components/social/feed/FeedBlogCard";
import { FeedVideoCard } from "@/components/social/feed/FeedVideoCard";
import { FeedNewsCard } from "@/components/social/feed/FeedNewsCard";
import { FeedEmbedCard } from "@/components/social/feed/FeedEmbedCard";
import { FeedHappeningCard } from "@/components/social/feed/FeedHappeningCard";
import { FeedHighlightCard } from "@/components/social/feed/FeedHighlightCard";
import { FeedResultCard } from "@/components/social/feed/FeedResultCard";
import { FeedPostCard } from "@/components/social/feed/FeedPostCard";
import {
  dedupeFeedItems,
  FEED_RESULT_WIDE_WINDOW_MS,
  FEED_STANDARD_WINDOW_MS,
  hideQuickTableMatchCopies,
  isMatchResult,
  computeEffectiveSeenIds,
  partitionFeedBySeen,
  selectFeedResults,
  sortFeedByRecency,
} from "@/lib/social/feed-ranking";
import { feedFooterCopy, feedRouteLanguage } from "@/lib/social/feed-locale";
import { editorialHomeHref } from "@/lib/home-feed-redirect";

// Local union extending the RPC-driven FeedTimelineItem with news items
// merged client-side (see useFeedNews). News is intentionally NOT in the
// get_feed_timeline RPC — surfacing it through the same client merge that
// already handles EN blog overlays keeps the SQL function untouched.
type StreamItem = FeedTimelineItem | FeedNewsItem | FeedEmbedItem | FeedHappeningItem | FeedHighlightItem | FeedSocialPostItem;

/**
 * Engagement signal for the seen-revival check: kudos + comments. Only
 * match items carry these counts in the feed payload today - every
 * other type returns null and its seen state never revives (v1 scope,
 * stated in the seen-sink report).
 */
function feedItemEngagement(item: StreamItem): number | null {
  if (item.type !== "match") return null;
  return (item.kudos_count ?? 0) + (item.comment_count ?? 0);
}

import { FeedTabs } from "@/components/social/feed/FeedTabs";
import { FeedEmptyState } from "@/components/social/feed/FeedEmptyState";
import { FeedSignInNudge } from "@/components/social/feed/FeedSignInNudge";

// The UGC post button + composer sheet ship as a lazy chunk: they are
// only rendered for the gated audience (site admins in PR-A) and must
// not weigh down the feed bundle for readers.
const FeedPostFab = lazy(() => import("@/components/social/feed/FeedPostFab"));

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
  const { setLanguageFromUrl } = useI18n();
  const location = useLocation();
  // /feed stays English even when geo or a stored preference is Vietnamese.
  // Date labels ("5 THÁNG 10") were coming from that preference.
  const language = feedRouteLanguage(location.pathname);
  useEffect(() => {
    setLanguageFromUrl(language);
    return () => {
      const next = window.location.pathname;
      if (next === "/feed" || next.startsWith("/feed/") || isVietnamesePath(next)) return;
      const restore = languageChosenOutsideFeed();
      if (restore) setLanguageFromUrl(restore);
    };
  }, [language, setLanguageFromUrl]);
  const { user, loading: authLoading } = useAuth();
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
  // UGC photo posts (PR-A): composer + stream merge are gated to site
  // admins until the moderation queue (PR-B) and the legal sign-off
  // land; the hook itself stays ungated so lifting this is one flag.
  const { isAdmin } = useAdminAuth();
  const postsFeed = useSocialPosts({ enabled: isAdmin });
  const timelineFeed = useFeedTimeline();
  const resultsFeed = useFeedResults();
  const newsFeed = useFeedNews(language === "vi" ? "vi" : "en");
  const embedsFeed = useFeedEmbeds();
  const happeningsFeed = useFeedHappenings();
  const highlightsFeed = useFeedHighlights();
  const activeQuery = tab === "following" ? followingFeed : timelineFeed;
  // Trợ lý AI nổi: tab đang xem + đăng nhập hay chưa (nội dung bài của người khác không gửi).
  useAssistantContext({
    label: language === "vi" ? "Bảng tin" : "Feed",
    facts: { tab, logged_in: isAuthenticated ? "yes" : "no", following: followingCount },
  });
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

    // News and IG embeds merge client-side like before, but they are no
    // longer windowed into the loaded RPC pages by score: ordering is
    // recency-based now (below), so every loaded item competes on its
    // timestamp alone.
    //
    // Happenings (live/tournament/event) are never windowed - they're
    // few, actionable, and lose all value if pushed past the fold.
    const overlay = (resultsFeed.data ?? []).filter(
      (item) => item.type !== "blog" || item.lang === language,
    );
    const withResults = dedupeFeedItems([filtered, overlay], (item) => item.cursor_id);
    const rankedAtMs = (item: StreamItem): number => {
      const iso = "ranked_at" in item && item.ranked_at ? item.ranked_at : item.published_at;
      const ms = Date.parse(iso);
      return Number.isNaN(ms) ? Number.NaN : ms;
    };
    const selected = hideQuickTableMatchCopies(selectFeedResults(withResults, {
      isResult: isMatchResult,
      rankedAtMs,
      nowMs: Date.now(),
      standardWindowMs: FEED_STANDARD_WINDOW_MS,
      wideWindowMs: FEED_RESULT_WIDE_WINDOW_MS,
    }));

    const merged: StreamItem[] = [
      ...selected,
      ...(newsFeed.data ?? []),
      ...(embedsFeed.data ?? []),
      ...(happeningsFeed.data ?? []),
      ...(highlightsFeed.data ?? []),
      ...(postsFeed.data ?? []),
    ];

    // Ordering (Cuong directive, 2026-11-24): newest first across every
    // content type. The previous pipeline ranked by the RPC score, then
    // multiplied by age bands, a viewed demotion (x0.4) and a per-session
    // random jitter, pinned news into slots 4/8/12/16/20 of the first
    // page and force-interleaved a result into every block of three - a
    // news item published this morning could never reach the top of the
    // feed. sortFeedByRecency compares one shared timestamp per item
    // instead (see feed-ranking.ts for the research basis).
    // selectFeedResults above still decides which items are eligible
    // (14-day freshness window; results may reach back 90 days when
    // nothing fresher exists) - those older results now sink to the
    // bottom by time instead of being pulled up.
    //
    // Seen-sink (Cuong directive, 2026-11-24): items already seen on a
    // previous visit move below every unseen item, so a returning reader
    // is not greeted by the same top card all day. The partition uses the
    // at-load snapshot: marks made during THIS visit take effect on the
    // next load, never mid-scroll. Revival exception (Facebook pattern):
    // a seen match whose kudos + comments grew since the last mark has
    // something new and rejoins the unseen group at its own recency
    // position (the payload carries counts, not interaction timestamps).
    const engagementById = new Map<string, number>();
    for (const item of merged) {
      const engagement = feedItemEngagement(item);
      if (engagement !== null) {
        engagementById.set(item.cursor_id, engagement);
      }
    }
    const effectiveSeen = computeEffectiveSeenIds(
      viewed.viewedEntriesAtLoad,
      engagementById,
    );
    return partitionFeedBySeen(
      sortFeedByRecency(merged, Date.now()),
      effectiveSeen,
      (item) => item.cursor_id,
    );
  }, [
    timelineFeed.data,
    language,
    newsFeed.data,
    resultsFeed.data,
    embedsFeed.data,
    happeningsFeed.data,
    highlightsFeed.data,
    postsFeed.data,
    viewed.viewedEntriesAtLoad,
  ]);

  // Seen marking: a trending row counts as seen once a good part of it
  // has actually been in the viewport, not merely rendered below the
  // fold. Marks persist via useFeedViewedTracking and sink the item on
  // the NEXT load (see the partition in timelineItems above).
  const streamRef = useRef<HTMLDivElement>(null);
  const markViewed = viewed.markViewed;
  useEffect(() => {
    const root = streamRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const id = el.dataset.feedCursor;
          if (id) {
            const eng = el.dataset.feedEng;
            markViewed(id, eng !== undefined ? Number(eng) : undefined);
          }
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.4 },
    );
    root
      .querySelectorAll<HTMLElement>("[data-feed-cursor]")
      .forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [timelineItems, tab, markViewed]);

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
        <header className="tl-page-head" style={{ padding: "28px 0 24px" }}>
          <div className="tl-eyebrow" aria-hidden="true">
            <span className="pip" />
            <span>{language === "vi" ? "BẢNG TIN" : "THE FEED"}</span>
            <span className="sep">·</span>
            <span>{language === "vi" ? "MỖI 5 PHÚT" : "EVERY 5 MIN"}</span>
          </div>
          <p style={{ margin: "12px 0 18px", fontSize: 14, lineHeight: 1.4 }}>
            <Link
              to={editorialHomeHref(language)}
              style={{ color: "var(--tl-green)", fontWeight: 600, textDecoration: "none" }}
            >
              {language === "vi" ? "Trang chủ" : "Home"}
            </Link>
            <span style={{ color: "var(--tl-fg-3)" }}>
              {language === "vi"
                ? " — livestream, giải đấu, tin tức"
                : " — livestreams, tournaments, news"}
            </span>
          </p>
          <h1
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: "clamp(36px, 5vw, 64px)",
              lineHeight: 0.98,
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

        {/* Anonymous nudge — gated on resolved auth so it never mounts then
            unmounts as the session restores. Signed-in users used to see the
            nudge on first paint and watch it vanish once getSession() resolved,
            shifting the whole feed down then up (CLS). Anonymous auth resolves
            near-instantly (no token to refresh), so the nudge still shows
            immediately for them. */}
        {!authLoading && !isAuthenticated && (
          <FeedSignInNudge language={language} />
        )}

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
        <div ref={streamRef} style={{ maxWidth: 720, margin: "0 auto" }}>
          {isLoadingFirstPage ? (
            // Skeleton rows mirror the trending feed's dominant card shape —
            // eyebrow + title + a 4:3 media block + meta — so the column
            // reserves roughly the height the image cards (news/blog/video)
            // occupy. The old text-only skeleton was ~3x shorter than the real
            // media cards, so the page jumped down hard when the first page
            // landed (CLS). The 4:3 block renders at column width on mobile,
            // matching FeedNewsCard/FeedBlogCard/FeedVideoCard.
            <div aria-busy="true" aria-label={language === "vi" ? "Đang tải bảng tin" : "Loading feed"}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse"
                  style={{ padding: "24px 0", borderBottom: "1px solid var(--tl-border)" }}
                >
                  <div style={{ height: 10, width: 160, borderRadius: 4, background: "var(--tl-surface-2)", marginBottom: 14 }} />
                  <div style={{ height: 22, width: "70%", borderRadius: 4, background: "var(--tl-surface-2)", marginBottom: 16 }} />
                  <div style={{ width: "100%", aspectRatio: "4 / 3", borderRadius: 8, background: "var(--tl-surface-2)", marginBottom: 14 }} />
                  <div style={{ height: 12, width: "40%", borderRadius: 4, background: "var(--tl-surface-2)" }} />
                </div>
              ))}
            </div>
          ) : activeQuery.isError ? (
            <div className="tl-empty">
              <h3>{language === "vi" ? "Không tải được bảng tin." : "Couldn't load the feed."}</h3>
              <p>
                {language === "vi"
                  ? "Có lỗi khi tải dữ liệu. Kiểm tra kết nối mạng rồi thử lại."
                  : "Something went wrong while loading. Check your connection and try again."}
              </p>
              <button
                type="button"
                className="tl-btn green"
                onClick={() => activeQuery.refetch()}
              >
                {language === "vi" ? "Thử lại" : "Retry"}
              </button>
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
                      data-feed-cursor={item.cursor_id}
                      data-feed-eng={feedItemEngagement(item) ?? undefined}
                      onClickCapture={(event) => {
                        const target = event.target;
                        if (
                          target instanceof Element &&
                          target.closest("[data-feed-local-action]")
                        ) {
                          return;
                        }
                        viewed.markViewed(
                          item.cursor_id,
                          feedItemEngagement(item) ?? undefined,
                        );
                      }}
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
                {feedFooterCopy(language)}
              </div>
            </>
          )}
        </div>
      </div>
      {isAdmin && (
        <Suspense fallback={null}>
          <FeedPostFab language={language} />
        </Suspense>
      )}
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
  if (item.type === "social_post") {
    return (
      <FeedPostCard
        item={item}
        language={language}
        staggerIndex={staggerIndex}
      />
    );
  }
  if (item.type === "highlight") {
    return (
      <FeedHighlightCard
        item={item}
        language={language}
        staggerIndex={staggerIndex}
      />
    );
  }
  if (item.type === "happening") {
    return (
      <FeedHappeningCard
        item={item}
        language={language}
        staggerIndex={staggerIndex}
      />
    );
  }
  if (item.type === "embed") {
    return (
      <FeedEmbedCard
        url={item.url}
        caption={item.caption}
        author_name={item.author_name}
        thumbnail_url={item.thumbnail_url}
        language={language}
        published_at={item.published_at}
        staggerIndex={staggerIndex}
      />
    );
  }
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
  if (item.type === "result") {
    return (
      <FeedResultCard
        item={item}
        language={language}
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

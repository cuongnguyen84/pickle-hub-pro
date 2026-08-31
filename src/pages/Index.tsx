import { useEffect, useMemo, useState, Fragment, FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Clock, Diamond, CircleDot, Target, Check } from "lucide-react";
import { useI18n } from "@/i18n";
import { useLivestreams, useTournaments, useVideos } from "@/hooks/useSupabaseData";
import { useLiveStatusRealtime } from "@/hooks/useLiveStatusRealtime";
import { LiveSection, LiveSectionSkeleton } from "@/components/home/LiveSection";
import { HomeNewsFeed } from "@/components/home/HomeNewsFeed";
import { useHomepageStats } from "@/hooks/useHomepageStats";
import { useNewsletterSubscribe } from "@/hooks/useNewsletterSubscribe";
import { blogMetadata } from "@/content/blog";
import { usePublishedViBlogPosts } from "@/hooks/useViBlogPosts";
import { normalizeImageUrl } from "@/lib/url-utils";
import { blogHeroSrcSet } from "@/lib/image-utils";
import { PPA_ASIA_STOPS } from "@/lib/constants";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Countdown } from "@/components/Countdown";
import { formatDate, formatRelative, formatTime } from "@/lib/format-datetime";
import { byEffectiveDateDesc, effectiveDateIso, isRefreshed } from "@/lib/blogOrder";
import { shouldReserveLiveSlot, writeLiveLeadHint } from "@/lib/home-live-lead";
import { HreflangTags } from "@/components/seo";
import { VideoThumbnail } from "@/components/video/VideoThumbnail";
import { useQueryClient } from "@tanstack/react-query";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { HomeLogMatchCTA } from "@/components/home/HomeLogMatchCTA";
import { useTickerData } from "@/hooks/useTickerData";
import { useNewsItems } from "@/hooks/useNewsItems";

/**
 * Production homepage. Promoted from preview/the-line on 2026-04-25;
 * the retired /preview/the-line/* source pages were deleted (CLOSE-01).
 */

/* ISO 8601 week-of-year — used as the editorial issue number on the
   Stories section. Each calendar week is one "issue" of the publication. */
const isoWeekNumber = (d = new Date()): number => {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
};

const HOME_NEWS_LIMIT = 4;

/* Featured story image with graceful degradation. The card src defaults to
   the -768 responsive variant and mobile srcSet picks the 768w candidate; if
   that 404s (e.g. a hero committed without its -768 sibling, as happened
   2026-08-03) onError falls back to the full-size image, then to a branded
   placeholder. A null/empty cover renders the placeholder directly instead of
   a bare dark gradient. Mirrors Blog.tsx's per-image onError guard. */
const StoryImage = ({
  story,
  index,
}: {
  story: { image: string | null; imageAlt: string };
  index: number;
}) => {
  const image = normalizeImageUrl(story.image);
  // 0 = responsive (-768 + srcSet) | 1 = full image only | 2 = placeholder
  const [stage, setStage] = useState(0);
  if (!image || stage >= 2) {
    return <div className="tl-blog-card-img-placeholder" aria-hidden="true" />;
  }
  const responsive = stage === 0 ? blogHeroSrcSet(image) : undefined;
  return (
    <img
      src={responsive?.small ?? image}
      srcSet={responsive?.srcSet}
      sizes={
        responsive
          ? index === 0
            ? "(min-width: 1100px) 800px, (min-width: 640px) 50vw, calc(100vw - 32px)"
            : "(min-width: 1100px) 390px, (min-width: 640px) 50vw, calc(100vw - 32px)"
          : undefined
      }
      alt={story.imageAlt}
      width={1600}
      height={900}
      loading={index === 0 ? "eager" : "lazy"}
      fetchPriority={index === 0 ? "high" : "auto"}
      decoding="async"
      onError={() => setStage((s) => s + 1)}
    />
  );
};

const Index = () => {
  const { language } = useI18n();
  const liveQuery = useLivestreams("live");
  const scheduledQuery = useLivestreams("scheduled");
  // Luồng vừa kết thúc — giữ trên home 7 ngày, tối đa 4 dòng replay.
  const endedQuery = useLivestreams("ended", 8);
  const liveStreams = useMemo(() => liveQuery.data ?? [], [liveQuery.data]);
  const scheduledStreams = useMemo(
    () => scheduledQuery.data ?? [],
    [scheduledQuery.data],
  );
  const endedStreams = useMemo(() => endedQuery.data ?? [], [endedQuery.data]);
  const recentEnded = endedStreams
    .filter((s) => s.ended_at && Date.now() - new Date(s.ended_at).getTime() < 7 * 86_400_000)
    .slice(0, 4);
  // CLS INC3: remember whether live led the page last time so the hero slot is
  // reserved from first paint (skeleton) instead of inserting itself above the
  // editorial section when the queries resolve.
  //
  // 2026-08-19 — the hint moved from sessionStorage to localStorage. Session
  // scope reserved the slot only on repeat navigations, leaving the first
  // pageview of every session unreserved, and that is the pageview CrUX
  // weights most: field CLS was p75 0.37 on mobile with 37.5% of users above
  // 0.25. Device scope narrowed that to the first ever visit.
  //
  // Later the same day: even that residual was the wrong default. The slot
  // leads whenever a stream is on air, scheduled, OR ended within seven days,
  // so an occupied slot is the ordinary state here and an empty one is the
  // exception. shouldReserveLiveSlot therefore reserves unless the hint
  // positively says otherwise — a first visit now reserves too. The cost is a
  // collapse shift on a genuinely quiet week; the thing it buys back is the
  // insertion shift that was hitting every new reader and every lab run.
  // See src/lib/home-live-lead.ts for the TTL and the failure modes.
  const liveQueriesLoading =
    liveQuery.isLoading || scheduledQuery.isLoading || endedQuery.isLoading;
  const [expectLiveLead] = useState<boolean>(() => shouldReserveLiveSlot());
  useEffect(() => {
    if (liveQueriesLoading) return;
    const leads =
      liveStreams.length > 0 || scheduledStreams.length > 0 || recentEnded.length > 0;
    writeLiveLeadHint(leads);
  }, [liveQueriesLoading, liveStreams.length, scheduledStreams.length, recentEnded.length]);
  const { data: allTournaments = [] } = useTournaments();
  const { data: videos = [] } = useVideos({ limit: 6 });
  const { data: homeStats } = useHomepageStats();
  // VI homepage stories come from Supabase vi_blog_posts (mirrors /vi/blog) so
  // VI-only posts without an EN manifest entry still surface on the homepage.
  const { data: viPosts = [], isLoading: viPostsLoading } = usePublishedViBlogPosts();

  const homeNewsQuery = useNewsItems({
    limit: HOME_NEWS_LIMIT + 6,
    language,
  });

  // Re-order the home feed in realtime when a stream goes live / ends.
  // Invalidates the ["livestreams"] queries so hasLiveData flips without
  // a reload, popping the LiveSection in/out of the priority cluster.
  useLiveStatusRealtime();

  const queryClient = useQueryClient();
  const ptrState = usePullToRefresh(async () => {
    // No queryKey filter → React Query only refetches queries with active
    // observers, which on this page is exactly the data we render. Avoids
    // maintaining a per-page key allowlist.
    await queryClient.invalidateQueries();
  });

  // Featured stories come from the generated bilingual content manifest.
  // Keeping both locales synchronous gives the homepage an immediate LCP and
  // prevents the VI editorial section from being inserted after first paint.
  type Story = {
    slug: string;
    title: string;
    summary: string;
    tag: string | null;
    image: string | null;
    imageAlt: string;
    author: string;
    /** The LATER of publish/update — see lib/blogOrder. */
    date: string | null;
    refreshed: boolean;
    href: string;
  };

  const stories: Story[] = useMemo(() => {
    // VI: source from Supabase vi_blog_posts (same as /vi/blog) so VI-only posts
    // without an EN manifest entry still surface here. EN keeps the synchronous
    // bilingual manifest for immediate LCP.
    if (language === "vi") {
      return [...viPosts]
        .sort(byEffectiveDateDesc((p) => p.published_at, (p) => p.updated_at))
        .slice(0, 6)
        .map((p) => ({
        slug: p.slug,
        title: p.title,
        summary: p.excerpt ?? "",
        tag: p.category ?? p.tags?.[0] ?? null,
        image: p.cover_image_url,
        imageAlt: p.title,
        author: "ThePickleHub",
        date: effectiveDateIso(p.published_at, p.updated_at),
        refreshed: isRefreshed(p.published_at, p.updated_at),
        href: `/vi/blog/${p.slug}`,
      }));
    }
    return [...blogMetadata]
      .sort(byEffectiveDateDesc((p) => p.publishedDate, (p) => p.updatedDate))
      .slice(0, 6)
      .map((p) => ({
        slug: p.slug,
        title: p.titleEn,
        summary: p.metaDescriptionEn,
        tag: p.tags[0] ?? null,
        image: p.heroImage?.src ?? null,
        imageAlt: p.heroImage?.alt ?? p.titleEn,
        author: p.author,
        date: effectiveDateIso(p.publishedDate, p.updatedDate),
        refreshed: isRefreshed(p.publishedDate, p.updatedDate),
        href: `/blog/${p.slug}`,
      }));
  }, [language, viPosts]);

  // Ticker — 3-mode priority resolver:
  //   live (active or scheduled within 24h, mixed with fresh results)
  //   → pro-tour matches (last 3d) → blog posts (always-on fallback)
  // Replaces the previous live > scheduled > replay cascade so the bar
  // surfaces fresh content even on quiet broadcast days. Hook returns
  // { mode, items } so the JSX below can colour the head label by mode
  // (red for live, gold for matches, muted for blog).
  const ticker = useTickerData(language, {
    live: liveStreams,
    scheduled: scheduledStreams,
    isLoading: liveQuery.isLoading || scheduledQuery.isLoading,
  });

  const upcomingTournaments = useMemo(() => {
    const now = Date.now();
    return [...allTournaments]
      .filter((tourn) => {
        if (tourn.status === "ended") return false;
        if (!tourn.start_date) return true;
        const start = new Date(tourn.start_date).getTime();
        const end = tourn.end_date ? new Date(tourn.end_date).getTime() : start + 86400000;
        return end >= now;
      })
      .sort((a, b) => {
        const aD = a.start_date ? new Date(a.start_date).getTime() : Infinity;
        const bD = b.start_date ? new Date(b.start_date).getTime() : Infinity;
        return aD - bD;
      })
      .slice(0, 5);
  }, [allTournaments]);

  const hasLiveData = liveStreams.length > 0;
  const liveCount = liveStreams.length;
  const upcomingCount = scheduledStreams.length;

  // Unified Coming-up timeline (R2-9). Tournaments + scheduled streams
  // merged into one chronological list so users see "what's next"
  // without scanning two columns. Each item carries everything the row
  // needs to render — kind tag, date, link, meta line.
  type ScheduleItem = {
    id: string;
    dateIso: string | null | undefined;
    title: string;
    href: string;
    orgName: string | null;
    metaLine: ReactNode;
    tagLabel: string;
    tagCls: string;
  };
  const scheduleItems = useMemo<ScheduleItem[]>(() => {
    const items: ScheduleItem[] = [];
    upcomingTournaments.forEach((tourn) => {
      const endDate = formatDate(tourn.end_date);
      items.push({
        id: `t-${tourn.id}`,
        dateIso: tourn.start_date,
        title: tourn.name,
        href: `/tournament/${tourn.slug}`,
        orgName:
          (tourn as { organization?: { name?: string | null } | null }).organization?.name ?? null,
        metaLine: (
          <>
            <span>{language === "vi" ? `Trạng thái: ${tourn.status}` : `Status: ${tourn.status}`}</span>
            {tourn.end_date && (
              <>
                <span className="sep">·</span>
                <span>
                  {language === "vi"
                    ? `Kết thúc ${endDate.d} ${endDate.m}`
                    : `Ends ${endDate.d} ${endDate.m}`}
                </span>
              </>
            )}
          </>
        ),
        tagLabel: language === "vi" ? "GIẢI" : "BRACKET",
        tagCls: tourn.status === "ongoing" ? "live" : tourn.status === "upcoming" ? "active" : "",
      });
    });
    scheduledStreams.slice(0, 5).forEach((stream) => {
      items.push({
        id: `s-${stream.id}`,
        dateIso: stream.scheduled_start_at,
        title: stream.title ?? (language === "vi" ? "Stream sắp tới" : "Upcoming stream"),
        href: `/live/${stream.id}`,
        orgName: stream.organization?.name ?? null,
        metaLine: (
          <>
            <span>{formatTime(stream.scheduled_start_at)}</span>
            <span className="sep">·</span>
            <Countdown
              to={stream.scheduled_start_at}
              pastLabel={language === "vi" ? "Đang phát" : "Live now"}
              language={language}
            />
          </>
        ),
        tagLabel: language === "vi" ? "STREAM" : "STREAM",
        tagCls: "",
      });
    });
    // Sort chronologically by start date (ascending). Items with no date sink last.
    items.sort((a, b) => {
      const aT = a.dateIso ? new Date(a.dateIso).getTime() : Infinity;
      const bT = b.dateIso ? new Date(b.dateIso).getTime() : Infinity;
      return aT - bT;
    });
    return items.slice(0, 8);
  }, [upcomingTournaments, scheduledStreams, language]);

  // Newsletter form wired to newsletter-subscribe edge function
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const subscribeMut = useNewsletterSubscribe();
  const onSubscribe = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const value = email.trim();
    if (!value || !value.includes("@")) {
      setFormError(language === "vi" ? "Email không hợp lệ." : "Invalid email address.");
      return;
    }
    subscribeMut.mutate(
      { email: value, language, source: "the-line-homepage" },
      {
        onSuccess: () => {
          setSubscribed(true);
          setEmail("");
        },
        onError: (err) => {
          setFormError(
            err.message ||
            (language === "vi" ? "Có lỗi, thử lại sau." : "Something went wrong. Try again later."),
          );
        },
      },
    );
  };

  return (
    <TheLineLayout
      title={language === "vi"
        ? "ThePickleHub – Pickleball Châu Á: Live & Giải đấu"
        : "ThePickleHub – Pickleball Asia: Live & Tournaments"}
      description={language === "vi"
        ? "ThePickleHub — Đưa tin pickleball chuyên nghiệp toàn cầu. Tin tức PPA, APP, MLP, lịch giải, livestream, và bracket miễn phí. Trụ sở tại TP.HCM."
        : "ThePickleHub — Editorial coverage of professional pickleball. PPA, APP, MLP news, schedules, livestreams, and free bracket tools. Headquartered in Ho Chi Minh City."}
      active="home"
    >
      <PullToRefreshIndicator state={ptrState} />
      <HreflangTags enPath="/" viPath="/vi" />
      {/*
        Note (2026-04-29): client-side <OrganizationSchema /> removed.
        Bot prerender already emits a richer Organization + WebSite JSON-LD
        graph in functions/_lib/render/index.ts:renderHome (with address,
        sameAs, EN description). Client component duplicated it with a
        thinner VI-only description, which Google "Live URL Inspection"
        would surface as duplicate Organization markup.
        Refs: growth-tasks/POST-CUTOVER-CHECKLIST-2026-04-28.md section E.
      */}
      {/* Ticker — 3-mode (live / matches / blog), each item is a Link.
          Marquee duplicates the items array so the CSS translate(-50%)
          loop is seamless. Mode controls the head label colour: red dot
          for live, gold pip for matches, muted dot for blog. */}
      {(() => {
        const headLabel = (() => {
          if (ticker.mode === "live") return language === "vi" ? "Trực tiếp" : "Live";
          if (ticker.mode === "matches") return language === "vi" ? "Kết quả" : "Results";
          if (ticker.mode === "blog") return language === "vi" ? "Tin tức" : "Stories";
          return language === "vi" ? "Bảng tin" : "Headlines";
        })();
        const ariaLabel =
          language === "vi"
            ? `Bảng tin — ${headLabel.toLowerCase()}`
            : `Headlines ticker — ${headLabel.toLowerCase()}`;
        return (
          <div
            className={`tl-ticker tl-ticker--mode-${ticker.mode}`}
            aria-label={ariaLabel}
          >
            <div className="tl-ticker-head">
              <span className="dot" aria-hidden="true" />
              {headLabel}
            </div>
            <div className="tl-ticker-body">
              <div className="tl-ticker-track">
                {/* a11y: the second copy exists only to make the marquee
                    loop seamless — hide it from AT + tab order. */}
                {[false, true].map((dup) => (
                  <span
                    key={dup ? "dup" : "main"}
                    aria-hidden={dup || undefined}
                    style={{ display: "inline-flex", gap: 40 }}
                  >
                    {ticker.items.map((item, idx) => (
                      <Link
                        key={`${item.id}-${idx}`}
                        to={item.href}
                        className="tl-ticker-item"
                        tabIndex={dup ? -1 : undefined}
                      >
                        {item.lead && <span className="lead">{item.lead}</span>}
                        {item.lead && <span className="sep"> · </span>}
                        <b>{item.body}</b>
                        {item.trail && (
                          <>
                            <span className="sep"> · </span>
                            <span className="trail">{item.trail}</span>
                          </>
                        )}
                      </Link>
                    ))}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── DUPR × ThePickleHub partnership strip ──
          A horizontal certificate-style band that sits between the news
          ticker and the hero eyebrow. Lives in the Calibrated Quiet design
          system (cream paper, hairline rules, single green accent).
          Clickable through to /dupr. Image scales responsively at container
          width — wide aspect (2400×360 ≈ 6.7:1) reads cleanly on desktop,
          quiet but legible at mobile breakpoints. */}
      {(() => {
        const alt =
          language === "vi"
            ? "ThePickleHub × DUPR — Đối tác chính thức"
            : "ThePickleHub × DUPR — Official Partner";
        return (
          <div className="tl-shell" style={{ marginTop: 0, marginBottom: -28 }}>
            <div className="relative">
            <Link
              to="/dupr"
              aria-label={alt}
              className="tl-dupr-strip block w-full overflow-hidden rounded-md transition-opacity hover:opacity-95"
            >
              {/* Responsive art-direction: a wide/thin 8:1 band on desktop
                  (≥768px) so the strip never eats more than ~160px of
                  vertical space, and a taller 4:1 band on mobile where
                  the text needs the extra height to stay legible. */}
              <picture>
                <source
                  media="(min-width: 768px)"
                  srcSet="/images/partnerships/dupr-strip-wide.png?v=5"
                />
                <img
                  src="/images/partnerships/dupr-strip.png?v=5"
                  alt={alt}
                  width={2400}
                  height={600}
                  loading="eager"
                  fetchPriority="auto"
                  className="block h-auto w-full"
                />
              </picture>
            </Link>
            {/* Sibling overlays in the certificate's top-right kicker zone.
                Two actions sit together so the partnership strip doubles as
                an always-visible entry point to the DUPR log-match flow:
                  · primary  → "Log trận" into /match/new
                  · secondary → the DUPR user guide
                Both live in the same relative wrapper as the banner Link so
                they don't nest <a> inside <a> (invalid HTML). Colours are
                fixed cream/ink hexes — not theme tokens — because the strip
                art is a fixed-palette certificate regardless of dark theme. */}
            <div className="absolute right-3 top-3 md:right-5 md:top-5 flex items-center gap-2">
              <Link
                to="/match/new"
                aria-label={language === "vi" ? "Log trận đấu lên DUPR" : "Log a match to DUPR"}
                className="tl-dupr-log-cta relative inline-flex items-center gap-1.5 rounded-sm border border-[#0e0f12] bg-[#0e0f12] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[#ece7d8] shadow-sm transition-colors hover:bg-[#ece7d8] hover:text-[#0e0f12] md:px-3.5 md:py-1.5 md:text-xs before:absolute before:-inset-y-3 before:-inset-x-1 before:content-['']"
                style={{
                  fontFamily:
                    '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                  fontWeight: 600,
                }}
              >
                <span aria-hidden="true">+</span>
                {language === "vi" ? "Log trận" : "Log match"}
              </Link>
              <Link
                to="/vi/blog/huong-dan-dung-dupr-tren-thepicklehub"
                aria-label={language === "vi" ? "Hướng dẫn sử dụng DUPR" : "DUPR user guide"}
                className="tl-dupr-guide-cta relative inline-flex items-center gap-1.5 rounded-sm border border-[#1a1d22]/30 bg-[#ece7d8] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[#0e0f12] shadow-sm transition-colors hover:bg-[#0e0f12] hover:text-[#ece7d8] hover:border-[#0e0f12] md:px-3.5 md:py-1.5 md:text-xs before:absolute before:-inset-y-3 before:-inset-x-1 before:content-['']"
                style={{
                  fontFamily:
                    '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                  fontWeight: 500,
                }}
              >
                {language === "vi" ? "Hướng dẫn" : "User guide"}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            </div>
          </div>
        );
      })()}

      {/* ── Priority feed — Live (on air / upcoming) → Editorial → News ──
          Product priority wins while a broadcast is live or scheduled.
          Replay-only days keep editorial first. Reserved editorial/news
          skeletons still stabilize the async content inside each slot. */}
      {(() => {
        const editorialNode = stories.length > 0 ? (
          <section className="tl-section">
            <div className="tl-shell">
              <div className="tl-sec-head">
                <h2>
                  {language === "vi" ? (
                    <>
                      Tuần này. <em className="tl-serif">N°{isoWeekNumber()}</em>
                    </>
                  ) : (
                    <>
                      This week. <em className="tl-serif">N°{isoWeekNumber()}</em>
                    </>
                  )}
                </h2>
                <p>
                  {language === "vi"
                    ? "Phóng sự dài kỳ — phóng viên, HLV, và những người có mặt khi câu chuyện diễn ra."
                    : "Longform reporting — by reporters, coaches, and people who were there when the story happened."}
                </p>
              </div>

              {/* Only the 2 most recent on the home feed — the rest live
                  behind the "see all stories" button below. */}
              <div className="tl-stories-grid">
                {stories.slice(0, 2).map((story, index) => (
                    <Link key={story.slug} to={story.href} className="tl-story">
                      <div className="tl-story-img">
                        <StoryImage story={story} index={index} />
                        {story.tag && <span className="tl-story-tag">{story.tag}</span>}
                      </div>
                      <div className="tl-story-body">
                        <h3 className="tl-story-title">{story.title}</h3>
                        {story.summary && <p className="tl-story-summary">{story.summary}</p>}
                        <div className="tl-story-foot">
                          <b>{story.author}</b>
                          {story.date && (
                            <>
                              <span>·</span>
                              <span>
                                {story.refreshed
                                  ? `${language === "vi" ? "Cập nhật" : "Updated"} ${formatDate(story.date).full}`
                                  : formatDate(story.date).full}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                ))}
              </div>

              <div style={{ textAlign: "center", marginTop: 32 }}>
                <Link to={language === "vi" ? "/vi/blog" : "/blog"} className="tl-btn">
                  {language === "vi" ? "Xem tất cả bài viết →" : "See all stories →"}
                </Link>
              </div>
            </div>
          </section>
        ) : language === "vi" && viPostsLoading ? (
          <section className="tl-section tl-editorial-skeleton" aria-busy="true" aria-label="Đang tải bài viết">
            <div className="tl-shell">
              <div className="tl-sec-head" aria-hidden="true">
                <span className="tl-feed-skeleton tl-feed-skeleton--heading" />
                <span className="tl-feed-skeleton tl-feed-skeleton--summary" />
              </div>
              {/* 3 placeholders — ui-ux-verifier 09/08 measured the 2-story
                  skeleton 324px short of the resolved section on mobile,
                  which made THIS skeleton the home page's largest remaining
                  layout shift for VI users. */}
              <div className="tl-stories-grid" aria-hidden="true">
                {Array.from({ length: 3 }, (_, index) => (
                  <div className="tl-story" key={index}>
                    <div className="tl-story-img tl-feed-skeleton" />
                    <div className="tl-story-body">
                      <span className="tl-feed-skeleton tl-feed-skeleton--title" />
                      <span className="tl-feed-skeleton tl-feed-skeleton--summary" />
                      <span className="tl-feed-skeleton tl-feed-skeleton--meta" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null;

        // Live leads whenever a stream is on air, scheduled, OR ended within
        // 7 days (restores the 4f8c53b1 replay-window behavior dropped by
        // 48a94353/#501 — owner call: replays hold the top slot for a week).
        const liveLeads =
          hasLiveData || scheduledStreams.length > 0 || recentEnded.length > 0;
        const liveNode = liveQueriesLoading
          ? expectLiveLead
            ? { key: "live", node: <LiveSectionSkeleton /> }
            : null
          : liveLeads
            ? {
                key: "live",
                node: (
                  <LiveSection
                    liveStreams={liveStreams}
                    scheduledStreams={scheduledStreams}
                    endedStreams={recentEnded}
                    language={language}
                    priority
                  />
                ),
              }
            : null;

        const cluster: Array<{ key: string; node: ReactNode }> = [
          liveNode,
          editorialNode ? { key: "editorial", node: editorialNode } : null,
          {
            key: "news",
            node: (
              <HomeNewsFeed
                language={language}
                limit={HOME_NEWS_LIMIT}
                news={homeNewsQuery.data ?? []}
                isLoading={homeNewsQuery.isLoading}
              />
            ),
          },
        ].filter((s): s is { key: string; node: JSX.Element } => Boolean(s));

        return cluster.map((s) => <Fragment key={s.key}>{s.node}</Fragment>);
      })()}

      {/* Log Match call-to-action — primary action for authed users.
          Component guards internally on useAuth + useDuprConnection, so
          it renders nothing for anonymous visitors and adapts copy
          based on whether DUPR is connected yet. */}
      <HomeLogMatchCTA />

      {/* Live pulse strip — chips that tell what's happening RIGHT NOW.
          Live count chip pulses red when active; data signals follow. */}
      <section className="tl-shell">
        <div className="tl-pulse-strip" role="list">
          {liveCount > 0 && (
            <Link to="/live" className="tl-pulse-chip is-live" role="listitem">
              <span className="tl-pulse-dot" aria-hidden="true" />
              <span className="tl-pulse-value">{liveCount}</span>
              <span className="tl-pulse-label">
                {language === "vi"
                  ? (liveCount === 1 ? "TRẬN ĐANG LIVE" : "TRẬN ĐANG LIVE")
                  : (liveCount === 1 ? "LIVE NOW" : "LIVE NOW")}
              </span>
            </Link>
          )}
          {upcomingCount > 0 && (
            <Link to="/live" className="tl-pulse-chip" role="listitem">
              <span className="tl-pulse-ico" aria-hidden="true"><Clock size={12} /></span>
              <span className="tl-pulse-value">{upcomingCount}</span>
              <span className="tl-pulse-label">
                {language === "vi" ? "SẮP TỚI" : "UPCOMING"}
              </span>
            </Link>
          )}
          <Link to="/tournaments" className="tl-pulse-chip" role="listitem">
            <span className="tl-pulse-ico" aria-hidden="true"><Diamond size={12} /></span>
            <span className="tl-pulse-value">
              {homeStats ? homeStats.total_tournaments.toLocaleString("en-US") : "—"}
            </span>
            <span className="tl-pulse-label">
              {language === "vi" ? "GIẢI ĐẤU" : "TOURNAMENTS"}
            </span>
          </Link>
          <div className="tl-pulse-chip" role="listitem">
            <span className="tl-pulse-ico" aria-hidden="true"><CircleDot size={12} /></span>
            <span className="tl-pulse-value">
              {homeStats ? homeStats.total_users.toLocaleString("en-US") : "—"}
            </span>
            <span className="tl-pulse-label">
              {language === "vi" ? "NGƯỜI CHƠI" : "PLAYERS"}
            </span>
          </div>
          <div className="tl-pulse-chip tl-pulse-chip--secondary" role="listitem">
            <span className="tl-pulse-ico" aria-hidden="true"><Target size={12} /></span>
            <span className="tl-pulse-value">{PPA_ASIA_STOPS}</span>
            <span className="tl-pulse-label">PPA ASIA · 2026</span>
          </div>
        </div>
      </section>

      {/* Manifesto — moved up from end-of-page (Round 2 audit P0-A).
          Brand thesis arrives early, while user is still scrolling.
          Kicker renumbered / 04 → / 02 to match new position. */}
      <section className="tl-manifesto tl-deferred-section">
        <div className="tl-shell">
          <div className="tl-manifesto-inner">
            {language === "vi" ? (
              <>
                <div className="num tl-mono">/ 02 — Tinh thần của chúng tôi</div>
                <h2>
                  Pickleball xứng đáng <br />
                  có sự <em className="tl-serif">chăm sóc</em> <br />
                  <span className="dim">như mọi môn thể thao</span> <br />
                  <span className="dim">đã có cả thế kỷ</span> <br />
                  <span className="dim">báo chí đứng sau.</span>
                </h2>

                <div className="grid">
                  <div className="item">
                    <h3>01 / Báo chí thật</h3>
                    <p>
                      Tường thuật trận đấu, chân dung vận động viên, phân tích — viết bởi phóng viên{" "}
                      <em>có mặt tại sân.</em> Không tổng hợp. No AI slop.
                    </p>
                  </div>
                  <div className="item">
                    <h3>02 / Mọi giải, một app</h3>
                    <p>
                      PPA. APP. MLP. European Open. Asia Pacific Series. Vietnam National.
                      Mọi bracket, mọi tỉ số, mọi sân — <em>ở một nơi.</em>
                    </p>
                  </div>
                  <div className="item">
                    <h3>03 / Dành cho người chơi</h3>
                    <p>
                      ThePickleHub là nền tảng pickleball dành cho người chơi trên toàn thế giới
                      theo dõi tin tức và livestream, tìm bạn chơi và sân, đồng thời tạo hoặc tham
                      gia giải đấu và sự kiện cộng đồng.
                    </p>
                    <p className="data-note">
                      Khi đăng nhập bằng Google, chúng tôi chỉ dùng tên, email và ảnh đại diện để
                      tạo, bảo vệ và cá nhân hóa tài khoản của bạn. <Link to="/privacy">Cách chúng tôi bảo vệ dữ liệu →</Link>
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="num tl-mono">/ 02 — What we believe</div>
                <h2>
                  Pickleball deserves <br />
                  the same <em className="tl-serif">care</em> <br />
                  <span className="dim">we'd give any sport</span> <br />
                  <span className="dim">with a century</span> <br />
                  <span className="dim">of reporting behind it.</span>
                </h2>

                <div className="grid">
                  <div className="item">
                    <h3>01 / Real journalism</h3>
                    <p>
                      Match reports, player features, and analysis written by reporters who were{" "}
                      <em>at the court.</em> No aggregation. No AI slop.
                    </p>
                  </div>
                  <div className="item">
                    <h3>02 / Every tour, one app</h3>
                    <p>
                      PPA. APP. MLP. European Open. Asia Pacific Series. Vietnam National.
                      Every bracket, every score, every court — <em>in one place.</em>
                    </p>
                  </div>
                  <div className="item">
                    <h3>03 / Built for players</h3>
                    <p>
                      ThePickleHub is a pickleball platform for players to follow news and
                      livestreams, find players and courts, and create or join tournaments and
                      community events.
                    </p>
                    <p className="data-note">
                      Google Sign-In uses only your name, email address, and profile photo to create,
                      secure, and personalize your account. <Link to="/privacy">How we protect your data →</Link>
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Schedule — single unified timeline now (R2-9). Always renders so
          even an empty state ("No upcoming events yet") gives users a stable
          anchor instead of the section disappearing entirely. */}
      <section className="tl-section tl-deferred-section">
        <div className="tl-shell">
          <div className="tl-sec-head">
            <h2>
              {language === "vi" ? (
                <>
                  Sắp <em className="tl-serif">diễn ra.</em>{" "}
                  <span className="sans">
                    {scheduleItems.length} sự kiện
                  </span>
                </>
              ) : (
                <>
                  Coming <em className="tl-serif">up.</em>{" "}
                  <span className="sans">
                    {scheduleItems.length} events
                  </span>
                </>
              )}
            </h2>
            <p>
              {language === "vi"
                ? "Lịch giải, lịch sóng — 30 ngày kế tiếp, sắp xếp theo thứ tự có mặt."
                : "Brackets and broadcasts — the next 30 days, in the order they hit the court."}
            </p>
          </div>

          {/* Unified chronological timeline (R2-9). Tournaments + scheduled
              streams interleaved by date, single column, kind tag distinguishes
              the two. Replaces the previous 2-panel grid which forced users
              to scan both columns to find what's happening tomorrow. */}
          <div className="tl-schedule-list">
            {scheduleItems.length === 0 ? (
              <div className="tl-empty-card">
                <div className="tl-empty-card-mark" aria-hidden="true">◌</div>
                <div className="tl-empty-card-label">
                  {language === "vi" ? "Chưa có sự kiện sắp tới" : "No upcoming events yet"}
                </div>
                <div className="tl-empty-card-hint">
                  {language === "vi"
                    ? "Lịch sẽ cập nhật khi giải mở đăng ký hoặc stream được lên lịch."
                    : "Schedule fills as brackets open registration and streams get scheduled."}
                </div>
              </div>
            ) : (
              scheduleItems.map((item) => {
                const date = formatDate(item.dateIso);
                return (
                  <Link key={item.id} to={item.href} className="tl-sched-row">
                    <div className="tl-sched-date">
                      <span className="d">{date.d}</span>
                      <span className="m">{date.m}</span>
                    </div>
                    <div className="tl-sched-body">
                      <h4>{item.title}</h4>
                      <div className="meta">
                        {item.orgName && (
                          <>
                            <span className="org-line">
                              {item.orgName}
                              <svg
                                viewBox="0 0 24 24"
                                className="tl-trust-tick"
                                fill="currentColor"
                                aria-label={language === "vi" ? "Nhà tổ chức xác minh" : "Verified organizer"}
                              >
                                <circle cx="12" cy="12" r="10" fill="currentColor" />
                                <path d="M8 12.5l2.5 2.5L16 9.5" stroke="var(--tl-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                              </svg>
                            </span>
                            <span className="sep">·</span>
                          </>
                        )}
                        {item.metaLine}
                      </div>
                    </div>
                    <div className="tl-sched-right">
                      <span className={`tag ${item.tagCls}`}>{item.tagLabel}</span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Courtside — video highlights. Hide entire section if 0 videos. */}
      {videos.length > 0 && (
        <section className="tl-section tl-deferred-section">
          <div className="tl-shell">
            <div className="tl-sec-head">
              <h2>
                <em className="tl-serif">{language === "vi" ? "Sân đấu." : "Courtside."}</em>{" "}
                <span className="sans">
                  {language === "vi"
                    ? `${videos.length} clip nổi bật`
                    : `${videos.length} highlights`}
                </span>
              </h2>
              <p>
                {language === "vi"
                  ? "Highlights trận đấu, phỏng vấn và behind-the-scenes ngay tại sân."
                  : "Match highlights, interviews, and behind-the-scenes from the court."}
              </p>
            </div>

            <div className="tl-courtside-grid">
              {videos.slice(0, 3).map((v) => (
                <Link key={v.id} to={`/watch/${v.id}`} className="tl-video-card">
                  <div className="tl-video-thumb">
                    <VideoThumbnail
                      thumbnailUrl={v.thumbnail_url}
                      storagePath={v.storage_path}
                      title={v.title}
                      showIconFallback={false}
                      allowVideoFallback={false}
                    />
                    <div className="tl-video-play-icon">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    {v.duration_seconds ? (
                      <span className="tl-video-duration">
                        {Math.floor(v.duration_seconds / 60)}:{(v.duration_seconds % 60).toString().padStart(2, "0")}
                      </span>
                    ) : null}
                  </div>
                  <div className="tl-video-body">
                    <h3 className="tl-video-title">{v.title}</h3>
                    <div className="tl-video-meta">
                      <span>{v.organization?.name ?? ""}</span>
                      {v.published_at && (
                        <>
                          <span>·</span>
                          <span>{formatRelative(v.published_at, language)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div style={{ textAlign: "center", marginTop: 28 }}>
              <Link to="/videos" className="tl-btn">
                {language === "vi" ? "Xem tất cả video →" : "View all videos →"}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Pull-quote — editorial breath between the video grid and the
          stories grid (R2-5 from Round 2 audit). Reinforces the "reporter
          at the court" thesis between two data-heavy content sections. */}
      <section className="tl-pullquote tl-deferred-section">
        <div className="tl-shell">
          <blockquote className="tl-pullquote-text">
            <span className="tl-pullquote-mark">"</span>
            {language === "vi" ? (
              <>
                Câu chuyện hay nhất xảy ra <em className="tl-serif">giữa hai pha bóng</em>
                {" "}— và chúng tôi cũng có mặt ở đó.
              </>
            ) : (
              <>
                The best stories happen <em className="tl-serif">between the points</em>
                {" "}— and we're there for those too.
              </>
            )}
          </blockquote>
          <div className="tl-pullquote-attr">
            {language === "vi" ? "— TÒA SOẠN THEPICKLEHUB" : "— THE PICKLEHUB DESK"}
          </div>
        </div>
      </section>

      {/* Newsletter — editorial convention ("Daily Brief") */}
      <section className="tl-newsletter tl-deferred-section">
        <div className="tl-shell">
          <div className="tl-newsletter-inner">
            <div className="tl-newsletter-kicker">◆ {language === "vi" ? "Bản tin hàng ngày" : "The Daily Brief"}</div>
            <h3>
              {language === "vi" ? (
                <>Tin pickleball, <em className="tl-serif">mỗi sáng.</em></>
              ) : (
                <>Pickleball news, <em className="tl-serif">every morning.</em></>
              )}
            </h3>
            <p>
              {language === "vi"
                ? "Trận đấu, phỏng vấn, phân tích — viết bởi phóng viên có mặt tại sân. Mỗi sáng thứ Tư, vào hộp thư của bạn."
                : "Match reports, interviews, analysis — written by reporters at the court. In your inbox every Wednesday morning."}
            </p>

            {subscribed ? (
              <div className="tl-newsletter-success">
                <Check size={13} aria-hidden="true" style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
                {language === "vi" ? "Đã đăng ký. Xem hộp thư của bạn." : "Subscribed. Check your inbox."}
              </div>
            ) : (
              <>
                <form className="tl-newsletter-form" onSubmit={onSubscribe} noValidate>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={language === "vi" ? "email@cua-ban.com" : "your@email.com"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    aria-invalid={formError ? "true" : "false"}
                    aria-label={language === "vi" ? "Địa chỉ email" : "Email address"}
                  />
                  <button
                    type="submit"
                    disabled={subscribeMut.isPending}
                    aria-label={
                      subscribeMut.isPending
                        ? (language === "vi" ? "Đang gửi đăng ký" : "Submitting subscription")
                        : (language === "vi" ? "Đăng ký nhận bản tin" : "Subscribe to newsletter")
                    }
                  >
                    {subscribeMut.isPending
                      ? "…"
                      : language === "vi" ? "Đăng ký" : "Subscribe"}
                  </button>
                </form>
                {formError && (
                  <div
                    className="tl-newsletter-success"
                    style={{ color: "var(--tl-live)" }}
                    role="alert"
                  >
                    {formError}
                  </div>
                )}
              </>
            )}

            <div className="tl-newsletter-privacy">
              {language === "vi" ? "Có thể hủy đăng ký bất cứ lúc nào." : "Unsubscribe anytime."}
            </div>
          </div>
        </div>
      </section>

    </TheLineLayout>
  );
};

export default Index;

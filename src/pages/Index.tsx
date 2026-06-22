import { useEffect, useMemo, useState, Fragment, FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useLivestreams, useTournaments, useVideos } from "@/hooks/useSupabaseData";
import { useLiveStatusRealtime } from "@/hooks/useLiveStatusRealtime";
import { LiveSection } from "@/components/home/LiveSection";
import { HomeNewsFeed } from "@/components/home/HomeNewsFeed";
import { useHomepageStats } from "@/hooks/useHomepageStats";
import { useNewsletterSubscribe } from "@/hooks/useNewsletterSubscribe";
import { blogMetadata } from "@/content/blog";
import { usePublishedViBlogPosts } from "@/hooks/useViBlogPosts";
import { normalizeImageUrl } from "@/lib/url-utils";
import { PPA_ASIA_STOPS } from "@/lib/constants";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Countdown } from "@/pages/preview/_Countdown";
import { HreflangTags } from "@/components/seo";
import { VideoThumbnail } from "@/components/video/VideoThumbnail";
import { useQueryClient } from "@tanstack/react-query";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { HomeLogMatchCTA } from "@/components/home/HomeLogMatchCTA";
import { useTickerData } from "@/hooks/useTickerData";

/**
 * Production homepage. Promoted from preview/the-line on 2026-04-25.
 * The preview source page src/pages/preview/TheLine.tsx remains intact
 * for the 14-day rollback window (cleanup commit on 2026-05-09).
 *
 * Helper utilities are imported from preview/ for now; they can be
 * promoted to a shared lib in a follow-up if other production pages
 * need them.
 */

const formatDate = (iso: string | null | undefined): { d: string; m: string; full: string } => {
  if (!iso) return { d: "—", m: "—", full: "" };
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return { d: "—", m: "—", full: "" };
  return {
    d: dt.getDate().toString().padStart(2, "0"),
    m: dt.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    full: dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  };
};

const formatTime = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

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

const formatRelative = (iso: string | null | undefined, lang: "en" | "vi" = "en"): string => {
  if (!iso) return "";
  const dt = new Date(iso).getTime();
  if (Number.isNaN(dt)) return "";
  const diff = dt - Date.now();
  const absMin = Math.abs(Math.round(diff / 60000));
  const isVi = lang === "vi";
  if (absMin < 1) return isVi ? "vừa xong" : "now";
  if (absMin < 60) {
    return isVi
      ? (diff > 0 ? `trong ${absMin} phút` : `${absMin} phút trước`)
      : (diff > 0 ? `in ${absMin}m` : `${absMin}m ago`);
  }
  const hrs = Math.round(absMin / 60);
  if (hrs < 24) {
    return isVi
      ? (diff > 0 ? `trong ${hrs} giờ` : `${hrs} giờ trước`)
      : (diff > 0 ? `in ${hrs}h` : `${hrs}h ago`);
  }
  const days = Math.round(hrs / 24);
  return isVi
    ? (diff > 0 ? `trong ${days} ngày` : `${days} ngày trước`)
    : (diff > 0 ? `in ${days}d` : `${days}d ago`);
};

const Index = () => {
  const { language } = useI18n();
  const { data: liveStreams = [] } = useLivestreams("live");
  const { data: scheduledStreams = [] } = useLivestreams("scheduled");
  const { data: endedStreams = [] } = useLivestreams("ended");
  const { data: allTournaments = [] } = useTournaments();
  const { data: videos = [] } = useVideos({ limit: 6 });
  const { data: homeStats } = useHomepageStats();

  // VI published blog posts (Supabase) — only queried when on VI locale to save a request
  const { data: viBlogPosts = [] } = usePublishedViBlogPosts();

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

  // Pause hero bg drift + ambient glow when the hero scrolls off-screen.
  // Effects keep ticking otherwise and burn battery on long sessions.
  // Toggles a data-offscreen attribute on .tl-hero; CSS pauses the
  // relevant animations when present.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".tl-hero");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.removeAttribute("data-offscreen");
          } else {
            entry.target.setAttribute("data-offscreen", "true");
          }
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Featured stories — 6 most recent, language-aware:
  //   EN: blogMetadata (static content with heroImage)
  //   VI: usePublishedViBlogPosts (Supabase vi_blog_posts.cover_image_url)
  // Normalized into a common shape so the render loop stays simple.
  type Story = {
    slug: string;
    title: string;
    summary: string;
    tag: string | null;
    image: string | null;
    imageAlt: string;
    author: string;
    date: string | null;
    href: string;
  };

  const stories: Story[] = useMemo(() => {
    if (language === "vi") {
      return viBlogPosts.slice(0, 6).map((p) => ({
        slug: p.slug,
        title: p.title,
        summary: p.excerpt ?? "",
        tag: p.category ?? (p.tags?.[0] ?? null),
        image: p.cover_image_url,
        imageAlt: p.title,
        author: "The PickleHub",
        date: p.published_at,
        href: `/vi/blog/${p.slug}`,
      }));
    }
    return [...blogMetadata]
      .sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime())
      .slice(0, 6)
      .map((p) => ({
        slug: p.slug,
        title: p.titleEn,
        summary: p.metaDescriptionEn,
        tag: p.tags[0] ?? null,
        image: p.heroImage?.src ?? null,
        imageAlt: p.heroImage?.alt ?? p.titleEn,
        author: p.author,
        date: p.publishedDate,
        href: `/blog/${p.slug}`,
      }));
  }, [language, viBlogPosts]);

  // Ticker — 3-mode priority resolver:
  //   live (active or scheduled within 24h) → pro-tour matches (last 3d)
  //   → blog posts (always-on fallback)
  // Replaces the previous live > scheduled > replay cascade so the bar
  // surfaces fresh content even on quiet broadcast days. Hook returns
  // { mode, items } so the JSX below can colour the head label by mode
  // (red for live, gold for matches, muted for blog).
  const ticker = useTickerData(language);

  // Featured cascade: live first, then upcoming, then a recent replay
  // (≤7 days old) so the homepage stays alive between events instead of
  // showing the empty-state mark whenever nothing is on right now.
  const recentReplay = useMemo(() => {
    return endedStreams.find((s) => {
      if (!s.ended_at) return false;
      const age = Date.now() - new Date(s.ended_at).getTime();
      return age >= 0 && age < 7 * 24 * 60 * 60 * 1000;
    }) ?? null;
  }, [endedStreams]);
  const featured = liveStreams[0] ?? scheduledStreams[0] ?? recentReplay ?? null;

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
        ? "Pickleball Việt Nam — Giải đấu, Livestream & Tin tức"
        : "Pickleball Asia: Live, Brackets & News"}
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
                {[...ticker.items, ...ticker.items].map((item, idx) => (
                  <Link
                    key={`${item.id}-${idx}`}
                    to={item.href}
                    className="tl-ticker-item"
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
                  fetchPriority="high"
                  className="block h-auto w-full"
                />
              </picture>
            </Link>
            {/* Sibling overlay — "Hướng dẫn sử dụng" CTA. Lives in the same
                relative wrapper as the banner Link so it doesn't nest <a>
                inside <a> (invalid HTML). Positioned top-right on all
                viewports so it sits in the certificate's quiet kicker
                zone without colliding with the wordmark union. */}
            <Link
              to="/vi/blog/huong-dan-dung-dupr-tren-thepicklehub"
              aria-label={language === "vi" ? "Hướng dẫn sử dụng DUPR" : "DUPR user guide"}
              className="tl-dupr-guide-cta absolute right-3 top-3 md:right-5 md:top-5 inline-flex items-center gap-1.5 rounded-sm border border-[#1a1d22]/30 bg-[#ece7d8] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[#0e0f12] shadow-sm transition-colors hover:bg-[#0e0f12] hover:text-[#ece7d8] hover:border-[#0e0f12] md:px-3.5 md:py-1.5 md:text-xs"
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
        );
      })()}

      {/* Hero */}
      {(() => {
        const heroBg =
          featured?.thumbnail_url
          ?? (featured?.mux_playback_id
              ? `https://image.mux.com/${featured.mux_playback_id}/thumbnail.jpg?width=1280&height=720&fit_mode=smartcrop`
              : null);
        return (
      <section
        className={`tl-hero${heroBg ? " tl-hero--has-bg" : ""}`}
        style={heroBg ? ({ "--hero-bg-image": `url("${heroBg}")` } as React.CSSProperties) : undefined}
      >
        <div className="tl-shell">
          <div className="tl-hero-grid">
            <div>
              <div className="tl-eyebrow tl-up tl-d1">
                <span className="pip" aria-hidden="true" />
                <span>
                  {language === "vi"
                    ? (hasLiveData
                        ? `Trực tiếp · ${liveCount} trận`
                        : "Phát sóng · 24h tới")
                    : (hasLiveData
                        ? `Live · ${liveCount} match${liveCount === 1 ? "" : "es"}`
                        : "Broadcast · Next 24h")}
                </span>
                <span className="sep">/</span>
                <span>
                  {language === "vi"
                    ? `${upcomingCount} sắp diễn ra`
                    : `${upcomingCount} scheduled`}
                </span>
              </div>

              <h1 className="tl-hero-title tl-up tl-d2">
                {language === "vi" ? (
                  hasLiveData ? (
                    <>
                      Mọi sân, <br />
                      <span className="dim">mọi bracket,</span> <br />
                      một màn hình.
                    </>
                  ) : (
                    <>
                      Pickleball, <br />
                      đưa tin <span className="dim">đúng cách</span> <br />
                      <span className="dim">một môn thể thao xứng đáng.</span>
                    </>
                  )
                ) : (
                  hasLiveData ? (
                    <>
                      Every court, <br />
                      <span className="dim">every bracket,</span> <br />
                      one screen.
                    </>
                  ) : (
                    <>
                      Pickleball, <br />
                      covered <span className="dim">the way</span> <br />
                      serious sport <span className="dim">should be.</span>
                    </>
                  )
                )}
              </h1>

              <p className="tl-hero-lede tl-up tl-d3">
                {language === "vi"
                  ? "Phóng viên tại sân. Tỷ số live thời gian thực. Một tài khoản — mọi giải."
                  : "Reporters at the court. Live scores that tick. One subscription, every tour."}
              </p>

              <div className="tl-hero-ctas tl-up tl-d4">
                <Link to="/live" className="tl-btn green">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {language === "vi"
                    ? (hasLiveData ? `Xem trực tiếp · ${liveCount} sân` : "Khám phá phát sóng")
                    : (hasLiveData ? `Watch live · ${liveCount} court${liveCount === 1 ? "" : "s"}` : "Browse broadcasts")}
                </Link>
                <Link to="/tournaments" className="tl-btn">
                  {language === "vi" ? "Xem lịch giải →" : "See schedule →"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
        );
      })()}

      {/* ── Priority feed cluster (R3) — Live → Editorial → News ──
          The home feed is treated as an ordered array of sections whose
          order re-prioritises by live state. When any court is live the
          LiveSection leads the cluster and pushes the editorial feature
          down; otherwise the editorial feature leads, with the "Tin mới"
          news feed directly beneath it. useLiveStatusRealtime keeps the
          live query fresh so the cluster re-orders in realtime without a
          reload. The old standalone "Live courts" grid + empty state was
          retired here — the live block now renders only when something is
          actually on air. */}
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

              <div className="tl-stories-grid">
                {stories.map((story) => (
                  <Link key={story.slug} to={story.href} className="tl-story">
                    <div className="tl-story-img">
                      {story.image ? (
                        <img
                          src={normalizeImageUrl(story.image)}
                          alt={story.imageAlt}
                          loading="lazy"
                        />
                      ) : null}
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
                            <span>{formatDate(story.date).full}</span>
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
        ) : null;

        const cluster: Array<{ key: string; node: ReactNode }> = [
          hasLiveData
            ? { key: "live", node: <LiveSection liveStreams={liveStreams} language={language} /> }
            : null,
          editorialNode ? { key: "editorial", node: editorialNode } : null,
          { key: "news", node: <HomeNewsFeed language={language} limit={4} /> },
        ].filter((s): s is { key: string; node: ReactNode } => Boolean(s));

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
              <span className="tl-pulse-ico" aria-hidden="true">◷</span>
              <span className="tl-pulse-value">{upcomingCount}</span>
              <span className="tl-pulse-label">
                {language === "vi" ? "SẮP TỚI" : "UPCOMING"}
              </span>
            </Link>
          )}
          <Link to="/tournaments" className="tl-pulse-chip" role="listitem">
            <span className="tl-pulse-ico" aria-hidden="true">◇</span>
            <span className="tl-pulse-value">
              {homeStats ? homeStats.total_tournaments.toLocaleString("en-US") : "—"}
            </span>
            <span className="tl-pulse-label">
              {language === "vi" ? "GIẢI ĐẤU" : "TOURNAMENTS"}
            </span>
          </Link>
          <div className="tl-pulse-chip" role="listitem">
            <span className="tl-pulse-ico" aria-hidden="true">◉</span>
            <span className="tl-pulse-value">
              {homeStats ? homeStats.total_users.toLocaleString("en-US") : "—"}
            </span>
            <span className="tl-pulse-label">
              {language === "vi" ? "NGƯỜI CHƠI" : "PLAYERS"}
            </span>
          </div>
          <div className="tl-pulse-chip tl-pulse-chip--secondary" role="listitem">
            <span className="tl-pulse-ico" aria-hidden="true">◎</span>
            <span className="tl-pulse-value">{PPA_ASIA_STOPS}</span>
            <span className="tl-pulse-label">PPA ASIA · 2026</span>
          </div>
        </div>
      </section>

      {/* Manifesto — moved up from end-of-page (Round 2 audit P0-A).
          Brand thesis arrives early, while user is still scrolling.
          Kicker renumbered / 04 → / 02 to match new position. */}
      <section className="tl-manifesto">
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
                      Tìm bạn đánh, đặt sân, theo dõi DUPR. Tất cả những gì người chơi cần —{" "}
                      <em>và không có thứ gì họ không cần.</em>
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
                      Find a partner, book a court, track your DUPR. Everything a player needs —{" "}
                      <em>and nothing they don't.</em>
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
      <section className="tl-section">
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
        <section className="tl-section">
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
      <section className="tl-pullquote" aria-hidden="true">
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
      <section className="tl-newsletter">
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
                ✓ {language === "vi" ? "Đã đăng ký. Xem hộp thư của bạn." : "Subscribed. Check your inbox."}
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

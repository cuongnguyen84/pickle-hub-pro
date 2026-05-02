import { useEffect, useMemo, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useLivestreams, useTournaments, useVideos } from "@/hooks/useSupabaseData";
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
import { LiveBroadcastHero } from "@/components/home/LiveBroadcastHero";

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
  const { data: liveStreams = [], isLoading: liveLoading } = useLivestreams("live");
  const { data: scheduledStreams = [], isLoading: scheduledLoading } = useLivestreams("scheduled");
  const { data: endedStreams = [] } = useLivestreams("ended");
  const { data: allTournaments = [] } = useTournaments();
  const { data: videos = [] } = useVideos({ limit: 6 });
  const { data: homeStats } = useHomepageStats();

  // VI published blog posts (Supabase) — only queried when on VI locale to save a request
  const { data: viBlogPosts = [] } = usePublishedViBlogPosts();

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

  // Ticker — live > scheduled > ended (recent), all pulled from real streams
  const tickerItems = useMemo(() => {
    const items: { text: string; org: string }[] = [];
    const tNext = language === "vi" ? "TIẾP THEO" : "NEXT";
    const tReplay = language === "vi" ? "REPLAY" : "REPLAY";
    const tLiveMatch = language === "vi" ? "Trận trực tiếp" : "Live match";
    const tUpcoming = language === "vi" ? "Sắp tới" : "Upcoming";
    const tMatch = language === "vi" ? "Trận đấu" : "Match";
    const tEmpty = language === "vi"
      ? "Hiện không có trận nào — quay lại sau"
      : "No broadcasts right now — check back soon";
    liveStreams.slice(0, 4).forEach((s) => {
      items.push({ text: s.title ?? tLiveMatch, org: s.organization?.name ?? "" });
    });
    scheduledStreams.slice(0, 2).forEach((s) => {
      items.push({
        text: `${tNext} · ${s.title ?? tUpcoming} · ${formatRelative(s.scheduled_start_at, language)}`,
        org: s.organization?.name ?? "",
      });
    });
    if (items.length < 4) {
      endedStreams.slice(0, 4 - items.length).forEach((s) => {
        items.push({
          text: `${tReplay} · ${s.title ?? tMatch}`,
          org: s.organization?.name ?? "",
        });
      });
    }
    return items.length > 0 ? items : [{ text: tEmpty, org: "" }];
  }, [liveStreams, scheduledStreams, endedStreams, language]);

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
      {/* Ticker */}
      <div className="tl-ticker" aria-label={language === "vi" ? "Bảng điểm trực tiếp" : "Live scores ticker"}>
        <div className="tl-ticker-head">
          <span className="dot" aria-hidden="true" />
          {language === "vi" ? "Trực tiếp" : "Live"}
        </div>
        <div className="tl-ticker-body">
          <div className="tl-ticker-track">
            {[...tickerItems, ...tickerItems].map((item, idx) => (
              <span key={idx}>
                <b>{item.text}</b>
                {item.org && (
                  <>
                    <span className="sep"> · </span>
                    {item.org}
                  </>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

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
          <div className={`tl-hero-grid${featured ? " tl-hero-grid--featured" : ""}`}>
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

            {/* Featured live broadcast — bold dark inverted card */}
            <div className="tl-up tl-d3">
              <LiveBroadcastHero
                featured={featured}
                language={language}
                tournamentName={
                  featured?.tournament_id
                    ? allTournaments.find((tn) => tn.id === featured.tournament_id)?.name ?? null
                    : null
                }
                isLoading={liveLoading || scheduledLoading}
              />
            </div>
          </div>
        </div>
      </section>
        );
      })()}

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

      {/* Live courts — primary feature; keep the heading always visible as a
          site-wide entry point. When no matches, show a single tight line of
          fallback copy (not a verbose description) per Round 2 Issue 5. */}
      <section className="tl-section">
        <div className="tl-shell">
          <div className="tl-sec-head">
            <h2>
              {language === "vi" ? (
                <>
                  Sân <em className="tl-serif">trực tiếp.</em>{" "}
                  <span className="sans">{liveCount} trận</span>
                </>
              ) : (
                <>
                  Live <em className="tl-serif">courts.</em>{" "}
                  <span className="sans">{liveCount} match{liveCount === 1 ? "" : "es"}</span>
                </>
              )}
            </h2>
            {liveStreams.length > 0 && (
              <p>
                {language === "vi"
                  ? "Mọi trận đang sóng. Phóng viên có mặt tại sân. Một cú chạm là vào."
                  : "Every match on air. Reporters at the court. One tap and you're in."}
              </p>
            )}
          </div>

          {liveLoading ? (
            <div className="tl-match-grid">
              {[0, 1, 2].map((n) => (
                <div key={n} className="tl-match" style={{ opacity: 0.4 }}>
                  <div className="tl-match-head">
                    <span>{language === "vi" ? "Đang tải…" : "Loading…"}</span>
                  </div>
                  <div className="tl-match-title">&nbsp;</div>
                  <div className="tl-match-foot"><span>&nbsp;</span></div>
                </div>
              ))}
            </div>
          ) : liveStreams.length === 0 ? (
            <div className="tl-empty-card">
              <div className="tl-empty-card-mark" aria-hidden="true">◌</div>
              <div className="tl-empty-card-label">
                {language === "vi"
                  ? "Không có trận nào đang sóng"
                  : "No match on air right now"}
              </div>
              <div className="tl-empty-card-hint">
                {language === "vi"
                  ? "Quay lại vào ngày thi đấu — hoặc xem lịch sắp tới."
                  : "Check back on match days — or browse what's coming up."}
              </div>
              <Link to="/live" className="tl-empty-card-cta">
                {language === "vi" ? "Xem tất cả sân →" : "Browse all courts →"}
              </Link>
            </div>
          ) : (
            <div className="tl-match-grid">
              {liveStreams.slice(0, 9).map((stream) => (
                <Link key={stream.id} to={`/live/${stream.id}`} className="tl-match">
                  <div className="tl-match-head">
                    <span className="stat live">{language === "vi" ? "Trực tiếp" : "Live"}</span>
                    <span className="ctx">
                      {stream.started_at
                        ? formatTime(stream.started_at)
                        : (language === "vi" ? "Đang phát" : "On air")}
                    </span>
                  </div>
                  <h3 className="tl-match-title">
                    {stream.title ?? (language === "vi" ? "Trận chưa có tên" : "Untitled match")}
                  </h3>
                  <div className="tl-match-foot">
                    <span className="org">
                      {stream.organization?.name ?? (language === "vi" ? "Phát sóng" : "Broadcast")}
                    </span>
                    <span className="v">{language === "vi" ? "Xem →" : "Watch →"}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
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

      {/* Schedule — hide entire section when both panels empty */}
      {(upcomingTournaments.length > 0 || scheduledStreams.length > 0) && (
      <section className="tl-section">
        <div className="tl-shell">
          <div className="tl-sec-head">
            <h2>
              {language === "vi" ? (
                <>
                  Sắp <em className="tl-serif">diễn ra.</em>{" "}
                  <span className="sans">
                    {upcomingTournaments.length + scheduledStreams.length} sự kiện
                  </span>
                </>
              ) : (
                <>
                  Coming <em className="tl-serif">up.</em>{" "}
                  <span className="sans">
                    {upcomingTournaments.length + scheduledStreams.length} events
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

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 20 }} className="tl-schedule-grid">
            {upcomingTournaments.length > 0 && (
            <div className="tl-panel">
              <div className="tl-panel-head">
                <h3>{language === "vi" ? "Giải đấu" : "Tournaments"}</h3>
                <span className="meta">
                  {language === "vi"
                    ? `${upcomingTournaments.length} sắp tới`
                    : `${upcomingTournaments.length} upcoming`}
                </span>
              </div>
              {(
                upcomingTournaments.map((tourn) => {
                  const date = formatDate(tourn.start_date);
                  const endDate = formatDate(tourn.end_date);
                  return (
                    <Link key={tourn.id} to={`/tournament/${tourn.slug}`} className="tl-sched-row">
                      <div className="tl-sched-date">
                        <span className="d">{date.d}</span>
                        <span className="m">{date.m}</span>
                      </div>
                      <div className="tl-sched-body">
                        <h4>{tourn.name}</h4>
                        <div className="meta">
                          {(tourn as { organization?: { name?: string | null } | null }).organization?.name && (
                            <>
                              <span className="org-line">
                                {(tourn as { organization?: { name?: string | null } | null }).organization?.name}
                                <svg
                                  viewBox="0 0 24 24"
                                  className="tl-trust-tick"
                                  fill="currentColor"
                                  aria-label={language === "vi" ? "Nhà tổ chức xác minh" : "Verified organizer"}
                                >
                                  <path d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="0" />
                                  <circle cx="12" cy="12" r="10" fill="currentColor" />
                                  <path d="M8 12.5l2.5 2.5L16 9.5" stroke="var(--tl-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                </svg>
                              </span>
                              <span className="sep">·</span>
                            </>
                          )}
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
                        </div>
                      </div>
                      <div className="tl-sched-right">
                        <span className={`tag ${tourn.status === "ongoing" ? "live" : tourn.status === "upcoming" ? "active" : ""}`}>
                          {tourn.status}
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
            )}

            {scheduledStreams.length > 0 && (
            <div className="tl-panel">
              <div className="tl-panel-head">
                <h3>{language === "vi" ? "Phát sóng" : "Streams"}</h3>
                <span className="meta">
                  {language === "vi"
                    ? `${scheduledStreams.length} sắp tới`
                    : `${scheduledStreams.length} scheduled`}
                </span>
              </div>
              {scheduledLoading ? (
                <div className="tl-lc-empty" style={{ padding: "32px 20px" }}>
                  {language === "vi" ? "Đang tải…" : "Loading…"}
                </div>
              ) : (
                scheduledStreams.slice(0, 5).map((stream) => {
                  const date = formatDate(stream.scheduled_start_at);
                  return (
                    <Link key={stream.id} to={`/live/${stream.id}`} className="tl-sched-row">
                      <div className="tl-sched-date">
                        <span className="d">{date.d}</span>
                        <span className="m">{date.m}</span>
                      </div>
                      <div className="tl-sched-body">
                        <h4>{stream.title ?? (language === "vi" ? "Stream sắp tới" : "Upcoming stream")}</h4>
                        <div className="meta">
                          <span>{formatTime(stream.scheduled_start_at)}</span>
                          <span className="sep">·</span>
                          <span>{stream.organization?.name ?? (language === "vi" ? "Phát sóng" : "Broadcast")}</span>
                          <span className="sep">·</span>
                          <Countdown
                            to={stream.scheduled_start_at}
                            pastLabel={language === "vi" ? "Đang phát" : "Live now"}
                            language={language}
                          />
                        </div>
                      </div>
                      <div className="tl-sched-right">
                        <span className="tag">{language === "vi" ? "Phát sóng" : "Stream"}</span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
            )}
          </div>
        </div>
      </section>
      )}

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

      {/* Stories (blog) — editorial image card grid, language-aware */}
      {stories.length > 0 && (
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
      )}

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

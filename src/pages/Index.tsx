import { useMemo, useState, FormEvent } from "react";
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
import { HreflangTags, OrganizationSchema } from "@/components/seo";

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

const formatRelative = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const dt = new Date(iso).getTime();
  if (Number.isNaN(dt)) return "";
  const diff = dt - Date.now();
  const absMin = Math.abs(Math.round(diff / 60000));
  if (absMin < 1) return "now";
  if (absMin < 60) return diff > 0 ? `in ${absMin}m` : `${absMin}m ago`;
  const hrs = Math.round(absMin / 60);
  if (hrs < 24) return diff > 0 ? `in ${hrs}h` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return diff > 0 ? `in ${days}d` : `${days}d ago`;
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
        author: "The Pickle Hub",
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
    liveStreams.slice(0, 4).forEach((s) => {
      items.push({ text: s.title ?? "Live match", org: s.organization?.name ?? "" });
    });
    scheduledStreams.slice(0, 2).forEach((s) => {
      items.push({
        text: `NEXT · ${s.title ?? "Upcoming"} · ${formatRelative(s.scheduled_start_at)}`,
        org: s.organization?.name ?? "",
      });
    });
    if (items.length < 4) {
      endedStreams.slice(0, 4 - items.length).forEach((s) => {
        items.push({
          text: `REPLAY · ${s.title ?? "Match"}`,
          org: s.organization?.name ?? "",
        });
      });
    }
    return items.length > 0 ? items : [{ text: "No broadcasts right now — check back soon", org: "" }];
  }, [liveStreams, scheduledStreams, endedStreams]);

  const featured = liveStreams[0] ?? scheduledStreams[0] ?? null;

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
        : "Pickleball Tournaments, Livestream & News — Built for Asia"}
      description={language === "vi"
        ? "ThePickleHub — Đưa tin pickleball chuyên nghiệp toàn cầu. Tin tức PPA, APP, MLP, lịch giải, livestream, và bracket miễn phí. Trụ sở tại TP.HCM."
        : "ThePickleHub — Editorial coverage of professional pickleball. PPA, APP, MLP news, schedules, livestreams, and free bracket tools. Headquartered in Ho Chi Minh City."}
      active="home"
    >
      <HreflangTags enPath="/" viPath="/vi" />
      <OrganizationSchema />
      {/* Ticker */}
      <div className="tl-ticker" aria-label="Live scores ticker">
        <div className="tl-ticker-head">
          <span className="dot" aria-hidden="true" />
          Live
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
      <section className="tl-hero">
        <div className="tl-shell">
          <div className="tl-hero-grid">
            <div>
              <div className="tl-eyebrow tl-up tl-d1">
                <span className="pip" aria-hidden="true" />
                <span>
                  {hasLiveData
                    ? `Live · ${liveCount} match${liveCount === 1 ? "" : "es"}`
                    : "Broadcast · Next 24h"}
                </span>
                <span className="sep">/</span>
                <span>{upcomingCount} scheduled</span>
              </div>

              <h1 className="tl-hero-title tl-up tl-d2">
                {hasLiveData ? (
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
                )}
              </h1>

              <p className="tl-hero-lede tl-up tl-d3">
                Global coverage of professional pickleball — PPA, APP, MLP, European Open,
                Asia Pacific Series. Real match reports by reporters at the court.
                Live scores that tick in real time. One subscription.
              </p>

              <p className="tl-hero-subline tl-up tl-d3">
                Nền tảng pickleball Việt Nam đầu tiên — tin tức PPA Tour, giải đấu, bracket miễn phí.
              </p>

              <div className="tl-hero-ctas tl-up tl-d4">
                <Link to="/live" className="tl-btn green">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {hasLiveData ? `Watch live · ${liveCount} court${liveCount === 1 ? "" : "s"}` : "Browse broadcasts"}
                </Link>
                <Link to="/tournaments" className="tl-btn">
                  See schedule →
                </Link>
              </div>
            </div>

            {/* Featured live scoreboard */}
            <div className="tl-livecard tl-up tl-d3">
              <div className="tl-lc-head">
                <span className={featured?.status === "live" ? "live" : ""}>
                  {featured?.status === "live" ? "Live" : featured?.status === "scheduled" ? "Upcoming" : "Featured"}
                </span>
                <span>
                  {featured?.status === "scheduled" && featured.scheduled_start_at ? (
                    <Countdown to={featured.scheduled_start_at} pastLabel="Live now" />
                  ) : (
                    featured?.organization?.name ?? "No match"
                  )}
                </span>
              </div>

              {featured ? (
                <>
                  <div className="tl-lc-body">
                    <div className="tl-lc-row leader">
                      <span className="tl-lc-seed">●</span>
                      <div className="tl-lc-name">
                        <span className="name-text">{featured.title ?? "Match"}</span>
                      </div>
                      <div className="tl-lc-sets">
                        <span className="tl-lc-set current">
                          {featured.status === "live" ? "LIVE" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="tl-lc-row" style={{ paddingTop: 14, borderTop: "1px solid var(--tl-border)", marginTop: 6 }}>
                      <span className="tl-lc-seed" />
                      <div
                        className="tl-mono"
                        style={{ fontSize: 11, color: "var(--tl-fg-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}
                      >
                        {featured.description
                          ? featured.description.slice(0, 80) + (featured.description.length > 80 ? "…" : "")
                          : featured.scheduled_start_at
                          ? `Scheduled · ${formatTime(featured.scheduled_start_at)}`
                          : "Pickleball match"}
                      </div>
                    </div>
                  </div>
                  <div className="tl-lc-footer">
                    <span className="meta">
                      {featured.tournament_id
                        ? allTournaments.find((tn) => tn.id === featured.tournament_id)?.name ?? "Tournament match"
                        : "Live broadcast"}
                    </span>
                    <Link to={`/live/${featured.id}`} className="watch">
                      Watch →
                    </Link>
                  </div>
                </>
              ) : (
                <div className="tl-lc-empty">
                  {liveLoading || scheduledLoading ? "Loading live data…" : "No live matches right now"}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip — trust signal, 3-column editorial numbers.
          Live from Supabase via get_homepage_stats RPC + PPA_ASIA_STOPS constant.
          Dash placeholder while loading avoids CLS. */}
      <section className="tl-shell">
        <div className="tl-stats-strip">
          <div className="tl-stat-cell">
            <span className="num">
              {homeStats ? homeStats.total_users.toLocaleString("en-US") : "—"}
            </span>
            <span className="lbl">{language === "vi" ? "Người chơi" : "Players tracked"}</span>
          </div>
          <div className="tl-stat-cell">
            <span className="num">
              {homeStats ? homeStats.total_tournaments.toLocaleString("en-US") : "—"}
            </span>
            <span className="lbl">{language === "vi" ? "Giải đấu" : "Tournaments covered"}</span>
          </div>
          <div className="tl-stat-cell">
            <span className="num">{PPA_ASIA_STOPS}</span>
            <span className="lbl">{language === "vi" ? "Chặng PPA Asia · 2026" : "PPA Asia stops · 2026"}</span>
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
              Live <em className="tl-serif">courts.</em>{" "}
              <span className="sans">
                {liveCount} {language === "vi"
                  ? (liveCount === 1 ? "trận" : "trận")
                  : (liveCount === 1 ? "match" : "matches")}
              </span>
            </h2>
            {liveStreams.length > 0 && (
              <p>
                {language === "vi"
                  ? "Mọi trận đấu đang phát sóng, lấy trực tiếp từ DB. Bấm để xem với HLS độ trễ thấp."
                  : "Every match streaming right now, pulled live from the database. Click through to watch with low-delay HLS."}
              </p>
            )}
          </div>

          {liveLoading ? (
            <div className="tl-match-grid">
              {[0, 1, 2].map((n) => (
                <div key={n} className="tl-match" style={{ opacity: 0.4 }}>
                  <div className="tl-match-head">
                    <span>Loading…</span>
                  </div>
                  <div className="tl-match-title">&nbsp;</div>
                  <div className="tl-match-foot"><span>&nbsp;</span></div>
                </div>
              ))}
            </div>
          ) : liveStreams.length === 0 ? (
            <div
              className="tl-panel"
              style={{
                padding: "28px 20px",
                textAlign: "center",
                fontFamily: "Geist Mono",
                fontSize: 13,
                color: "var(--tl-fg-3)",
                letterSpacing: "0.04em",
                display: "flex", flexWrap: "wrap", justifyContent: "center",
                alignItems: "center", gap: 14,
              }}
            >
              <span>
                {language === "vi"
                  ? "Không có trận nào đang phát — quay lại vào ngày thi đấu."
                  : "No matches streaming right now. Check back during match days."}
              </span>
              <Link to="/live" className="tl-btn" style={{ fontSize: 13 }}>
                {language === "vi" ? "Xem tất cả sân →" : "Browse all courts →"}
              </Link>
            </div>
          ) : (
            <div className="tl-match-grid">
              {liveStreams.slice(0, 9).map((stream) => (
                <Link key={stream.id} to={`/live/${stream.id}`} className="tl-match">
                  <div className="tl-match-head">
                    <span className="stat live">Live</span>
                    <span className="ctx">
                      {stream.started_at ? formatTime(stream.started_at) : "On air"}
                    </span>
                  </div>
                  <h3 className="tl-match-title">{stream.title ?? "Untitled match"}</h3>
                  <div className="tl-match-foot">
                    <span className="org">{stream.organization?.name ?? "Broadcast"}</span>
                    <span className="v">Watch →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Schedule — hide entire section when both panels empty */}
      {(upcomingTournaments.length > 0 || scheduledStreams.length > 0) && (
      <section className="tl-section">
        <div className="tl-shell">
          <div className="tl-sec-head">
            <h2>
              Coming <em className="tl-serif">up.</em>{" "}
              <span className="sans">
                {upcomingTournaments.length + scheduledStreams.length} events
              </span>
            </h2>
            <p>Tournaments opening registration and scheduled streams from the next 30 days.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 20 }} className="tl-schedule-grid">
            {upcomingTournaments.length > 0 && (
            <div className="tl-panel">
              <div className="tl-panel-head">
                <h3>Tournaments</h3>
                <span className="meta">{upcomingTournaments.length} upcoming</span>
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
                          <span>Status: {tourn.status}</span>
                          {tourn.end_date && (
                            <>
                              <span className="sep">·</span>
                              <span>Ends {endDate.d} {endDate.m}</span>
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
                <h3>Streams</h3>
                <span className="meta">{scheduledStreams.length} scheduled</span>
              </div>
              {scheduledLoading ? (
                <div className="tl-lc-empty" style={{ padding: "32px 20px" }}>Loading…</div>
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
                        <h4>{stream.title ?? "Upcoming stream"}</h4>
                        <div className="meta">
                          <span>{formatTime(stream.scheduled_start_at)}</span>
                          <span className="sep">·</span>
                          <span>{stream.organization?.name ?? "Broadcast"}</span>
                          <span className="sep">·</span>
                          <Countdown to={stream.scheduled_start_at} pastLabel="Live now" />
                        </div>
                      </div>
                      <div className="tl-sched-right">
                        <span className="tag">Stream</span>
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
                <em className="tl-serif">Courtside.</em>{" "}
                <span className="sans">{videos.length} highlights</span>
              </h2>
              <p>Match highlights, interviews, and behind-the-scenes from the court.</p>
            </div>

            <div className="tl-courtside-grid">
              {videos.slice(0, 3).map((v) => (
                <Link key={v.id} to={`/watch/${v.id}`} className="tl-video-card">
                  <div className="tl-video-thumb">
                    {v.thumbnail_url ? <img src={v.thumbnail_url} alt={v.title} loading="lazy" /> : null}
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
                          <span>{formatRelative(v.published_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div style={{ textAlign: "center", marginTop: 28 }}>
              <Link to="/videos" className="tl-btn">View all videos →</Link>
            </div>
          </div>
        </section>
      )}

      {/* Stories (blog) — editorial image card grid, language-aware */}
      {stories.length > 0 && (
        <section className="tl-section">
          <div className="tl-shell">
            <div className="tl-sec-head">
              <h2>
                From <em className="tl-serif">the desk.</em>{" "}
                <span className="sans">{stories.length} stories</span>
              </h2>
              <p>Longform coverage written by reporters and coaches. Updated regularly.</p>
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
                ? "Tin tức, kết quả giải đấu, và phóng sự độc quyền — gửi hàng tuần. Không quảng cáo, không spam."
                : "Pickleball news, tournament results, and exclusive reporting — delivered weekly. No ads, no spam."}
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

      {/* Manifesto — bilingual. Preserves italic serif emphasis structure
          in both languages (line breaks anchor the editorial typography). */}
      <section className="tl-manifesto">
        <div className="tl-shell">
          <div className="tl-manifesto-inner">
            {language === "vi" ? (
              <>
                <div className="num tl-mono">/ 04 — Tinh thần của chúng tôi</div>
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
                <div className="num tl-mono">/ 04 — What we believe</div>
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
    </TheLineLayout>
  );
};

export default TheLine;

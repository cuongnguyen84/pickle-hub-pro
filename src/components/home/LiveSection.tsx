import { Link } from "react-router-dom";
import { lazy, Suspense, useState } from "react";
import type { Livestream } from "@/hooks/useSupabaseData";
import { Countdown } from "@/components/Countdown";
import { homepageThumbnailUrl } from "@/lib/image-utils";

// Lazy so the video vendor chunk (~1MB) only loads when a court is actually
// live and the inline player renders — never on a homepage with no live.
const HomeLivePlayer = lazy(() => import("./HomeLivePlayer"));

interface LiveSectionProps {
  liveStreams: Livestream[];
  scheduledStreams?: Livestream[];
  /** Luồng vừa kết thúc (Index đã lọc ≤7 ngày) — hiện dạng replay rows. */
  endedStreams?: Livestream[];
  language: "en" | "vi";
  /** True when live/upcoming makes this the first feed section. */
  priority?: boolean;
}

/**
 * Home "ĐANG TRỰC TIẾP" priority block. Appears after the synchronous
 * editorial anchor when at least one court is live OR a broadcast is scheduled.
 *
 * Layout (2026-07 redesign): only the FIRST stream (live first, else the
 * soonest scheduled) gets the full hero card — split thumb/body on desktop
 * so it stops eating a whole viewport. Every other stream (remaining live
 * courts + the upcoming schedule) collapses into a dense schedule list with
 * time + countdown, so many streams no longer stack full-height down the
 * homepage. Scheduled streams stay visible below a live broadcast so the
 * upcoming lineup is always readable.
 */
const streamThumb = (
  s: Livestream,
  size: { width: number; height: number; fit?: "cover" | "contain" },
): string | undefined =>
  homepageThumbnailUrl(
    s.thumbnail_url
      ?? (s.mux_playback_id
        ? `https://image.mux.com/${s.mux_playback_id}/thumbnail.jpg`
        : null),
    size,
  );

const formatTime = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** "21:00 · 8/7" — compact local time for the schedule rows. */
const rowTime = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  const hm = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${hm} · ${dt.getDate()}/${dt.getMonth() + 1}`;
};

const MAX_ROWS = 5;

// CLS INC3 (proposal cls-attribution): Index renders this while the live
// queries resolve and the previous navigation said live leads the page —
// the hero section inserting itself after data arrived was the home page's
// main layout shift. Same section/head/media classes as the real render,
// so geometry (incl. the 16/9 media box) is reserved, not approximated.
/**
 * Reserves the geometry of a loaded LiveSection, not a token of it.
 *
 * Measured on production /vi at 390px on 2026-08-25: this skeleton was 319px
 * while the section it stands in for resolved to 598px. The 279px it did not
 * reserve pushed the entire page below it down on resolve — one 0.208 layout
 * shift, which a throttled Chrome trace showed was the whole of the VI home
 * page's measurable CLS (0.2238 total, of which the ticker is 0.0002).
 *
 * The earlier version reserved a bare head plus one 16/9 media box. Three
 * things were missing and all three are height: the head's "see all" link
 * (min-height 44px), the main card's body under the thumb (130px), and the
 * schedule list (85px). It also used .tl-live-main-media (aspect-ratio 16/9)
 * where a loaded card uses .tl-live-main-thumb (16/10), so even the part it
 * did reserve was the wrong size.
 *
 * Every box below therefore carries the loaded element's own class, so its
 * height is computed by the same CSS that lays out the real thing and cannot
 * drift when the section is restyled. Do not give this component heights of
 * its own — that is the failure mode it exists to avoid. Same rule as the
 * /news and /san skeletons; see src/pages/__tests__/hub-list-cls.test.ts.
 *
 * It reserves the common shape: one featured stream plus one schedule row.
 * A quieter week resolves shorter and collapses a little, which is the trade
 * src/lib/home-live-lead.ts already documents and accepts.
 */
export function LiveSectionSkeleton() {
  return (
    <section className="tl-section tl-live-sec" aria-hidden="true">
      <div className="tl-shell">
        <div className="tl-live-head">
          <h2 className="tl-live-title">&nbsp;</h2>
          <span className="tl-live-all">&nbsp;</span>
        </div>
        <div className="tl-live-main">
          <div className="tl-live-main-thumb">
            <span className="tl-live-thumb-ph" />
          </div>
          <div className="tl-live-main-body">
            {/* Two lines: .tl-live-main-name is line-clamped to 2 and real
                stream titles wrap to both more often than not. */}
            <div className="tl-live-main-name">&nbsp;<br />&nbsp;</div>
            <div className="tl-live-meta">&nbsp;</div>
          </div>
        </div>
        <div className="tl-live-list">
          <div className="tl-live-row">
            <div className="tl-live-row-thumb" />
            <div>
              <div className="tl-live-row-name">&nbsp;</div>
              <div className="tl-live-row-meta">&nbsp;</div>
            </div>
            <div className="tl-live-row-when">&nbsp;</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LiveSection({ liveStreams, scheduledStreams = [], endedStreams = [], language, priority = false }: LiveSectionProps) {
  const [inlinePlaybackRequested, setInlinePlaybackRequested] = useState(false);
  const isLive = liveStreams.length > 0;
  // Live courts first, then the schedule soonest-first — one merged lineup
  // so the schedule stays visible even while something is on air.
  const upcoming = [...scheduledStreams].sort((a, b) => {
    const aT = a.scheduled_start_at ? new Date(a.scheduled_start_at).getTime() : Infinity;
    const bT = b.scheduled_start_at ? new Date(b.scheduled_start_at).getTime() : Infinity;
    return aT - bT;
  });
  const streams = [...liveStreams, ...upcoming];
  if (streams.length === 0 && endedStreams.length === 0) return null;

  const [main, ...restAll] = streams;
  const rest = restAll.slice(0, MAX_ROWS);
  const overflow = restAll.length - rest.length;
  // The hero renders at ~374px on mobile and at most ~768px in the feed.
  // Asking Google Drive for 1280x720 transferred a 1.3MB image even while the
  // section was below the fold; the 768px derivative remains sharp at 2x DPR.
  const mainThumb = main
    ? streamThumb(main, { width: 768, height: 432, fit: "contain" })
    : undefined;
  const mainIsLive = main?.status === "live";
  const fallbackTitle = isLive
    ? (language === "vi" ? "Trận đang trực tiếp" : "Live match")
    : (language === "vi" ? "Stream sắp tới" : "Upcoming stream");
  const mainTitle = main?.title ?? fallbackTitle;
  const broadcastLabel = language === "vi" ? "Phát sóng" : "Broadcast";
  const upcomingBadge = language === "vi" ? "SẮP PHÁT" : "UPCOMING";
  const headTitle = isLive
    ? (language === "vi" ? "Đang trực tiếp" : "Live now")
    : streams.length > 0
      ? (language === "vi" ? "Sắp phát sóng" : "Upcoming broadcast")
      : (language === "vi" ? "Vừa phát sóng" : "Recently live");

  return (
    <section className="tl-section tl-live-sec tl-deferred-section" aria-labelledby="home-live-heading">
      <div className="tl-shell">
        <div className="tl-live-head">
          <h2 id="home-live-heading" className="tl-live-title">
            {isLive && <span className="tl-live-dot" aria-hidden="true" />}
            {headTitle}
            {liveStreams.length > 1 && (
              <span className="tl-live-count">
                {liveStreams.length} {language === "vi" ? "sân" : "courts"}
              </span>
            )}
          </h2>
          <Link to="/live" className="tl-live-all">
            {language === "vi" ? "Xem tất cả →" : "See all →"}
          </Link>
        </div>

        {main && (mainIsLive && main.mux_playback_id ? (
          // Live: embed the actual player inline (same gate/geo as /live), not
          // a thumbnail. Body still links to the full page for chat etc.
          <div className="tl-live-main tl-live-main--live">
            <div className="tl-live-main-media">
              {inlinePlaybackRequested ? (
                <Suspense fallback={<div className="tl-live-thumb-ph" aria-hidden="true" />}>
                  <HomeLivePlayer stream={main} />
                </Suspense>
              ) : (
                <button
                  type="button"
                  className="tl-live-inline-start"
                  onClick={() => setInlinePlaybackRequested(true)}
                  aria-label={language === "vi" ? `Phát ${mainTitle}` : `Play ${mainTitle}`}
                >
                  {mainThumb ? (
                    <img
                      src={mainThumb}
                      alt=""
                      width={768}
                      height={432}
                      loading={priority ? "eager" : "lazy"}
                      fetchPriority={priority ? "high" : "low"}
                      decoding="async"
                    />
                  ) : (
                    <span className="tl-live-thumb-ph" aria-hidden="true" />
                  )}
                  <span className="tl-live-start-icon" aria-hidden="true">▶</span>
                  <span className="tl-live-badge">LIVE</span>
                </button>
              )}
            </div>
            <div className="tl-live-main-body">
              <Link to={`/live/${main.id}`} className="tl-live-main-name-link">
                <h3 className="tl-live-main-name">{mainTitle}</h3>
              </Link>
              <div className="tl-live-meta">
                <span>{main.organization?.name ?? broadcastLabel}</span>
                <span className="sep" aria-hidden="true">·</span>
                <span>{language === "vi" ? "Đang phát" : "On air"}</span>
              </div>
              <Link to={`/live/${main.id}`} className="tl-live-expand">
                {language === "vi" ? "Mở trang xem đầy đủ →" : "Open full page →"}
              </Link>
            </div>
          </div>
        ) : (
          <Link to={`/live/${main.id}`} className="tl-live-main">
            <div className="tl-live-main-thumb">
              {mainThumb ? (
                <img
                  src={mainThumb}
                  alt=""
                  width={768}
                  height={432}
                  loading={priority ? "eager" : "lazy"}
                  fetchPriority={priority ? "high" : "low"}
                  decoding="async"
                />
              ) : (
                <div className="tl-live-thumb-ph" aria-hidden="true" />
              )}
              <span className="tl-live-badge">{mainIsLive ? "LIVE" : upcomingBadge}</span>
            </div>
            <div className="tl-live-main-body">
              <h3 className="tl-live-main-name">{mainTitle}</h3>
              <div className="tl-live-meta">
                <span>{main.organization?.name ?? broadcastLabel}</span>
                <span className="sep" aria-hidden="true">·</span>
                {mainIsLive ? (
                  <span>{language === "vi" ? "Đang phát" : "On air"}</span>
                ) : (
                  <>
                    <span>{formatTime(main.scheduled_start_at)}</span>
                    <span className="sep" aria-hidden="true">·</span>
                    <Countdown
                      to={main.scheduled_start_at}
                      pastLabel={language === "vi" ? "Đang phát" : "Live now"}
                      language={language}
                    />
                  </>
                )}
              </div>
            </div>
          </Link>
        ))}

        {(rest.length > 0 || endedStreams.length > 0) && (
          <div
            className="tl-live-list"
            role="list"
            aria-label={language === "vi" ? "Các luồng khác" : "Other streams"}
          >
            {rest.map((stream) => {
              const thumb = streamThumb(stream, { width: 224, height: 126 });
              const title = stream.title ?? fallbackTitle;
              const rowIsLive = stream.status === "live";
              return (
                <Link
                  key={stream.id}
                  to={`/live/${stream.id}`}
                  className="tl-live-row"
                  role="listitem"
                >
                  <div className="tl-live-row-thumb">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        width={224}
                        height={126}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="tl-live-thumb-ph" aria-hidden="true" />
                    )}
                    {rowIsLive && <span className="tl-live-badge sm">LIVE</span>}
                  </div>
                  <div className="tl-live-row-body">
                    <div className="tl-live-row-name">{title}</div>
                    <div className="tl-live-row-meta">
                      {stream.organization?.name ?? broadcastLabel}
                    </div>
                  </div>
                  <div className={`tl-live-row-when${rowIsLive ? " is-live" : ""}`}>
                    {rowIsLive ? (
                      <span>{language === "vi" ? "ĐANG PHÁT" : "ON AIR"}</span>
                    ) : (
                      <>
                        <span className="t">{rowTime(stream.scheduled_start_at)}</span>
                        <Countdown
                          to={stream.scheduled_start_at}
                          pastLabel={language === "vi" ? "Đang phát" : "Live now"}
                          language={language}
                          className="cd"
                        />
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
            {/* Vừa kết thúc (≤7 ngày) — chung list, nhận diện bằng chip
                "XEM LẠI" highlight thay vì heading riêng chiếm chỗ. */}
            {endedStreams.map((stream) => {
              const thumb = streamThumb(stream, { width: 224, height: 126 });
              const title = stream.title ?? (language === "vi" ? "Buổi phát sóng" : "Broadcast");
              return (
                <Link
                  key={stream.id}
                  to={`/live/${stream.id}`}
                  className="tl-live-row"
                  role="listitem"
                >
                  <div className="tl-live-row-thumb">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        width={224}
                        height={126}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="tl-live-thumb-ph" aria-hidden="true" />
                    )}
                  </div>
                  <div className="tl-live-row-body">
                    <div className="tl-live-row-name">{title}</div>
                    <div className="tl-live-row-meta">
                      {stream.organization?.name ?? broadcastLabel}
                    </div>
                  </div>
                  <div className="tl-live-row-when">
                    <span className="t">{rowTime(stream.ended_at)}</span>
                    <span
                      className="cd"
                      style={{
                        color: "var(--tl-bg)",
                        background: "var(--tl-green)",
                        borderRadius: 4,
                        padding: "2px 6px",
                        fontWeight: 700,
                      }}
                    >
                      {language === "vi" ? "XEM LẠI" : "REPLAY"}
                    </span>
                  </div>
                </Link>
              );
            })}
            {overflow > 0 && (
              <Link to="/live" className="tl-live-row tl-live-row-more" role="listitem">
                <span className="tl-live-row-name">
                  {language === "vi" ? `+${overflow} luồng khác →` : `+${overflow} more streams →`}
                </span>
              </Link>
            )}
          </div>
        )}

      </div>
    </section>
  );
}

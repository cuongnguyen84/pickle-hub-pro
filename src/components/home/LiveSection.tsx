import { Link } from "react-router-dom";
import type { Livestream } from "@/hooks/useSupabaseData";
import { Countdown } from "@/pages/preview/_Countdown";

interface LiveSectionProps {
  liveStreams: Livestream[];
  scheduledStreams?: Livestream[];
  language: "en" | "vi";
}

/**
 * Home "ĐANG TRỰC TIẾP" priority block. Leads the home feed cluster when
 * at least one court is live OR a broadcast is scheduled.
 *
 * Layout (2026-07 redesign): only the FIRST stream (live first, else the
 * soonest scheduled) gets the full hero card — split thumb/body on desktop
 * so it stops eating a whole viewport. Every other stream (remaining live
 * courts + the upcoming schedule) collapses into a dense schedule list with
 * time + countdown, so many streams no longer stack full-height down the
 * homepage. Scheduled streams stay visible below a live broadcast so the
 * upcoming lineup is always readable.
 */
const streamThumb = (s: Livestream): string | null =>
  s.thumbnail_url
  ?? (s.mux_playback_id
    ? `https://image.mux.com/${s.mux_playback_id}/thumbnail.jpg?width=1280&height=720&fit_mode=smartcrop`
    : null);

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

export function LiveSection({ liveStreams, scheduledStreams = [], language }: LiveSectionProps) {
  const isLive = liveStreams.length > 0;
  // Live courts first, then the schedule soonest-first — one merged lineup
  // so the schedule stays visible even while something is on air.
  const upcoming = [...scheduledStreams].sort((a, b) => {
    const aT = a.scheduled_start_at ? new Date(a.scheduled_start_at).getTime() : Infinity;
    const bT = b.scheduled_start_at ? new Date(b.scheduled_start_at).getTime() : Infinity;
    return aT - bT;
  });
  const streams = [...liveStreams, ...upcoming];
  if (streams.length === 0) return null;

  const [main, ...restAll] = streams;
  const rest = restAll.slice(0, MAX_ROWS);
  const overflow = restAll.length - rest.length;
  const mainThumb = streamThumb(main);
  const mainIsLive = main.status === "live";
  const fallbackTitle = isLive
    ? (language === "vi" ? "Trận đang trực tiếp" : "Live match")
    : (language === "vi" ? "Stream sắp tới" : "Upcoming stream");
  const mainTitle = main.title ?? fallbackTitle;
  const broadcastLabel = language === "vi" ? "Phát sóng" : "Broadcast";
  const upcomingBadge = language === "vi" ? "SẮP PHÁT" : "UPCOMING";

  return (
    <section className="tl-section tl-live-sec" aria-labelledby="home-live-heading">
      <div className="tl-shell">
        <div className="tl-live-head">
          <h2 id="home-live-heading" className="tl-live-title">
            {isLive && <span className="tl-live-dot" aria-hidden="true" />}
            {isLive
              ? (language === "vi" ? "Đang trực tiếp" : "Live now")
              : (language === "vi" ? "Sắp phát sóng" : "Upcoming broadcast")}
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

        <Link to={`/live/${main.id}`} className="tl-live-main">
          <div className="tl-live-main-thumb">
            {mainThumb ? (
              <img src={mainThumb} alt={mainTitle} loading="lazy" />
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

        {rest.length > 0 && (
          <div
            className="tl-live-list"
            role="list"
            aria-label={language === "vi" ? "Các luồng khác" : "Other streams"}
          >
            {rest.map((stream) => {
              const thumb = streamThumb(stream);
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
                      <img src={thumb} alt={title} loading="lazy" />
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

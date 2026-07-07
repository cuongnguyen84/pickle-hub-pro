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
 * at least one court is live, OR when a broadcast is scheduled — a
 * scheduled stream renders the same hero layout with an UPCOMING badge
 * and a countdown instead of the LIVE badge (2026-07 request: scheduled
 * streams must always surface at the top of the homepage).
 *
 * Layout: a hero card for the first stream + a horizontal snap rail
 * for the rest. The public_livestreams view exposes no viewer count or
 * live score, so the card intentionally shows only what we actually have
 * (title + organiser) rather than fabricating those figures.
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

export function LiveSection({ liveStreams, scheduledStreams = [], language }: LiveSectionProps) {
  const isLive = liveStreams.length > 0;
  const streams = isLive ? liveStreams : scheduledStreams;
  if (streams.length === 0) return null;

  const [main, ...rest] = streams;
  const mainThumb = streamThumb(main);
  const fallbackTitle = isLive
    ? (language === "vi" ? "Trận đang trực tiếp" : "Live match")
    : (language === "vi" ? "Stream sắp tới" : "Upcoming stream");
  const mainTitle = main.title ?? fallbackTitle;
  const broadcastLabel = language === "vi" ? "Phát sóng" : "Broadcast";
  const badgeLabel = isLive ? "LIVE" : (language === "vi" ? "SẮP PHÁT" : "UPCOMING");

  return (
    <section className="tl-section tl-live-sec" aria-labelledby="home-live-heading">
      <div className="tl-shell">
        <div className="tl-live-head">
          <h2 id="home-live-heading" className="tl-live-title">
            {isLive && <span className="tl-live-dot" aria-hidden="true" />}
            {isLive
              ? (language === "vi" ? "Đang trực tiếp" : "Live now")
              : (language === "vi" ? "Sắp phát sóng" : "Upcoming broadcast")}
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
            <span className="tl-live-badge">{badgeLabel}</span>
          </div>
          <div className="tl-live-main-body">
            <h3 className="tl-live-main-name">{mainTitle}</h3>
            <div className="tl-live-meta">
              <span>{main.organization?.name ?? broadcastLabel}</span>
              <span className="sep" aria-hidden="true">·</span>
              {isLive ? (
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
            className="tl-live-rail"
            role="list"
            aria-label={
              isLive
                ? (language === "vi" ? "Các sân đang trực tiếp khác" : "Other live courts")
                : (language === "vi" ? "Các stream sắp tới khác" : "Other upcoming streams")
            }
          >
            {rest.map((stream) => {
              const thumb = streamThumb(stream);
              const title = stream.title ?? fallbackTitle;
              return (
                <Link
                  key={stream.id}
                  to={`/live/${stream.id}`}
                  className="tl-live-rail-item"
                  role="listitem"
                >
                  <div className="tl-live-rail-thumb">
                    {thumb ? (
                      <img src={thumb} alt={title} loading="lazy" />
                    ) : (
                      <div className="tl-live-thumb-ph" aria-hidden="true" />
                    )}
                    <span className="tl-live-badge sm">{badgeLabel}</span>
                  </div>
                  <div className="tl-live-rail-name">{title}</div>
                  <div className="tl-live-rail-meta">
                    {isLive
                      ? (stream.organization?.name ?? broadcastLabel)
                      : (formatTime(stream.scheduled_start_at) || (stream.organization?.name ?? broadcastLabel))}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

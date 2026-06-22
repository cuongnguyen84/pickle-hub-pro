import { Link } from "react-router-dom";
import type { Livestream } from "@/hooks/useSupabaseData";

interface LiveSectionProps {
  liveStreams: Livestream[];
  language: "en" | "vi";
}

/**
 * Home "ĐANG TRỰC TIẾP" priority block. Renders only while at least one
 * court is live (caller gates on liveStreams.length); when present it
 * leads the home feed cluster and pushes the editorial feature down.
 *
 * Layout: a hero card for the first live stream + a horizontal snap rail
 * for the rest. The public_livestreams view exposes no viewer count or
 * live score, so the card intentionally shows only what we actually have
 * (title + organiser) rather than fabricating those figures.
 */
const streamThumb = (s: Livestream): string | null =>
  s.thumbnail_url
  ?? (s.mux_playback_id
    ? `https://image.mux.com/${s.mux_playback_id}/thumbnail.jpg?width=1280&height=720&fit_mode=smartcrop`
    : null);

export function LiveSection({ liveStreams, language }: LiveSectionProps) {
  if (liveStreams.length === 0) return null;

  const [main, ...rest] = liveStreams;
  const mainThumb = streamThumb(main);
  const mainTitle =
    main.title ?? (language === "vi" ? "Trận đang trực tiếp" : "Live match");
  const broadcastLabel = language === "vi" ? "Phát sóng" : "Broadcast";
  const onAirLabel = language === "vi" ? "Đang phát" : "On air";

  return (
    <section className="tl-section tl-live-sec" aria-labelledby="home-live-heading">
      <div className="tl-shell">
        <div className="tl-live-head">
          <h2 id="home-live-heading" className="tl-live-title">
            <span className="tl-live-dot" aria-hidden="true" />
            {language === "vi" ? "Đang trực tiếp" : "Live now"}
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
            <span className="tl-live-badge">LIVE</span>
          </div>
          <div className="tl-live-main-body">
            <h3 className="tl-live-main-name">{mainTitle}</h3>
            <div className="tl-live-meta">
              <span>{main.organization?.name ?? broadcastLabel}</span>
              <span className="sep" aria-hidden="true">·</span>
              <span>{onAirLabel}</span>
            </div>
          </div>
        </Link>

        {rest.length > 0 && (
          <div
            className="tl-live-rail"
            role="list"
            aria-label={language === "vi" ? "Các sân đang trực tiếp khác" : "Other live courts"}
          >
            {rest.map((stream) => {
              const thumb = streamThumb(stream);
              const title =
                stream.title
                ?? (language === "vi" ? "Trận đang trực tiếp" : "Live match");
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
                    <span className="tl-live-badge sm">LIVE</span>
                  </div>
                  <div className="tl-live-rail-name">{title}</div>
                  <div className="tl-live-rail-meta">
                    {stream.organization?.name ?? broadcastLabel}
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

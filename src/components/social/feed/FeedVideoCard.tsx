import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import {
  type Language,
  formatMatchWhen,
} from "@/lib/social/feed-formatters";

interface FeedVideoCardProps {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  video_type: "short" | "long";
  published_at: string;
  language: Language;
  staggerIndex?: number;
}

/**
 * Sprint 7 — video card slotted into the /feed timeline. Same chrome as
 * FeedMatchCard / FeedBlogCard (eyebrow strip + hairline divider + stagger
 * reveal). Body switches aspect:
 *   - long  → 16:9 thumbnail above title
 *   - short → 9:16 thumbnail right-of-text
 *
 * Routes to /watch/<id> on the main route; the bilingual /vi/watch wrapper
 * renders the same WatchVideo component, so we don't fork the link by
 * viewer language.
 */
export function FeedVideoCard({
  id,
  title,
  description,
  thumbnail_url,
  duration_seconds,
  video_type,
  published_at,
  language,
  staggerIndex,
}: FeedVideoCardProps) {
  const animDelay =
    staggerIndex != null && staggerIndex >= 0 && staggerIndex < 6
      ? `${staggerIndex * 80}ms`
      : "0ms";

  const isShort = video_type === "short";
  const kindLabel = isShort
    ? language === "vi"
      ? "VIDEO NGẮN"
      : "SHORT"
    : "VIDEO";
  const durationLabel = formatDuration(duration_seconds);

  return (
    <Link
      to={`/watch/${id}`}
      role="article"
      aria-label={title}
      className="tl-feed-card"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 18,
        padding: "32px 0",
        borderBottom: "1px solid var(--tl-border)",
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
        position: "relative",
        opacity: 0,
        transform: "translateY(8px)",
        animation: `tl-feed-card-in 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) ${animDelay} forwards`,
      }}
    >
      {/* Eyebrow strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: "'Geist Mono', monospace",
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--tl-fg-3)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "var(--tl-fg-3)",
            }}
          />
          <span style={{ color: "var(--tl-fg-2)" }}>
            {formatMatchWhen(published_at, language, "desktop")}
          </span>
          {durationLabel && (
            <>
              <span style={{ color: "var(--tl-fg-4)" }}>·</span>
              <span>{durationLabel}</span>
            </>
          )}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <KindBadge label={kindLabel} />
        </div>
      </div>

      {/* Body — different grid for short vs long */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isShort ? "1fr 140px" : "1fr",
          gap: isShort ? 24 : 18,
          alignItems: isShort ? "start" : "stretch",
        }}
        className="tl-feed-video-body"
      >
        {!isShort && (
          <Thumbnail
            url={thumbnail_url}
            aspect="16 / 9"
            durationLabel={durationLabel}
          />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h3
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontSize: isShort ? 26 : 30,
              lineHeight: 1.1,
              letterSpacing: "-0.015em",
              color: "var(--tl-fg)",
              margin: 0,
            }}
          >
            {title}
          </h3>
          {description && (
            <p
              style={{
                fontSize: 14.5,
                lineHeight: 1.5,
                color: "var(--tl-fg-2)",
                margin: 0,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {description}
            </p>
          )}
        </div>
        {isShort && (
          <Thumbnail
            url={thumbnail_url}
            aspect="9 / 16"
            durationLabel={durationLabel}
          />
        )}
      </div>
    </Link>
  );
}

function Thumbnail({
  url,
  aspect,
  durationLabel,
}: {
  url: string | null;
  aspect: string;
  durationLabel: string | null;
}) {
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: aspect,
        overflow: "hidden",
        background: "var(--tl-bg-2, rgba(255,255,255,0.04))",
        border: "1px solid var(--tl-border)",
        position: "relative",
      }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "var(--tl-fg-3)",
            fontFamily: "'Geist Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.12em",
          }}
        >
          NO THUMBNAIL
        </div>
      )}
      {/* Play glyph overlay — centered, low-opacity so the thumbnail
          stays readable but the affordance is unmistakable. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.35) 100%)",
        }}
      >
        <span
          style={{
            display: "inline-grid",
            placeItems: "center",
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.55)",
            border: "1px solid rgba(255,255,255,0.5)",
            color: "white",
          }}
        >
          <Play
            style={{ width: 18, height: 18, marginLeft: 2 }}
            strokeWidth={1.75}
            fill="currentColor"
          />
        </span>
      </div>
      {durationLabel && (
        <span
          style={{
            position: "absolute",
            right: 8,
            bottom: 8,
            fontFamily: "'Geist Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.08em",
            color: "white",
            background: "rgba(0,0,0,0.7)",
            padding: "3px 6px",
            borderRadius: 2,
          }}
        >
          {durationLabel}
        </span>
      )}
    </div>
  );
}

function KindBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "'Geist Mono', monospace",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        padding: "4px 9px",
        borderRadius: 2,
        border: "1px solid var(--tl-border)",
        color: "var(--tl-fg-2)",
      }}
    >
      {label}
    </span>
  );
}

function formatDuration(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

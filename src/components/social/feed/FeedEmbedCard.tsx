import {
  type Language,
  formatMatchWhen,
} from "@/lib/social/feed-formatters";

/**
 * Instagram reel card for /feed Trending — v1.1 of the embed feature.
 *
 * Renders Instagram's official /embed/ iframe endpoint, which shows the
 * clip thumbnail + play button and opens instagram.com on interaction.
 * No API key needed, nothing re-hosted (copyright/ToS safe by design),
 * and IG serves fresh CDN URLs each load so thumbnails never go stale.
 * instagram.com is allowlisted in frame-src (public/_headers +
 * functions/_middleware.ts) — remove there too if this card ever dies.
 *
 * URLs whose shortcode can't be parsed fall back to a plain out-link row.
 */
interface FeedEmbedCardProps {
  url: string;
  caption: string | null;
  author_name: string | null;
  thumbnail_url: string | null;
  language: Language;
  published_at: string;
  staggerIndex?: number;
}

/** instagram.com/reel/<code>/, /p/<code>/, /tv/<code>/ → embed URL. */
function toEmbedUrl(url: string): string | null {
  const m = url.match(
    /instagram\.com\/(reels?|p|tv)\/([A-Za-z0-9_-]+)/
  );
  if (!m) return null;
  const kind = m[1] === "reels" ? "reel" : m[1];
  return `https://www.instagram.com/${kind}/${m[2]}/embed/`;
}

export function FeedEmbedCard({
  url,
  caption,
  author_name,
  language,
  published_at,
  staggerIndex,
}: FeedEmbedCardProps) {
  const animDelay =
    staggerIndex != null && staggerIndex >= 0 && staggerIndex < 6
      ? `${staggerIndex * 80}ms`
      : "0ms";

  const embedUrl = toEmbedUrl(url);
  const title =
    caption ||
    (language === "vi"
      ? "Video pickleball trên Instagram"
      : "Pickleball video on Instagram");

  return (
    <div
      role="article"
      aria-label={title}
      className="tl-feed-card"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 18,
        padding: "32px 0",
        borderBottom: "1px solid var(--tl-border)",
        position: "relative",
        opacity: 0,
        transform: "translateY(8px)",
        animation: `tl-feed-card-in 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) ${animDelay} forwards`,
      }}
    >
      {/* Eyebrow — date · @author · REEL badge */}
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
          {author_name && (
            <>
              <span style={{ color: "var(--tl-fg-4)" }}>·</span>
              <span>@{author_name.replace(/^@/, "")}</span>
            </>
          )}
        </div>
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
          ▶ REEL · INSTAGRAM
        </span>
      </div>

      {/* Caption */}
      {caption && (
        <h3
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: "italic",
            fontSize: 24,
            lineHeight: 1.15,
            letterSpacing: "-0.015em",
            color: "var(--tl-fg)",
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {caption}
        </h3>
      )}

      {/* Clip — official IG embed iframe (thumbnail + play, tap → instagram) */}
      {embedUrl && (
        <iframe
          src={embedUrl}
          title={title}
          loading="lazy"
          scrolling="no"
          allow="encrypted-media"
          style={{
            width: "100%",
            maxWidth: 400,
            height: 480,
            border: "1px solid var(--tl-border)",
            borderRadius: 4,
            background: "var(--tl-bg-elev, rgba(255,255,255,0.04))",
            justifySelf: "center",
          }}
        />
      )}

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 13,
          color: "var(--tl-fg-3)",
          textDecoration: "none",
          justifySelf: embedUrl ? "center" : "start",
        }}
      >
        {language === "vi" ? "Mở trên Instagram ↗" : "Open on Instagram ↗"}
      </a>
    </div>
  );
}

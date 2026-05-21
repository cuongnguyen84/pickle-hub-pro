import { Link } from "react-router-dom";
import {
  type Language,
  formatMatchWhen,
} from "@/lib/social/feed-formatters";

/**
 * News card for /feed Trending — phase 4 follow-up.
 *
 * Visual chrome cloned from FeedBlogCard so the timeline stays one
 * editorial stream (Anh said "don't design from scratch"). Differences
 * vs FeedBlogCard:
 *   - Eyebrow shows source name (e.g. "PPA Tour") instead of category.
 *   - "TIN" / "NEWS" kind badge.
 *   - Optional "AI TRANSLATED" chip when the VI row was machine-rewritten
 *     from an EN source (transparency for readers).
 *   - Link target is /news/:slug (or /vi/news/:slug) — the per-article
 *     SEO page added in Phase 4, which itself out-links to the source.
 */
interface FeedNewsCardProps {
  slug: string;
  title: string;
  summary: string;
  image_url: string | null;
  source: string | null;
  /** "vi" → /vi/news/<slug>, "en" → /news/<slug>. */
  lang: "vi" | "en";
  language: Language;
  published_at: string;
  aiTranslated: boolean;
  staggerIndex?: number;
}

export function FeedNewsCard({
  slug,
  title,
  summary,
  image_url,
  source,
  lang,
  language,
  published_at,
  aiTranslated,
  staggerIndex,
}: FeedNewsCardProps) {
  const href = lang === "vi" ? `/vi/news/${slug}` : `/news/${slug}`;
  const animDelay =
    staggerIndex != null && staggerIndex >= 0 && staggerIndex < 6
      ? `${staggerIndex * 80}ms`
      : "0ms";

  const newsLabel = language === "vi" ? "TIN" : "NEWS";
  const langChip = lang === "en" ? "EN" : "VI";

  return (
    <Link
      to={href}
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
      {/* Eyebrow — date · source · NEWS tag · lang chip · AI badge */}
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
          {source && (
            <>
              <span style={{ color: "var(--tl-fg-4)" }}>·</span>
              <span>{source}</span>
            </>
          )}
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {aiTranslated && <AiChip language={language} />}
          <KindBadge label={newsLabel} />
          <LangChip code={langChip} />
        </div>
      </div>

      {/* Body — image + text */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: image_url ? "1fr 160px" : "1fr",
          gap: 24,
          alignItems: "start",
        }}
        className="tl-feed-blog-body"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h3
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontSize: 30,
              lineHeight: 1.1,
              letterSpacing: "-0.015em",
              color: "var(--tl-fg)",
              margin: 0,
            }}
          >
            {title}
          </h3>
          {summary && (
            <p
              style={{
                fontSize: 14.5,
                lineHeight: 1.5,
                color: "var(--tl-fg-2)",
                margin: 0,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {summary}
            </p>
          )}
        </div>
        {image_url && (
          <div
            style={{
              width: "100%",
              aspectRatio: "4 / 3",
              overflow: "hidden",
              background: "var(--tl-bg-2, rgba(255,255,255,0.04))",
              border: "1px solid var(--tl-border)",
            }}
          >
            <img
              src={image_url}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
              onError={(e) => {
                (e.currentTarget.parentElement as HTMLElement).style.display =
                  "none";
              }}
            />
          </div>
        )}
      </div>
    </Link>
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

function LangChip({ code }: { code: "EN" | "VI" }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "'Geist Mono', monospace",
        fontSize: 10,
        letterSpacing: "0.1em",
        padding: "4px 7px",
        borderRadius: 2,
        border: "1px solid var(--tl-border)",
        color: "var(--tl-fg-3)",
      }}
    >
      {code}
    </span>
  );
}

function AiChip({ language }: { language: Language }) {
  return (
    <span
      aria-label={
        language === "vi"
          ? "Bản tiếng Việt do AI dịch lại có biên tập"
          : "AI-translated Vietnamese edition"
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "'Geist Mono', monospace",
        fontSize: 9.5,
        letterSpacing: "0.1em",
        padding: "4px 7px",
        borderRadius: 2,
        background: "color-mix(in srgb, var(--tl-green, #15b886) 18%, transparent)",
        color: "var(--tl-green, #15b886)",
      }}
    >
      ◆ {language === "vi" ? "AI DỊCH" : "AI"}
    </span>
  );
}

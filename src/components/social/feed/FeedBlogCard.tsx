import { Link } from "react-router-dom";
import {
  type Language,
  formatMatchWhen,
} from "@/lib/social/feed-formatters";

interface FeedBlogCardProps {
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category: string | null;
  published_at: string;
  /** 'vi' → /vi/blog/<slug>, 'en' → /blog/<slug>. The merge in
   *  useFeedTimeline tags EN static posts with lang='en'. */
  lang: "vi" | "en";
  language: Language;
  staggerIndex?: number;
}

/**
 * Sprint 7 — blog card slotted into the /feed timeline. Tracks the same
 * eyebrow / hairline divider / stagger-reveal pattern as FeedMatchCard so
 * the three card types feel like one editorial stream rather than three
 * unrelated widgets. Anh said don't design from scratch — this is a
 * deliberate copy of the match card chrome with a blog-specific body.
 *
 * Anatomy:
 *   i.   Eyebrow strip — date · category · "BLOG" tag (with lang chip)
 *   ii.  Title — Instrument Serif, italic for editorial weight
 *   iii. Excerpt — 2-3 lines clamped
 *   iv.  Optional cover image — right column on >=720px, top on mobile
 */
export function FeedBlogCard({
  slug,
  title,
  excerpt,
  cover_image_url,
  category,
  published_at,
  lang,
  language,
  staggerIndex,
}: FeedBlogCardProps) {
  const href = lang === "vi" ? `/vi/blog/${slug}` : `/blog/${slug}`;
  const animDelay =
    staggerIndex != null && staggerIndex >= 0 && staggerIndex < 6
      ? `${staggerIndex * 80}ms`
      : "0ms";

  const blogLabel = language === "vi" ? "BÀI VIẾT" : "BLOG";
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
      {/* Eyebrow strip — date · category · blog tag · lang chip */}
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
          {category && (
            <>
              <span style={{ color: "var(--tl-fg-4)" }}>·</span>
              <span>{category}</span>
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
          <KindBadge label={blogLabel} />
          <LangChip code={langChip} />
        </div>
      </div>

      {/* Body — image + text two-column when image, full-width text when not */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cover_image_url ? "1fr 160px" : "1fr",
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
          {excerpt && (
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
              {excerpt}
            </p>
          )}
        </div>
        {cover_image_url && (
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
              src={cover_image_url}
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
          </div>
        )}
      </div>
    </Link>
  );
}

/* ─── Kind badge — matches the cluster style of FeedMatchCard pills ─── */
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

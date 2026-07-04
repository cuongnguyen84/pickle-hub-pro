import { Link } from "react-router-dom";
import { type Language } from "@/lib/social/feed-formatters";
import { type FeedHighlightItem } from "@/hooks/social/useFeedHighlights";

/**
 * Card for system-generated highlights on /feed Trending (milestones,
 * weekly leaderboard movers, pro tour digests, AI recaps). Same editorial
 * chrome as the other cards; only the kind badge changes. Bodies are
 * pre-rendered bilingual text from the feed-generate cron — multi-line
 * bodies (leaderboard top-5) keep their line breaks.
 */

const KIND_BADGE: Record<FeedHighlightItem["kind"], { vi: string; en: string }> = {
  milestone: { vi: "CỘT MỐC", en: "MILESTONE" },
  leaderboard: { vi: "BXH TUẦN", en: "WEEKLY MOVERS" },
  protour: { vi: "PRO TOUR", en: "PRO TOUR" },
  recap: { vi: "TUẦN QUA", en: "THE WEEK" },
};

interface FeedHighlightCardProps {
  item: FeedHighlightItem;
  language: Language;
  staggerIndex?: number;
}

export function FeedHighlightCard({
  item,
  language,
  staggerIndex,
}: FeedHighlightCardProps) {
  const animDelay =
    staggerIndex != null && staggerIndex >= 0 && staggerIndex < 6
      ? `${staggerIndex * 80}ms`
      : "0ms";
  const badge = KIND_BADGE[item.kind][language === "vi" ? "vi" : "en"];
  const title = language === "vi" ? item.title_vi : item.title_en;
  const body = language === "vi" ? item.body_vi : item.body_en;

  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
          {badge}
        </span>
      </div>

      <h3
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontStyle: "italic",
          fontSize: 26,
          lineHeight: 1.15,
          letterSpacing: "-0.015em",
          color: "var(--tl-fg)",
          margin: 0,
        }}
      >
        {title}
      </h3>

      {body && (
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--tl-fg-2)",
            margin: 0,
            whiteSpace: "pre-line",
          }}
        >
          {body}
        </p>
      )}
    </>
  );

  const style: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 14,
    padding: "32px 0",
    borderBottom: "1px solid var(--tl-border)",
    textDecoration: "none",
    color: "inherit",
    position: "relative",
    opacity: 0,
    transform: "translateY(8px)",
    animation: `tl-feed-card-in 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) ${animDelay} forwards`,
  };

  return item.href ? (
    <Link to={item.href} role="article" aria-label={title} className="tl-feed-card" style={{ ...style, cursor: "pointer" }}>
      {inner}
    </Link>
  ) : (
    <div role="article" aria-label={title} className="tl-feed-card" style={style}>
      {inner}
    </div>
  );
}

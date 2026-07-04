import { Link } from "react-router-dom";
import { type Language } from "@/lib/social/feed-formatters";
import { type FeedHappeningItem } from "@/hooks/social/useFeedHappenings";

/**
 * One card for all three "happening" kinds on /feed Trending — live
 * streams, open-registration tournaments, upcoming social events. Same
 * editorial chrome as the other feed cards; only the badge and accent
 * change per kind. Kept to a single component because the three differ
 * by exactly (badge text, color, meta line).
 */

const KIND_STYLE: Record<
  FeedHappeningItem["kind"],
  { vi: string; en: string; color: string }
> = {
  live: { vi: "🔴 ĐANG LIVE", en: "🔴 LIVE NOW", color: "#e5484d" },
  tournament: { vi: "🏆 GIẢI ĐẤU", en: "🏆 TOURNAMENT", color: "var(--tl-green, #15b886)" },
  event: { vi: "📅 SỰ KIỆN", en: "📅 EVENT", color: "var(--tl-green, #15b886)" },
};

interface FeedHappeningCardProps {
  item: FeedHappeningItem;
  language: Language;
  staggerIndex?: number;
}

export function FeedHappeningCard({
  item,
  language,
  staggerIndex,
}: FeedHappeningCardProps) {
  const animDelay =
    staggerIndex != null && staggerIndex >= 0 && staggerIndex < 6
      ? `${staggerIndex * 80}ms`
      : "0ms";
  const kindStyle = KIND_STYLE[item.kind];
  const badge = language === "vi" ? kindStyle.vi : kindStyle.en;
  const meta = language === "vi" ? item.meta_vi : item.meta_en;
  const cta =
    item.kind === "live"
      ? language === "vi" ? "Xem ngay →" : "Watch now →"
      : item.kind === "tournament"
        ? language === "vi" ? "Đăng ký ngay →" : "Register now →"
        : language === "vi" ? "Xem chi tiết →" : "See details →";

  return (
    <Link
      to={item.href}
      role="article"
      aria-label={item.title}
      className="tl-feed-card"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 14,
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
      {/* Eyebrow — kind badge only; these cards are about "now", not dates */}
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
            border: `1px solid ${kindStyle.color}`,
            color: kindStyle.color,
          }}
        >
          {badge}
        </span>
      </div>

      <h3
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontStyle: "italic",
          fontSize: 28,
          lineHeight: 1.1,
          letterSpacing: "-0.015em",
          color: "var(--tl-fg)",
          margin: 0,
        }}
      >
        {item.title}
      </h3>

      <p
        style={{
          fontSize: 14,
          lineHeight: 1.5,
          color: "var(--tl-fg-2)",
          margin: 0,
        }}
      >
        {meta}
      </p>

      <span style={{ fontSize: 13, color: kindStyle.color, fontWeight: 500 }}>
        {cta}
      </span>
    </Link>
  );
}

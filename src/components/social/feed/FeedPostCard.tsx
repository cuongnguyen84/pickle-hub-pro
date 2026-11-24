import {
  SOCIAL_POST_TOPICS,
  type FeedSocialPostItem,
} from "@/hooks/social/useSocialPosts";
import { type Language } from "@/lib/social/feed-formatters";
import { formatMatchWhen } from "@/lib/social/feed-formatters";
import { ReportDialog } from "@/components/report/ReportDialog";

/**
 * One community photo post (social_posts) in the /feed Trending stream.
 * Same editorial chrome as the other feed cards. A post has no detail
 * page in v1, so the card is an article, not a link; the only action is
 * reporting, wired to content_reports with content_type 'post'.
 */

interface FeedPostCardProps {
  item: FeedSocialPostItem;
  language: Language;
  staggerIndex?: number;
}

export function FeedPostCard({
  item,
  language,
  staggerIndex,
}: FeedPostCardProps) {
  const animDelay =
    staggerIndex != null && staggerIndex >= 0 && staggerIndex < 6
      ? `${staggerIndex * 80}ms`
      : "0ms";
  const topic = SOCIAL_POST_TOPICS.find((t) => t.key === item.topic);
  const pending = item.status === "pending";

  return (
    <article
      className="tl-feed-card"
      aria-label={item.body ?? undefined}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 14,
        padding: "32px 0",
        borderBottom: "1px solid var(--tl-border)",
        color: "inherit",
        position: "relative",
        opacity: 0,
        transform: "translateY(8px)",
        animation: `tl-feed-card-in 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) ${animDelay} forwards`,
      }}
    >
      {/* Eyebrow - community badge + topic + pending state */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
            border: "1px solid var(--tl-green, #15b886)",
            color: "var(--tl-green, #15b886)",
          }}
        >
          {language === "vi" ? "📸 CỘNG ĐỒNG" : "📸 COMMUNITY"}
        </span>
        {topic && (
          <span
            style={{
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
            {language === "vi" ? topic.vi : topic.en}
          </span>
        )}
        {pending && (
          <span
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: "4px 9px",
              borderRadius: 2,
              border: "1px solid #d97706",
              color: "#d97706",
            }}
          >
            {language === "vi" ? "⏳ ĐANG CHỜ DUYỆT" : "⏳ PENDING REVIEW"}
          </span>
        )}
      </div>

      {/* Author + time */}
      <p style={{ fontSize: 13, color: "var(--tl-fg-2)", margin: 0 }}>
        <span style={{ fontWeight: 600, color: "var(--tl-fg)" }}>
          {item.author_name}
        </span>
        <span aria-hidden="true"> · </span>
        {formatMatchWhen(item.published_at, language, "desktop")}
      </p>

      {/* Photo */}
      <img
        src={item.image_url}
        alt={item.body ?? ""}
        loading="lazy"
        decoding="async"
        style={{
          width: "100%",
          borderRadius: 8,
          display: "block",
        }}
      />

      {/* Caption */}
      {item.body && (
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.55,
            color: "var(--tl-fg)",
            margin: 0,
            whiteSpace: "pre-wrap",
          }}
        >
          {item.body}
        </p>
      )}

      {/* Actions - report only in v1 */}
      <div data-feed-local-action>
        <ReportDialog
          contentType="post"
          contentId={item.id}
          contentTitle={item.body ?? undefined}
        />
      </div>
    </article>
  );
}

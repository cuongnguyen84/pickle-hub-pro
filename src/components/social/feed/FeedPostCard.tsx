import {
  SOCIAL_POST_TOPICS,
  type FeedSocialPostItem,
} from "@/hooks/social/useSocialPosts";
import { type Language } from "@/lib/social/feed-formatters";
import { formatMatchWhen } from "@/lib/social/feed-formatters";
import { ReportDialog } from "@/components/report/ReportDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BadgeCheck } from "lucide-react";
import { Link } from "react-router-dom";

const initials = (name: string) =>
  name.split(/\s+/).map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();

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
  // Profile link rule (Cuong, 2026-11-24): the /nguoi-choi page opens
  // for opted-in public profiles AND for authors with at least one
  // approved community post. An approved item on this card proves
  // the second case by itself; the author's own pending card links
  // only when their profile is public (the owner bypass on the
  // profile page covers their other surfaces).
  const profileHref =
    item.author_username && (item.author_is_public || item.status === "approved")
      ? `/nguoi-choi/${item.author_username}`
      : null;
  const authorIdentity = (
    <>
      <Avatar className="h-8 w-8">
        <AvatarImage
          src={item.author_avatar_url ?? undefined}
          alt={item.author_name}
        />
        <AvatarFallback className="text-xs">
          {initials(item.author_name)}
        </AvatarFallback>
      </Avatar>
      <span
        style={{
          fontWeight: 600,
          color: "var(--tl-fg)",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        {item.author_name}
        {item.author_is_verified && (
          <BadgeCheck
            className="h-4 w-4"
            style={{ color: "var(--tl-green)" }}
            aria-label={language === "vi" ? "Đã xác thực" : "Verified"}
          />
        )}
      </span>
    </>
  );

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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 13,
          color: "var(--tl-fg-2)",
        }}
      >
        {profileHref ? (
          <Link
            to={profileHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              color: "inherit",
              textDecoration: "none",
            }}
          >
            {authorIdentity}
          </Link>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {authorIdentity}
          </span>
        )}
        <span aria-hidden="true">·</span>
        <span>{formatMatchWhen(item.published_at, language, "desktop")}</span>
      </div>

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

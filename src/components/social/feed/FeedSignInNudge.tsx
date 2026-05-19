import { useLocation } from "react-router-dom";
import type { Language } from "@/lib/social/feed-formatters";

interface FeedSignInNudgeProps {
  language: Language;
}

/**
 * Sign-in nudge banner shown above the feed for anonymous viewers.
 * Italic-serif copy + lime-green CTA. Positioned between the page hero
 * and the feed stream — replaces the hidden Following tab.
 *
 * Mockup source: Frame 05.
 */
export function FeedSignInNudge({ language }: FeedSignInNudgeProps) {
  const location = useLocation();
  const redirect = encodeURIComponent(location.pathname + location.search);
  const href = `/login?redirect=${redirect}`;

  return (
    <aside
      className="tl-feed-nudge"
      role="complementary"
      aria-label={
        language === "vi" ? "Lời mời đăng nhập" : "Sign-in invitation"
      }
    >
      <span className="tl-feed-nudge-text">
        {language === "vi" ? (
          <>Theo dõi <em>5+</em> người chơi để có bảng tin riêng.</>
        ) : (
          <>Follow <em>5+</em> players to unlock your personal feed.</>
        )}
      </span>
      <a href={href} className="tl-feed-nudge-cta">
        {language === "vi" ? "Đăng nhập" : "Sign in"}
      </a>
    </aside>
  );
}

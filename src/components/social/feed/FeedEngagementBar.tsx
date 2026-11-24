import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Heart, Loader2, MessageCircle } from "lucide-react";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import type { EngagementTargetType } from "@/lib/social/engagement";
import {
  useEngagementCounts,
  useToggleTargetKudos,
} from "@/hooks/social/useEngagement";
import { TargetCommentThread } from "@/components/social/comments/TargetCommentThread";

/**
 * Engagement bar for non-match feed cards (2026-11-24): kudos heart +
 * comment count chip in the match cards' visual language, with the
 * comment thread expanding inline under the card. Guests see the
 * counts; writing requires sign-in (same rule as the match module).
 */
export function FeedEngagementBar({
  targetType,
  targetId,
}: {
  targetType: EngagementTargetType;
  targetId: string;
}) {
  const { language } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { data } = useEngagementCounts(targetType, targetId);
  const toggle = useToggleTargetKudos(targetType);

  const kudos = data?.kudos_count ?? 0;
  const comments = data?.comment_count ?? 0;
  const kudoed = data?.viewer_kudoed ?? false;

  const handleKudos = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      const redirect = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?redirect=${redirect}`);
      return;
    }
    if (toggle.isPending) return;
    toggle.mutate(targetId);
  };

  return (
    <div data-feed-local-action style={{ padding: "0 16px 18px" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
        <button
          type="button"
          onClick={handleKudos}
          disabled={toggle.isPending}
          aria-label={
            kudoed
              ? language === "vi"
                ? "Bỏ thích"
                : "Unlike"
              : language === "vi"
                ? "Thích"
                : "Like"
          }
          aria-pressed={kudoed}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 4px",
            minHeight: 44,
            minWidth: 44,
            background: "transparent",
            border: "none",
            cursor: toggle.isPending ? "default" : "pointer",
            color: kudoed ? "var(--tl-green)" : "var(--tl-fg-3)",
            transition: "color 0.2s ease",
          }}
        >
          {toggle.isPending ? (
            <Loader2
              className="animate-spin"
              style={{ width: 16, height: 16 }}
              aria-hidden="true"
            />
          ) : (
            <Heart
              style={{ width: 16, height: 16 }}
              fill={kudoed ? "currentColor" : "none"}
              strokeWidth={kudoed ? 0 : 1.75}
              aria-hidden="true"
            />
          )}
          {kudos > 0 && (
            <span
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontStyle: "italic",
                fontSize: 14,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {kudos}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          aria-label={language === "vi" ? "Bình luận" : "Comments"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 4px",
            minHeight: 44,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: open ? "var(--tl-fg)" : "var(--tl-fg-3)",
          }}
        >
          <MessageCircle style={{ width: 16, height: 16 }} aria-hidden="true" />
          {comments > 0 && (
            <span
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontStyle: "italic",
                fontSize: 14,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {comments}
            </span>
          )}
          <span style={{ fontSize: 13 }}>
            {language === "vi" ? "Bình luận" : "Comments"}
          </span>
        </button>
      </div>

      {open && (
        <TargetCommentThread targetType={targetType} targetId={targetId} />
      )}
    </div>
  );
}

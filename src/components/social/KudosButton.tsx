import { Heart, Loader2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { useKudosMutation } from "@/hooks/social/useKudos";

export type KudosButtonVariant = "feed" | "detail";

interface KudosButtonProps {
  matchId: string;
  /** Current kudos count for this match. Owner: parent (feed RPC row or
   *  useMatchKudos query). KudosButton stays controlled. */
  count: number;
  /** Whether the viewer has kudoed this match. Same ownership rule. */
  kudoed: boolean;
  variant?: KudosButtonVariant;
  /**
   * Optional. When the button lives inside a clickable container
   * (FeedMatchCard <Link>), the parent passes a wrapper that calls
   * stopPropagation. Default for variant='feed' wraps onClick automatically.
   */
  onClickCapture?: (e: React.MouseEvent) => void;
}

/**
 * Heart toggle for match kudos. Pure controlled component — count and
 * kudoed are owned by the parent (the feed RPC row or useMatchKudos query).
 * KudosButton dispatches the mutation; optimistic UI is handled in
 * useKudosMutation by patching both ['match-kudos', …] and ['feed', …]
 * caches.
 *
 * Two variants:
 *   - 'feed':   16px outline/filled Heart, count to the right (italic
 *               serif), count hidden when 0 so virgin cards show only the
 *               icon. Suits FeedMatchCard foot row density.
 *   - 'detail': 24px Heart + bilingual label + large italic green count.
 *               Suits MatchPage MatchActions.
 *
 * Anonymous click → /login?redirect=<current>. Authenticated click →
 * mutation. While the mutation is in flight the icon disables and shows
 * the spinner; the controlled count keeps showing the optimistic value
 * because the parent's cache was already patched.
 */
export function KudosButton({
  matchId,
  count,
  kudoed,
  variant = "feed",
  onClickCapture,
}: KudosButtonProps) {
  const { user } = useAuth();
  const { language } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const mutation = useKudosMutation();

  // User-facing copy uses "Like / Thích". Internal naming (component,
  // hook, table, RPC) stays "kudos" — Strava-style activity engagement
  // semantic for devs, friendlier surface for users.
  const labels = {
    kudo: language === "vi" ? "Thích" : "Like",
    kudoed: language === "vi" ? "Đã thích" : "Liked",
    addAria: language === "vi" ? "Thích trận này" : "Like this match",
    removeAria:
      language === "vi" ? "Bỏ thích trận này" : "Unlike this match",
  };

  const isLoading = mutation.isPending;
  const ariaLabel = kudoed ? labels.removeAria : labels.addAria;

  const handleClick = (e: React.MouseEvent) => {
    onClickCapture?.(e);
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      const redirect = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?redirect=${redirect}`);
      return;
    }
    if (isLoading) return;
    mutation.mutate({ matchId, currentKudoed: kudoed });
  };

  if (variant === "feed") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        aria-label={ariaLabel}
        aria-pressed={kudoed}
        aria-busy={isLoading}
        className="tl-kudos-btn tl-kudos-btn--feed"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 4px",
          minHeight: 44,
          minWidth: 44,
          background: "transparent",
          border: "none",
          cursor: isLoading ? "default" : "pointer",
          color: kudoed ? "var(--tl-green)" : "var(--tl-fg-3)",
          transition: "color 0.2s ease",
        }}
      >
        {isLoading ? (
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
        {count > 0 && (
          <span
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontSize: 14,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {count}
          </span>
        )}
      </button>
    );
  }

  // variant === 'detail'
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      aria-label={ariaLabel}
      aria-pressed={kudoed}
      aria-busy={isLoading}
      className="tl-kudos-btn tl-kudos-btn--detail"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        background: "transparent",
        border: "1px solid var(--tl-border, rgba(255,255,255,0.12))",
        borderRadius: 4,
        cursor: isLoading ? "default" : "pointer",
        color: kudoed ? "var(--tl-green)" : "var(--tl-fg-2)",
        transition: "color 0.2s ease, border-color 0.2s ease",
      }}
    >
      {isLoading ? (
        <Loader2
          className="animate-spin"
          style={{ width: 20, height: 20 }}
          aria-hidden="true"
        />
      ) : (
        <Heart
          style={{ width: 20, height: 20 }}
          fill={kudoed ? "currentColor" : "none"}
          strokeWidth={kudoed ? 0 : 1.75}
          aria-hidden="true"
        />
      )}
      <span
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {kudoed ? labels.kudoed : labels.kudo}
      </span>
      {count > 0 && (
        <>
          <span aria-hidden="true" style={{ color: "var(--tl-fg-4)", margin: "0 -4px" }}>
            ·
          </span>
          <span
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontSize: 22,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
              color: "var(--tl-green)",
            }}
          >
            {count}
          </span>
        </>
      )}
    </button>
  );
}

export default KudosButton;

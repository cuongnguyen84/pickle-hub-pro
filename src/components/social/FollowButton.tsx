import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, UserPlus, UserCheck, UserMinus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { useFollowStatus, useFollowMutation } from "@/hooks/social/useFollow";

export type FollowButtonVariant = "default" | "compact" | "inline";
export type FollowButtonSize = "sm" | "md" | "lg";

interface FollowButtonProps {
  /** profile.id of the user being followed/unfollowed */
  targetUserId: string;
  /**
   * Optional. Used for aria-label personalization AND for invalidating the
   * player-stats RPC cache (so /nguoi-choi/<username>'s follower_count
   * refreshes immediately after toggle).
   */
  targetUsername?: string;
  variant?: FollowButtonVariant;
  size?: FollowButtonSize;
  /** Fires after a successful toggle (passes the NEW state). */
  onFollowChange?: (isFollowing: boolean) => void;
}

/**
 * Reusable follow toggle. Three visual variants for the contexts Bet #1
 * surfaces it in:
 *   - "default": full-width tl-btn with icon + text → PlayerProfile hero
 *   - "compact": square icon-only → search results, dense lists (consumer
 *                lands later, kept here so callers can opt in)
 *   - "inline":  ghost text + icon → onboarding suggested follows row
 *
 * Behavior:
 *   - Renders null on the viewer's own profile (no self-follow).
 *   - Click while signed-out → /login?redirect=<current path>.
 *   - Optimistic flip via useFollowMutation; failure rolls back + toasts.
 *   - "Following" state shows UserMinus + red on hover so unfollow intent
 *     is unambiguous (default variant only — compact/inline keep neutral
 *     hover for density).
 *
 * a11y:
 *   - aria-pressed reflects follow state (toggle button semantic).
 *   - aria-label personalized with targetUsername when provided.
 *   - aria-busy while the mutation is pending.
 */
export function FollowButton({
  targetUserId,
  targetUsername,
  variant = "default",
  size = "md",
  onFollowChange,
}: FollowButtonProps) {
  const { user } = useAuth();
  const { language } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: isFollowing = false, isLoading: statusLoading } =
    useFollowStatus(targetUserId);
  const mutation = useFollowMutation();
  const [hovered, setHovered] = useState(false);

  // Hide on own profile.
  if (user && user.id === targetUserId) return null;

  const isLoading = statusLoading || mutation.isPending;

  const handleClick = () => {
    if (!user) {
      const redirect = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?redirect=${redirect}`);
      return;
    }
    const next = !isFollowing;
    mutation.mutate(
      {
        followedId: targetUserId,
        follow: next,
        followedUsername: targetUsername,
      },
      {
        onSuccess: () => onFollowChange?.(next),
      },
    );
  };

  // ─── Label resolution ────────────────────────────────────────────────────
  const labels = {
    follow: language === "vi" ? "Theo dõi" : "Follow",
    following: language === "vi" ? "Đang theo dõi" : "Following",
    unfollow: language === "vi" ? "Bỏ theo dõi" : "Unfollow",
  };

  let visibleLabel: string;
  let Icon = UserPlus;
  if (isFollowing) {
    if (hovered && variant === "default") {
      visibleLabel = labels.unfollow;
      Icon = UserMinus;
    } else {
      visibleLabel = labels.following;
      Icon = UserCheck;
    }
  } else {
    visibleLabel = labels.follow;
    Icon = UserPlus;
  }

  const ariaLabel = targetUsername
    ? `${isFollowing ? labels.unfollow : labels.follow} @${targetUsername}`
    : isFollowing
      ? labels.unfollow
      : labels.follow;

  // ─── Variant rendering ──────────────────────────────────────────────────
  if (variant === "compact") {
    return (
      <button
        type="button"
        className="tl-btn"
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={isLoading}
        aria-label={ariaLabel}
        aria-pressed={isFollowing}
        aria-busy={isLoading}
        style={{
          padding: size === "sm" ? "6px 8px" : size === "lg" ? "12px 14px" : "9px 11px",
          minWidth: 0,
          background: isFollowing ? "var(--tl-green-glow)" : "transparent",
        }}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </button>
    );
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={isLoading}
        aria-label={ariaLabel}
        aria-pressed={isFollowing}
        aria-busy={isLoading}
        style={{
          background: "transparent",
          border: "none",
          padding: "6px 10px",
          color: isFollowing ? "var(--tl-green)" : "var(--tl-fg)",
          fontFamily: "inherit",
          fontSize: size === "sm" ? 13 : size === "lg" ? 16 : 14,
          cursor: isLoading ? "wait" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
        {visibleLabel}
      </button>
    );
  }

  // default variant
  const sizeStyles: React.CSSProperties =
    size === "sm"
      ? { padding: "8px 12px", fontSize: 13 }
      : size === "lg"
        ? { padding: "13px 22px", fontSize: 15 }
        : { padding: "11px 18px", fontSize: 14 };

  const followingHovered = isFollowing && hovered;
  return (
    <button
      type="button"
      className={isFollowing ? "tl-btn" : "tl-btn primary"}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={isLoading}
      aria-label={ariaLabel}
      aria-pressed={isFollowing}
      aria-busy={isLoading}
      style={{
        ...sizeStyles,
        ...(followingHovered
          ? {
              background: "var(--tl-red, #ef4444)",
              borderColor: "var(--tl-red, #ef4444)",
              color: "var(--tl-bg)",
            }
          : null),
      }}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {visibleLabel}
    </button>
  );
}

export default FollowButton;

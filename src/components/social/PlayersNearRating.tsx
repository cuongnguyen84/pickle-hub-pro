// ============================================================================
// PlayersNearRating — "Players near my DUPR rating" widget
// ----------------------------------------------------------------------------
// Sprint A12 (2026-05-27).
//
// Renders a compact list of up to N players whose DUPR doubles rating sits
// within ± window of the target rating. Mounted on PlayerProfile sidebar
// (the visiting player can see "people like me") and is reusable on Feed
// when the viewer has their own DUPR connected.
//
// Empty/loading/error states are all silent-graceful — the widget hides
// itself entirely if targetRating is null, so callers don't need to guard.
// ============================================================================

import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import {
  usePlayersNearRating,
  type PlayerNearRatingRow,
} from "@/hooks/dupr/usePlayersNearRating";
import { DuprChip } from "@/components/dupr/DuprChip";
import { isDuprStale } from "@/lib/dupr/staleness";

interface PlayersNearRatingProps {
  /** The DUPR doubles rating to compare against. Widget hides if null. */
  targetRating: number | null | undefined;
  /** Exclude this user id from results (typically the profile being viewed). */
  excludeUserId?: string | null;
  /** Match window in DUPR points. Default 0.3 (±0.3). */
  window?: number;
  /** Max items. Default 8. */
  limit?: number;
  /** Optional className passthrough for layout wrappers. */
  className?: string;
}

export function PlayersNearRating({
  targetRating,
  excludeUserId,
  window = 0.3,
  limit = 8,
  className,
}: PlayersNearRatingProps) {
  const { language } = useI18n();
  const vi = language === "vi";

  const { data, isLoading, isError } = usePlayersNearRating({
    targetRating,
    excludeUserId,
    window,
    limit,
  });

  // Hide entirely when there's no target. Caller doesn't have to guard.
  if (targetRating == null) return null;

  return (
    <aside
      className={`tl-panel ${className ?? ""}`}
      aria-label={vi ? "Người chơi gần rating của bạn" : "Players near your rating"}
    >
      <div className="tl-panel-head">
        <h4 style={{ margin: 0, fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: "'Geist Mono', monospace" }}>
          {vi ? "Cùng tầm DUPR" : "Players near this rating"}
        </h4>
        <span className="meta" style={{ fontSize: 11 }}>
          ±{window.toFixed(1)} · {targetRating.toFixed(2)}
        </span>
      </div>

      <div style={{ padding: 16 }}>
        {isLoading ? (
          <p style={{ fontSize: 12, color: "var(--tl-fg-3)", margin: 0 }}>
            {vi ? "Đang tải…" : "Loading…"}
          </p>
        ) : isError ? (
          <p style={{ fontSize: 12, color: "var(--tl-fg-3)", margin: 0 }}>
            {vi ? "Không tải được" : "Couldn't load"}
          </p>
        ) : !data || data.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--tl-fg-3)", margin: 0, lineHeight: 1.5 }}>
            {vi
              ? "Chưa có ai cùng tầm. Mời bạn bè lên ThePickleHub để mở rộng cộng đồng."
              : "Nobody nearby yet. Invite friends to ThePickleHub to grow the pool."}
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {data.map((p) => (
              <PlayersNearRatingItem key={p.user_id} player={p} vi={vi} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function PlayersNearRatingItem({
  player,
  vi,
}: {
  player: PlayerNearRatingRow;
  vi: boolean;
}) {
  const diffStr = (player.rating_diff >= 0 ? "+" : "") + player.rating_diff.toFixed(2);
  const stale = isDuprStale(player.dupr_synced_at);

  return (
    <li>
      <Link
        to={`/nguoi-choi/${player.username}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          color: "inherit",
        }}
      >
        {player.avatar_url ? (
          <img
            src={player.avatar_url}
            alt=""
            loading="lazy"
            width={32}
            height={32}
            style={{
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--tl-surface-2, rgba(255,255,255,0.06))",
              border: "1px solid var(--tl-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "var(--tl-fg-3)",
              flexShrink: 0,
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            {(player.display_name ?? player.username).slice(0, 1).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              color: "var(--tl-fg)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {player.display_name ?? player.username}
          </div>
          {player.city && (
            <div
              style={{
                fontSize: 11,
                color: "var(--tl-fg-3)",
                fontFamily: "'Geist Mono', monospace",
                marginTop: 2,
              }}
            >
              {player.city}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
          <DuprChip doubles={player.dupr_doubles} format="doubles" stale={stale} size="xs" />
          <span
            style={{
              fontSize: 10,
              color: "var(--tl-fg-3)",
              fontFamily: "'Geist Mono', monospace",
              fontVariantNumeric: "tabular-nums",
            }}
            aria-label={vi ? `Chênh lệch ${diffStr}` : `Diff ${diffStr}`}
          >
            Δ {diffStr}
          </span>
        </div>
      </Link>
    </li>
  );
}

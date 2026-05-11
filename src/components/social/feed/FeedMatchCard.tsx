import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import {
  type Language,
  type FeedParticipant,
  formatFormatLabel,
  formatTypeLabel,
  formatStatusLabel,
  statusBadgeClass,
  formatMatchWhen,
  groupTeams,
  buildAriaLabel,
} from "@/lib/social/feed-formatters";
import type { FeedMatch } from "@/hooks/social/useFollowingFeed";
import { KudosButton } from "@/components/social/KudosButton";

interface FeedMatchCardProps {
  match: FeedMatch;
  language: Language;
  /** Stagger-reveal index, 0-based. Capped at 5 by parent. */
  staggerIndex?: number;
}

/**
 * Editorial match card — single dispatch in the /feed timeline. No avatars,
 * no kudos, no comments (Phase 4A scope guard). Whole card is a click target
 * to /tran-dau/<slug>; nested player + venue links stop propagation.
 *
 * Mockup source: .claude/mockups/feed-page-mockup.html — Frame 03 anatomy.
 *   i.   Eyebrow strip — date · time · format · type
 *   ii.  Status badge — verified/pending/disputed
 *   iii. Team rows — winner italic + green, loser roman + dim 0.55
 *   iv.  @handle · DUPR sub-line (DUPR hidden on mobile via CSS rule)
 *   v.   Score column — Instrument Serif italic, multi-game cells
 *   vi.  Foot — venue diamond + chevron pseudo
 *   vii. Hairline divider below, lime gradient bloom on hover
 */
export function FeedMatchCard({
  match,
  language,
  staggerIndex,
}: FeedMatchCardProps) {
  const { teamA, teamB } = groupTeams(match.participants);
  const winnerIsA = match.winning_team === "a";

  const ariaLabel = buildAriaLabel({
    language,
    teamA,
    teamB,
    scoreA: match.team_a_score,
    scoreB: match.team_b_score,
    winningTeam: winnerIsA ? "a" : "b",
    venueName: match.venue_name,
    playedAt: match.played_at,
    format: match.format,
  });

  const animDelay =
    staggerIndex != null && staggerIndex >= 0 && staggerIndex < 6
      ? `${staggerIndex * 80}ms`
      : "0ms";

  return (
    <Link
      to={`/tran-dau/${match.slug}`}
      role="article"
      aria-label={ariaLabel}
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
      {/* Eyebrow + status badge */}
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
            {formatMatchWhen(match.played_at, language, "desktop")}
          </span>
          <span style={{ color: "var(--tl-fg-4)" }}>·</span>
          <span>{formatFormatLabel(match.format, language)}</span>
          <span style={{ color: "var(--tl-fg-4)" }}>·</span>
          <span>{formatTypeLabel(match.match_type, language)}</span>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <ProSourceBadge
            source={match.source_provider}
            language={language}
          />
          <StatusBadge status={match.verification_status} language={language} />
        </div>
      </div>

      {/* Pro tour tournament caption — only renders for non-community
          matches. Position above the team rows so the tournament context
          reads first ("PPA Tour: 2026 Finals · Mens Doubles · R32"). */}
      {match.source_provider !== "community" && match.tournament_name && (
        <div
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 10.5,
            letterSpacing: "0.08em",
            color: "var(--tl-fg-3)",
            textTransform: "uppercase",
            marginTop: -8,
          }}
        >
          {[
            match.tournament_name,
            match.tournament_event,
            match.round_name,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}

      {/* Two-team scoreboard */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "8px 24px",
          padding: "4px 0",
        }}
      >
        <TeamRow
          team={teamA}
          isWinner={winnerIsA}
          format={match.format}
          language={language}
        />
        <ScoreColumn
          scores={match.team_a_score}
          isWinner={winnerIsA}
        />
        <TeamRow
          team={teamB}
          isWinner={!winnerIsA}
          format={match.format}
          language={language}
        />
        <ScoreColumn
          scores={match.team_b_score}
          isWinner={!winnerIsA}
        />
      </div>

      {/* Foot — kudos · venue + chevron pseudo (CSS-driven hover).
          KudosButton sits LEFT of the venue diamond. The button itself
          calls preventDefault + stopPropagation so its click doesn't
          bubble up to the wrapping <Link>. */}
      <div className="tl-feed-card-foot">
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <KudosButton
            matchId={match.match_id}
            count={match.kudos_count}
            kudoed={match.viewer_kudoed}
            variant="feed"
          />
          <CommentCountChip
            slug={match.slug}
            count={match.comment_count}
          />
          {match.venue_name && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--tl-fg-2)",
              }}
            >
              <span aria-hidden="true" style={{ color: "var(--tl-fg-4)", fontSize: 8 }}>
                ◆
              </span>
              {match.venue_name}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ─── Pro source badge (Sprint 6) ────────────────────────────────────── */
//
// Surfaces "PPA TOUR" / "APP TOUR" / "MLP" on cards whose source_provider
// is not 'community'. Amber accent (gold token from the-line.css) so it
// reads as editorial / external context — distinct from the lime accent
// used for active states elsewhere in the surface.
function ProSourceBadge({
  source,
  language,
}: {
  source: FeedMatch["source_provider"];
  language: Language;
}) {
  if (source === "community") return null;
  const label =
    source === "ppa_tour"
      ? "PPA TOUR"
      : source === "app_tour"
        ? "APP TOUR"
        : source === "mlp"
          ? "MLP"
          : "PRO";
  return (
    <span
      aria-label={
        language === "vi" ? `Trận từ ${label}` : `Match from ${label}`
      }
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
        border: "1px solid rgba(233, 182, 73, 0.3)",
        color: "var(--tl-gold, #e9b649)",
      }}
    >
      {label}
    </span>
  );
}

/* ─── Status badge ────────────────────────────────────────────────────── */
function StatusBadge({
  status,
  language,
}: {
  status: string;
  language: Language;
}) {
  const variant = statusBadgeClass(status);
  const label = formatStatusLabel(status, language);

  const variantStyle: React.CSSProperties =
    variant === "verified"
      ? {
          color: "var(--tl-green)",
          borderColor: "var(--tl-green-dim)",
          background: "var(--tl-green-glow)",
        }
      : variant === "pending"
        ? {
            color: "var(--tl-gold)",
            borderColor: "rgba(233, 182, 73, 0.3)",
          }
        : {
            color: "var(--tl-live)",
            borderColor: "rgba(255, 65, 54, 0.3)",
          };

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
        border: "1px solid",
        ...variantStyle,
      }}
    >
      {label}
    </span>
  );
}

/* ─── Team row ────────────────────────────────────────────────────────── */
function TeamRow({
  team,
  isWinner,
  format,
  language: _language,
}: {
  team: FeedParticipant[];
  isWinner: boolean;
  format: string;
  language: Language;
}) {
  if (team.length === 0) return <div />;
  const isSingles = format === "singles" || team.length === 1;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "8px 0",
        opacity: isWinner ? 1 : 0.55,
        transition: "opacity 0.25s",
      }}
      className={isWinner ? "tl-feed-team-won" : "tl-feed-team-lost"}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {team.map((p, i) => (
          <span
            key={p.player_id}
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 10,
            }}
          >
            <PlayerNameLink player={p} isWinner={isWinner} />
            {!isSingles && i < team.length - 1 && (
              <span
                aria-hidden="true"
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontStyle: "italic",
                  fontSize: 22,
                  color: "var(--tl-fg-4)",
                  margin: "0 -2px",
                }}
              >
                +
              </span>
            )}
          </span>
        ))}
      </div>
      <div
        className="tl-feed-team-handles"
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          fontFamily: "'Geist Mono', monospace",
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--tl-fg-3)",
          flexWrap: "wrap",
        }}
      >
        {team.map((p, i) => (
          <span
            key={p.player_id}
            style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}
          >
            <span style={{ color: "var(--tl-fg-3)" }}>
              {p.username ? `@${p.username}` : p.display_name ?? ""}
            </span>
            {p.dupr_doubles != null && (
              <span className="tl-feed-dupr" style={{ color: "var(--tl-fg-2)" }}>
                DUPR {p.dupr_doubles.toFixed(2)}
              </span>
            )}
            {i < team.length - 1 && (
              <span style={{ color: "var(--tl-fg-4)", marginLeft: 4 }}>·</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function PlayerNameLink({
  player,
  isWinner,
}: {
  player: FeedParticipant;
  isWinner: boolean;
}) {
  const name = player.display_name ?? player.username ?? "Unknown";
  const baseStyle: React.CSSProperties = {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 26,
    lineHeight: 1.05,
    letterSpacing: "-0.01em",
    color: "var(--tl-fg)",
    textDecoration: "none",
    fontStyle: isWinner ? "italic" : "normal",
  };
  if (!player.username || player.is_ghost) {
    return <span style={baseStyle}>{name}</span>;
  }
  return (
    <Link
      to={`/nguoi-choi/${player.username}`}
      onClick={(e) => e.stopPropagation()}
      style={baseStyle}
      className="tl-feed-player-link"
    >
      {name}
    </Link>
  );
}

/* ─── Comment count chip ─────────────────────────────────────────────── */
function CommentCountChip({
  slug,
  count,
}: {
  slug: string;
  count: number;
}) {
  // Don't bubble the click into the wrapping <Link> (which would route to
  // /tran-dau/<slug> with no hash). The chip itself routes to the same
  // slug but anchored at #comments so the page lands scrolled to the
  // thread — desirable when the user clicks specifically the chip.
  return (
    <Link
      to={`/tran-dau/${slug}#comments`}
      onClick={(e) => e.stopPropagation()}
      aria-label={`${count} comments`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 4px",
        minHeight: 44,
        minWidth: 44,
        textDecoration: "none",
        color: count > 0 ? "var(--tl-fg-2)" : "var(--tl-fg-3)",
      }}
    >
      <MessageCircle
        style={{ width: 16, height: 16 }}
        strokeWidth={1.75}
        aria-hidden="true"
      />
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
    </Link>
  );
}

/* ─── Score column ────────────────────────────────────────────────────── */
function ScoreColumn({
  scores,
  isWinner,
}: {
  scores: number[];
  isWinner: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "8px 0",
        alignSelf: "stretch",
      }}
    >
      {scores.map((s, i) => (
        <span
          key={i}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          {i > 0 && (
            <span
              aria-hidden="true"
              style={{
                width: 1,
                background: "var(--tl-border)",
                alignSelf: "stretch",
              }}
            />
          )}
          <span
            className="tl-feed-score"
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontSize: 56,
              lineHeight: 0.9,
              letterSpacing: "-0.04em",
              color: isWinner ? "var(--tl-green)" : "var(--tl-fg-3)",
              fontVariantNumeric: "tabular-nums",
              minWidth: 38,
              textAlign: "right",
            }}
          >
            {s}
          </span>
        </span>
      ))}
    </div>
  );
}

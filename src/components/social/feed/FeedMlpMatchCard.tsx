import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import {
  type Language,
  formatTypeLabel,
  formatStatusLabel,
  statusBadgeClass,
  formatMatchWhen,
} from "@/lib/social/feed-formatters";
import type { FeedMatch } from "@/hooks/social/useFollowingFeed";
import { KudosButton } from "@/components/social/KudosButton";

/**
 * MLP-specific match card for /feed.
 *
 * MLP matchups are team-vs-team battles with 4-5 inner games (WD, MD,
 * MXD1, MXD2, optional DB). The notes field encodes:
 *   {
 *     format: "mlp_team_matchup",
 *     team_a: { name, logo, matchup_wins },
 *     team_b: { name, logo, matchup_wins },
 *     games: [{ label, score_a, score_b, players_a, players_b, winner }]
 *   }
 *
 * Layout adapts the MLP-page design to ThePickleHub's "The Line" tokens:
 *   - Editorial eyebrow row (date · time · type · MLP · status)
 *   - Two-team scoreboard with logo · team name · big matchup-wins score
 *   - "GAME DETAILS" expand button toggles a table of 5 inner games
 *     showing each game's 4 players + score, winner accented green
 */

interface MlpTeam {
  name: string;
  logo: string | null;
  matchup_wins: number;
}

interface MlpGame {
  label: string;
  score_a: number;
  score_b: number;
  players_a: string[];
  players_b: string[];
  winner: "a" | "b" | null;
}

interface MlpMatchupNotes {
  format: string;
  team_a: MlpTeam;
  team_b: MlpTeam;
  games: MlpGame[];
}

interface FeedMlpMatchCardProps {
  match: FeedMatch;
  language: Language;
  staggerIndex?: number;
}

const GAME_LABEL_LONG: Record<string, { en: string; vi: string }> = {
  WD: { en: "Women's Doubles", vi: "Đôi nữ" },
  MD: { en: "Men's Doubles", vi: "Đôi nam" },
  MXD1: { en: "Mixed Doubles 1", vi: "Đôi nam nữ 1" },
  MXD2: { en: "Mixed Doubles 2", vi: "Đôi nam nữ 2" },
  DB: { en: "Dreambreaker", vi: "Dreambreaker" },
};

function parseNotes(raw: string | null): MlpMatchupNotes | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MlpMatchupNotes;
    if (parsed.format !== "mlp_team_matchup") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function FeedMlpMatchCard({
  match,
  language,
  staggerIndex,
}: FeedMlpMatchCardProps) {
  const notes = parseNotes(match.notes);
  const [expanded, setExpanded] = useState(false);

  if (!notes) {
    // Fallback: nothing to render specially — should never hit with valid data
    return null;
  }

  const { team_a, team_b, games } = notes;
  const winnerIsA = match.winning_team === "a";

  const animDelay =
    staggerIndex != null && staggerIndex >= 0 && staggerIndex < 6
      ? `${staggerIndex * 80}ms`
      : "0ms";

  const ariaLabel =
    language === "vi"
      ? `Trận MLP: ${team_a.name} ${team_a.matchup_wins} - ${team_b.matchup_wins} ${team_b.name}`
      : `MLP matchup: ${team_a.name} ${team_a.matchup_wins} - ${team_b.matchup_wins} ${team_b.name}`;

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
      {/* Eyebrow + badges */}
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
          <span>{formatTypeLabel(match.match_type, language)}</span>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <MlpBadge />
          <StatusBadge
            status={match.verification_status}
            language={language}
          />
        </div>
      </div>

      {/* Tournament caption */}
      {match.tournament_name && (
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
          {[match.tournament_name, match.tournament_event, match.round_name]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}

      {/* Two-team scoreboard with logos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 24,
          padding: "8px 0",
        }}
      >
        <TeamSide team={team_a} isWinner={winnerIsA} align="left" />
        <div
          aria-hidden="true"
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 12,
            letterSpacing: "0.1em",
            color: "var(--tl-fg-4)",
            textAlign: "center",
          }}
        >
          VS
        </div>
        <TeamSide team={team_b} isWinner={!winnerIsA} align="right" />
      </div>

      {/* GAME DETAILS toggle button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        aria-expanded={expanded}
        aria-controls={`mlp-games-${match.match_id}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "10px 16px",
          background: "transparent",
          border: "1px solid var(--tl-border)",
          borderRadius: 2,
          color: "var(--tl-fg-2)",
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          cursor: "pointer",
          width: "100%",
          transition: "border-color 0.2s, color 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "var(--tl-green-dim, var(--tl-fg-2))";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--tl-fg)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "var(--tl-border)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--tl-fg-2)";
        }}
      >
        {expanded ? (
          <ChevronUp size={14} strokeWidth={1.5} />
        ) : (
          <ChevronDown size={14} strokeWidth={1.5} />
        )}
        {language === "vi" ? "Chi tiết các game" : "Game details"}
      </button>

      {/* Expanded games table */}
      {expanded && (
        <div
          id={`mlp-games-${match.match_id}`}
          style={{
            display: "grid",
            gap: 10,
            paddingTop: 4,
          }}
        >
          {games.map((g, idx) => (
            <GameRow
              key={`${g.label}-${idx}`}
              game={g}
              teamAName={team_a.name}
              teamBName={team_b.name}
              language={language}
            />
          ))}
        </div>
      )}

      {/* Foot — kudos + comments + venue */}
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
          <CommentCountChip slug={match.slug} count={match.comment_count} />
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
              <span
                aria-hidden="true"
                style={{ color: "var(--tl-fg-4)", fontSize: 8 }}
              >
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

/* ─── TeamSide ────────────────────────────────────────────────────────── */
function TeamSide({
  team,
  isWinner,
  align,
}: {
  team: MlpTeam;
  isWinner: boolean;
  align: "left" | "right";
}) {
  const flexDir = align === "right" ? "row-reverse" : "row";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: flexDir,
        alignItems: "center",
        gap: 18,
        opacity: isWinner ? 1 : 0.55,
        transition: "opacity 0.25s",
      }}
    >
      {team.logo && (
        <img
          src={team.logo}
          alt={`${team.name} logo`}
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{
            width: 56,
            height: 56,
            objectFit: "contain",
            flexShrink: 0,
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          alignItems: align === "right" ? "flex-end" : "flex-start",
        }}
      >
        <span
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: isWinner ? "italic" : "normal",
            fontSize: 26,
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            color: "var(--tl-fg)",
          }}
        >
          {team.name}
        </span>
        <span
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: "italic",
            fontSize: 56,
            lineHeight: 0.9,
            letterSpacing: "-0.04em",
            fontVariantNumeric: "tabular-nums",
            color: isWinner ? "var(--tl-green)" : "var(--tl-fg-3)",
          }}
        >
          {team.matchup_wins}
        </span>
      </div>
    </div>
  );
}

/* ─── Game row ────────────────────────────────────────────────────────── */
function GameRow({
  game,
  teamAName,
  teamBName,
  language,
}: {
  game: MlpGame;
  teamAName: string;
  teamBName: string;
  language: Language;
}) {
  const labelLong =
    GAME_LABEL_LONG[game.label]?.[language === "vi" ? "vi" : "en"] ??
    game.label;
  const aWon = game.winner === "a";
  const bWon = game.winner === "b";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "70px 1fr auto 1fr",
        alignItems: "center",
        gap: 14,
        padding: "10px 12px",
        border: "1px solid var(--tl-hairline, var(--tl-border))",
        borderRadius: 2,
        background: "var(--tl-bg-2, transparent)",
      }}
    >
      <div
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--tl-fg-3)",
        }}
        title={labelLong}
      >
        {game.label}
      </div>

      <TeamPlayers
        players={game.players_a}
        teamName={teamAName}
        score={game.score_a}
        isWinner={aWon}
        align="left"
      />

      <span
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          color: "var(--tl-fg-4)",
          padding: "0 6px",
        }}
      >
        vs
      </span>

      <TeamPlayers
        players={game.players_b}
        teamName={teamBName}
        score={game.score_b}
        isWinner={bWon}
        align="right"
      />
    </div>
  );
}

function TeamPlayers({
  players,
  teamName,
  score,
  isWinner,
  align,
}: {
  players: string[];
  teamName: string;
  score: number;
  isWinner: boolean;
  align: "left" | "right";
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: align === "right" ? "row-reverse" : "row",
        alignItems: "center",
        gap: 12,
        opacity: isWinner ? 1 : 0.6,
      }}
    >
      <span
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontStyle: "italic",
          fontSize: 22,
          lineHeight: 1,
          color: isWinner ? "var(--tl-green)" : "var(--tl-fg-3)",
          fontVariantNumeric: "tabular-nums",
          minWidth: 24,
          textAlign: align === "right" ? "left" : "right",
        }}
      >
        {score}
      </span>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          alignItems: align === "right" ? "flex-end" : "flex-start",
        }}
      >
        {players.length > 0 ? (
          players.map((p) => (
            <span
              key={p}
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontStyle: isWinner ? "italic" : "normal",
                fontSize: 14,
                lineHeight: 1.15,
                color: "var(--tl-fg-2)",
              }}
            >
              {p}
            </span>
          ))
        ) : (
          <span
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 10,
              color: "var(--tl-fg-4)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {teamName}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Badges ───────────────────────────────────────────────────────────── */
function MlpBadge() {
  return (
    <span
      aria-label="Major League Pickleball"
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
      MLP
    </span>
  );
}

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
        ? { color: "var(--tl-gold)", borderColor: "rgba(233, 182, 73, 0.3)" }
        : { color: "var(--tl-live)", borderColor: "rgba(255, 65, 54, 0.3)" };
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

function CommentCountChip({ slug, count }: { slug: string; count: number }) {
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

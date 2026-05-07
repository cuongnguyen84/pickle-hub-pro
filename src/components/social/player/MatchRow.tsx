import { Link } from "react-router-dom";
import type { PlayerMatchHistoryRow } from "@/hooks/social/usePlayerMatchHistory";

interface MatchRowProps {
  match: PlayerMatchHistoryRow;
  /** Player whose POV this row is rendered for — bolded in the lineup. */
  viewerPlayerId: string;
}

interface ParticipantSlim {
  player_id: string;
  team: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_ghost: boolean;
}

const FORMAT_LABELS: Record<string, string> = {
  singles: "Đơn",
  doubles: "Đôi",
  mixed: "Đôi nam-nữ",
};

/**
 * Editorial row matching TheLine pattern — no card border, hairline divider
 * via the parent <ul>. Mono date prefix, italic serif team names,
 * tabular-nums score, W/L pill colored by tl-green / tl-red.
 */
export function MatchRow({ match, viewerPlayerId }: MatchRowProps) {
  const participants = (match.participants ?? []) as unknown as
    | ParticipantSlim[]
    | null;
  const teamA = participants?.filter((p) => p.team === "a") ?? [];
  const teamB = participants?.filter((p) => p.team === "b") ?? [];
  const dateLabel = formatDate(match.played_at);
  const winnerSide = match.winning_team;

  return (
    <Link
      to={`/tran-dau/${match.slug}`}
      style={{
        display: "block",
        padding: "16px 0",
        textDecoration: "none",
        color: "inherit",
      }}
      aria-label={`Xem trận ngày ${dateLabel}`}
    >
      <div
        className="tl-caps"
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.06em",
          color: "var(--tl-fg-3)",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span>{dateLabel}</span>
        {match.venue_name && (
          <>
            <span style={{ color: "var(--tl-fg-4)" }}>·</span>
            <span style={{ textTransform: "none", letterSpacing: 0 }}>
              {match.venue_name}
            </span>
          </>
        )}
        <span style={{ color: "var(--tl-fg-4)" }}>·</span>
        <span>{FORMAT_LABELS[match.format] ?? match.format}</span>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontWeight: 600,
            color: match.player_won ? "var(--tl-green)" : "var(--tl-red, #ef4444)",
          }}
        >
          {match.player_won ? "W" : "L"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <TeamRow
          players={teamA}
          score={match.team_a_score ?? []}
          isWinner={winnerSide === "a"}
          highlightId={viewerPlayerId}
        />
        <TeamRow
          players={teamB}
          score={match.team_b_score ?? []}
          isWinner={winnerSide === "b"}
          highlightId={viewerPlayerId}
        />
      </div>
    </Link>
  );
}

interface TeamRowProps {
  players: ParticipantSlim[];
  score: number[];
  isWinner: boolean;
  highlightId: string;
}
function TeamRow({ players, score, isWinner, highlightId }: TeamRowProps) {
  const names = players.map((p) => p.display_name ?? p.username ?? "—");
  const containsViewer = players.some((p) => p.player_id === highlightId);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 12,
        fontSize: 16,
        fontFamily: "'Instrument Serif', serif",
        fontStyle: containsViewer ? "italic" : "normal",
        color: isWinner ? "var(--tl-fg)" : "var(--tl-fg-3)",
        fontWeight: containsViewer ? 500 : 400,
      }}
    >
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {names.join(" / ") || "—"}
      </span>
      <span
        className="tl-tnum"
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontStyle: "normal",
          fontVariantNumeric: "tabular-nums",
          fontSize: 14,
        }}
      >
        {score.length === 0 ? "—" : score.join(" – ")}
      </span>
    </div>
  );
}

/** "DD/MM/YY" — Vietnamese convention. */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
  } catch {
    return iso;
  }
}

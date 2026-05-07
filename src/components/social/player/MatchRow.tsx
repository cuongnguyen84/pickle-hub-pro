import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
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

export function MatchRow({ match, viewerPlayerId }: MatchRowProps) {
  const participants = (match.participants ?? []) as unknown as
    | ParticipantSlim[]
    | null;
  const teamA = participants?.filter((p) => p.team === "a") ?? [];
  const teamB = participants?.filter((p) => p.team === "b") ?? [];

  const dateLabel = formatDate(match.played_at);
  const winnerSide = match.winning_team; // 'a' | 'b' | null

  return (
    <Link
      to={`/tran-dau/${match.slug}`}
      className="group block rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/30"
      aria-label={`Xem trận ngày ${dateLabel}`}
    >
      <header className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 truncate">
          <span>{dateLabel}</span>
          {match.venue_name && <span className="truncate">· {match.venue_name}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
            {FORMAT_LABELS[match.format] ?? match.format}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
              match.player_won
                ? "bg-green-500/15 text-green-700 dark:text-green-400"
                : "bg-red-500/15 text-red-700 dark:text-red-400"
            }`}
          >
            {match.player_won ? "W" : "L"}
          </span>
        </div>
      </header>

      <div className="mt-2 space-y-1">
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

      <div className="mt-2 flex justify-end text-xs text-muted-foreground transition-opacity group-hover:text-foreground">
        Xem chi tiết <ArrowRight className="ml-1 inline h-3 w-3" />
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
      className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm ${
        isWinner ? "bg-primary/5" : ""
      } ${containsViewer ? "font-semibold text-foreground" : "text-muted-foreground"}`}
    >
      <span className="truncate">{names.join(" / ") || "—"}</span>
      <span className="font-mono tabular-nums">
        {score.length === 0 ? "—" : score.join("-")}
      </span>
    </div>
  );
}

/** "DD/MM/YY" format — Vietnamese convention, compact. */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
  } catch {
    return iso;
  }
}

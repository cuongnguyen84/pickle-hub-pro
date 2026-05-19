// ============================================================================
// MatchScoreboard — Sprint 2 Phase 3B.1
// Team A top, scores grid, Team B bottom. Winner highlight.
// ============================================================================

import { Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import type { MatchDetail, MatchParticipant } from "@/hooks/social";

const initials = (name: string) =>
  name.split(/\s+/).map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();

const PlayerCell = ({ p }: { p: MatchParticipant }) => {
  const label = p.display_name ?? p.username ?? "?";
  const usernameLink = p.username ? `/nguoi-choi/${p.username}` : null;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={p.avatar_url ?? undefined} alt={label} />
        <AvatarFallback className="text-xs">{initials(label)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {usernameLink ? (
            <Link to={usernameLink} className="hover:text-social-primary hover:underline">
              {label}
            </Link>
          ) : (
            label
          )}
          {p.is_ghost && (
            <Badge variant="outline" className="ml-1 px-1 py-0 text-[10px]">ghost</Badge>
          )}
        </div>
        {p.dupr_doubles && (
          <div className="text-xs text-muted-foreground">DUPR {p.dupr_doubles}</div>
        )}
      </div>
    </div>
  );
};

export const MatchScoreboard = ({ match }: { match: MatchDetail }) => {
  const { language } = useI18n();
  const teamA = match.participants.filter((p) => p.team === "a").sort((a, b) => (a.position ?? 1) - (b.position ?? 1));
  const teamB = match.participants.filter((p) => p.team === "b").sort((a, b) => (a.position ?? 1) - (b.position ?? 1));
  const aWon = match.winning_team === "a";
  const games = Math.max(match.team_a_score.length, match.team_b_score.length);

  const TeamRow = ({
    team,
    isWinner,
    players,
    scores,
  }: {
    team: "a" | "b";
    isWinner: boolean;
    players: MatchParticipant[];
    scores: number[];
  }) => (
    <div
      className={cn(
        "rounded-2xl border-2 p-4 transition-colors",
        isWinner
          ? "border-social-primary bg-social-primary/5"
          : "border-border bg-card",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {language === "vi" ? "Đội" : "Team"} {team.toUpperCase()}
          </span>
          {isWinner && (
            <Badge className="bg-social-primary text-white hover:bg-social-primary-dark gap-1">
              <Trophy className="h-3 w-3" /> {language === "vi" ? "THẮNG" : "WINNER"}
            </Badge>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        {players.map((p) => <PlayerCell key={p.player_id} p={p} />)}
      </div>
      <div className="flex items-center gap-2 border-t pt-3">
        {Array.from({ length: games }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-lg border-2 py-2 text-center font-mono text-3xl font-bold",
              isWinner
                ? "border-social-primary bg-social-primary/10 text-social-primary"
                : "border-border text-muted-foreground",
            )}
            style={{ fontFamily: "JetBrains Mono, ui-monospace, monospace" }}
          >
            {scores[i] ?? 0}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <TeamRow team="a" isWinner={aWon}  players={teamA} scores={match.team_a_score} />
      <TeamRow team="b" isWinner={!aWon} players={teamB} scores={match.team_b_score} />
    </div>
  );
};

export default MatchScoreboard;

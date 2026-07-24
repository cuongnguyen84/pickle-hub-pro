import { useI18n } from "@/i18n";
import type { DashboardMatch } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";

interface MatchContextProps {
  match: DashboardMatch;
  className?: string;
}

export const MatchContext = ({ match, className }: MatchContextProps) => {
  const { t } = useI18n();
  const parts: string[] = [];

  if (match.phase === "group") {
    parts.push(
      match.groupName
        ? `${t.dashboard.group} ${match.groupName}`
        : t.dashboard.groupStage,
    );
  } else if (match.phase === "winners") {
    parts.push(t.dashboard.winnersBracket);
  } else if (match.phase === "losers") {
    parts.push(t.dashboard.losersBracket);
  } else if (match.phase === "final") {
    parts.push(t.dashboard.final);
  } else if (match.phase === "playoff") {
    parts.push(t.dashboard.playoff);
  }

  if (match.roundNumber != null) {
    parts.push(`${t.dashboard.round} ${match.roundNumber}`);
  }

  if (match.matchNumber != null) {
    parts.push(`${t.dashboard.match} ${match.matchNumber}`);
  }

  if (parts.length === 0) return null;

  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      {parts.join(" · ")}
    </span>
  );
};

// ============================================================================
// StatsGrid — 4-card overview row on /u/:slug page.
// ----------------------------------------------------------------------------
// Events / Matches / Wins (% win-rate) / Current streak. The streak comes
// from the parent (computed against compute_player_win_streak via the
// page query), not from player_stats — the view doesn't carry streak.
// ============================================================================

import { Card } from "@/components/ui/card";
import { useI18n } from "@/i18n";

interface Props {
  eventsPlayed: number;
  matchesPlayed: number;
  wins: number;
  currentStreak: number;
}

function StatCard({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: string;
  secondary?: string;
}) {
  return (
    <Card className="p-4 text-center">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-semibold">{primary}</p>
      {secondary && (
        <p className="mt-1 text-xs text-muted-foreground">{secondary}</p>
      )}
    </Card>
  );
}

export function StatsGrid({ eventsPlayed, matchesPlayed, wins, currentStreak }: Props) {
  const { t } = useI18n();
  const stats = t.socialEvents.profile.stats;
  const winRate =
    matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label={stats.eventsLabel} primary={String(eventsPlayed)} />
      <StatCard label={stats.matchesLabel} primary={String(matchesPlayed)} />
      <StatCard
        label={stats.winsLabel}
        primary={String(wins)}
        secondary={matchesPlayed > 0 ? `${winRate}%` : undefined}
      />
      <StatCard label={stats.streakLabel} primary={String(currentStreak)} />
    </div>
  );
}

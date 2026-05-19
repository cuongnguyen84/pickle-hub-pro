import { useI18n } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MatchItem {
  id: string;
  teamA: string;
  teamB: string;
  scoreA: number | null;
  scoreB: number | null;
  status: string;
  displayOrder: number;
}

interface TeamMatchDashboardProps {
  liveMatches: MatchItem[];
  nextMatches: MatchItem[];
  compact?: boolean;
}

export const TeamMatchDashboard = ({ liveMatches, nextMatches, compact }: TeamMatchDashboardProps) => {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {/* Live matches */}
      {liveMatches.length > 0 && (
        <div>
          <h3 className={`font-semibold mb-3 flex items-center gap-2 ${compact ? "text-sm" : "text-base"}`}>
            <Badge variant="destructive" className="animate-pulse text-xs">LIVE</Badge>
            {t.dashboard.liveMatches}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveMatches.map((m) => (
              <Card key={m.id} className="border-primary/30 shadow-md shadow-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate flex-1">{m.teamA}</span>
                    <div className="flex items-center gap-1 text-lg font-bold tabular-nums shrink-0">
                      <span>{m.scoreA ?? 0}</span>
                      <span className="text-muted-foreground text-xs">-</span>
                      <span>{m.scoreB ?? 0}</span>
                    </div>
                    <span className="font-semibold text-sm truncate flex-1 text-right">{m.teamB}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Next matches */}
      {nextMatches.length > 0 && (
        <div>
          <h3 className={`font-semibold mb-3 ${compact ? "text-sm" : "text-base"}`}>
            {t.dashboard.upNext}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {nextMatches.map((m) => (
              <Card key={m.id} className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm truncate flex-1">{m.teamA}</span>
                    <span className="text-xs text-muted-foreground">{t.dashboard.vs}</span>
                    <span className="text-sm truncate flex-1 text-right">{m.teamB}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {liveMatches.length === 0 && nextMatches.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {t.dashboard.noActiveTournaments}
        </div>
      )}
    </div>
  );
};

import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CourtData } from "@/hooks/useDashboardData";

interface CourtCardProps {
  court: CourtData;
  compact?: boolean;
}

export const CourtCard = ({ court, compact }: CourtCardProps) => {
  const { t } = useI18n();

  const hasLive = !!court.liveMatch;
  const hasNext = !!court.nextMatch;

  return (
    <Card className={`h-full transition-all duration-300 ${hasLive ? "border-primary/50 shadow-lg shadow-primary/10" : ""}`}>
      <CardHeader className={compact ? "pb-1 pt-3 px-3" : "pb-2"}>
        <div className="flex items-center justify-between">
          <CardTitle className={compact ? "text-sm" : "text-base"}>
            {t.dashboard.court} {court.courtNumber}
          </CardTitle>
          {hasLive ? (
            <Badge variant="destructive" className="animate-pulse text-xs">
              LIVE
            </Badge>
          ) : hasNext ? (
            <Badge variant="secondary" className="text-xs">{t.dashboard.nextMatch}</Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {t.dashboard.available}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className={compact ? "px-3 pb-3 space-y-2" : "space-y-3"}>
        {/* Live match */}
        {court.liveMatch && (
          <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
            <div className="text-xs text-primary font-medium mb-1">{t.dashboard.nowPlaying}</div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm truncate flex-1">{court.liveMatch.teamA}</span>
              <div className="flex items-center gap-1 text-lg font-bold tabular-nums">
                <span>{court.liveMatch.scoreA ?? 0}</span>
                <span className="text-muted-foreground text-xs">-</span>
                <span>{court.liveMatch.scoreB ?? 0}</span>
              </div>
              <span className="font-semibold text-sm truncate flex-1 text-right">{court.liveMatch.teamB}</span>
            </div>
          </div>
        )}

        {/* Next match */}
        {court.nextMatch && (
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">{t.dashboard.nextMatch}</span>
              {court.nextMatch.startTime && (
                <span className="text-xs text-muted-foreground">{court.nextMatch.startTime}</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm truncate flex-1">{court.nextMatch.teamA}</span>
              <span className="text-xs text-muted-foreground">{t.dashboard.vs}</span>
              <span className="text-sm truncate flex-1 text-right">{court.nextMatch.teamB}</span>
            </div>
          </div>
        )}

        {/* Empty court */}
        {!hasLive && !hasNext && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            {t.dashboard.available}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

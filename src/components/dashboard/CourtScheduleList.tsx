import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import type { CourtData, DashboardMatch } from "@/hooks/useDashboardData";
import { isDashboardMatchLive } from "@/lib/dashboard-courts";
import { CalendarClock } from "lucide-react";
import { MatchContext } from "./MatchContext";

interface CourtScheduleListProps {
  courts: CourtData[];
  matches: DashboardMatch[];
}

const MatchStatus = ({ match }: { match: DashboardMatch }) => {
  const { t } = useI18n();

  if (isDashboardMatchLive(match)) {
    return (
      <Badge variant="destructive" className="text-[10px]">
        LIVE
      </Badge>
    );
  }

  if (match.status === "completed") {
    return (
      <Badge variant="outline" className="text-[10px]">
        {t.dashboard.completed}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="text-[10px]">
      {t.dashboard.scheduled}
    </Badge>
  );
};

export const CourtScheduleList = ({
  courts,
  matches,
}: CourtScheduleListProps) => {
  const { t } = useI18n();
  const matchesByCourt = new Map<number, DashboardMatch[]>();

  courts.forEach((court) => matchesByCourt.set(court.courtNumber, []));
  matches.forEach((match) => {
    const courtMatches = matchesByCourt.get(match.courtNumber);
    if (courtMatches) courtMatches.push(match);
  });
  matchesByCourt.forEach((courtMatches) => {
    courtMatches.sort((a, b) => a.displayOrder - b.displayOrder);
  });

  if (courts.length === 0) return null;

  return (
    <section className="mt-8" aria-labelledby="court-schedule-title">
      <div className="mb-4 flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h2 id="court-schedule-title" className="text-lg font-semibold">
            {t.dashboard.courtSchedule}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t.dashboard.courtScheduleDescription}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {courts.map((court) => {
          const courtMatches = matchesByCourt.get(court.courtNumber) ?? [];
          return (
            <Card key={court.courtNumber} className="overflow-hidden">
              <CardHeader className="border-b py-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">
                    {court.courtName || `${t.dashboard.court} ${court.courtNumber}`}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {t.dashboard.matchCount.replace("{count}", String(courtMatches.length))}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {courtMatches.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {t.dashboard.noCourtMatches}
                  </p>
                ) : (
                  <ol className="divide-y">
                    {courtMatches.map((match) => (
                      <li key={match.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {match.startTime && (
                                <span className="text-xs font-semibold tabular-nums text-foreground">
                                  {match.startTime}
                                </span>
                              )}
                              <MatchContext match={match} />
                            </div>
                            <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 text-sm">
                              <span className="min-w-0 whitespace-normal break-words font-medium leading-5">
                                {match.teamA}
                              </span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {t.dashboard.vs}
                              </span>
                              <span className="min-w-0 whitespace-normal break-words text-right font-medium leading-5">
                                {match.teamB}
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <MatchStatus match={match} />
                            {(isDashboardMatchLive(match) || match.status === "completed") && (
                              <span className="text-sm font-bold tabular-nums">
                                {match.scoreA ?? 0}–{match.scoreB ?? 0}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
};

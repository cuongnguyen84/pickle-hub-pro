import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { MainLayout } from "@/components/layout";
import { DynamicMeta } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { CourtCard, TeamMatchDashboard, TVModeView } from "@/components/dashboard";
import { useDashboardData, type DashboardType } from "@/hooks/useDashboardData";
import { useDashboardSound } from "@/hooks/useDashboardSound";
import { ArrowLeft, Monitor, Volume2, VolumeX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const TournamentDashboard = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [tvMode, setTvMode] = useState(false);
  const { soundEnabled, toggleSound } = useDashboardSound();

  const dashType = (type as DashboardType) || "quick-table";
  const { tournamentInfo, courts, teamMatchData, isLoading } = useDashboardData(dashType, id || "");

  const tournamentName = (tournamentInfo.data as any)?.name || "";

  // Fullscreen API
  const enterTvMode = useCallback(() => {
    setTvMode(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const exitTvMode = useCallback(() => {
    setTvMode(false);
    document.exitFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setTvMode(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  if (tvMode) {
    return (
      <TVModeView
        tournamentName={tournamentName}
        courts={courts}
        liveMatches={dashType === "team-match" ? teamMatchData.liveMatches : undefined}
        nextMatches={dashType === "team-match" ? teamMatchData.nextMatches : undefined}
        onExit={exitTvMode}
      />
    );
  }

  return (
    <MainLayout>
      <DynamicMeta
        title={`${t.dashboard.title} – ${tournamentName || "..."}`}
        description={t.dashboard.description}
      />
      <div className="container-wide py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/tools/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold truncate">{tournamentName || <Skeleton className="h-7 w-48" />}</h1>
              <p className="text-sm text-muted-foreground">{t.dashboard.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleSound}>
              {soundEnabled ? <Volume2 className="w-4 h-4 mr-1" /> : <VolumeX className="w-4 h-4 mr-1" />}
              {soundEnabled ? t.dashboard.soundOn : t.dashboard.soundOff}
            </Button>
            <Button variant="default" size="sm" onClick={enterTvMode}>
              <Monitor className="w-4 h-4 mr-1" />
              {t.dashboard.tvMode}
            </Button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        )}

        {/* Court-based view (Quick Table, Doubles Elimination) */}
        {!isLoading && dashType !== "team-match" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {courts.map((court) => (
              <CourtCard key={court.courtNumber} court={court} />
            ))}
            {courts.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                {t.dashboard.noActiveTournaments}
              </div>
            )}
          </div>
        )}

        {/* Team Match view */}
        {!isLoading && dashType === "team-match" && (
          <TeamMatchDashboard
            liveMatches={teamMatchData.liveMatches}
            nextMatches={teamMatchData.nextMatches}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default TournamentDashboard;

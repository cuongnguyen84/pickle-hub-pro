import { useI18n } from "@/i18n";
import { MainLayout } from "@/components/layout";
import { DynamicMeta } from "@/components/seo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Monitor, Users, Swords, GitBranch } from "lucide-react";
import { useActiveTournaments, type DashboardType } from "@/hooks/useDashboardData";

const typeIcons: Record<DashboardType, React.ReactNode> = {
  "quick-table": <Users className="w-5 h-5" />,
  "team-match": <Swords className="w-5 h-5" />,
  "doubles-elimination": <GitBranch className="w-5 h-5" />,
};

const DashboardPicker = () => {
  const { t } = useI18n();
  const { data: tournaments, isLoading } = useActiveTournaments();

  const getLink = (tour: { type: DashboardType; id: string; shareId?: string }) => {
    if (tour.type === "team-match") {
      return `/tools/dashboard/team-match/${tour.id}`;
    }
    return `/tools/dashboard/${tour.type}/${tour.shareId || tour.id}`;
  };

  const getTypeLabel = (type: DashboardType) => {
    if (type === "quick-table") return t.dashboard.quickTable;
    if (type === "team-match") return t.dashboard.teamMatch;
    return t.dashboard.doublesElimination;
  };

  return (
    <MainLayout>
      <DynamicMeta
        title={`${t.dashboard.title} – The PickleHub`}
        description={t.dashboard.description}
        url="https://thepicklehub.net/tools/dashboard"
      />
      <div className="container-wide py-8">
        <div className="flex items-center gap-3 mb-6">
          <Monitor className="w-6 h-6 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">{t.dashboard.title}</h1>
        </div>
        <p className="text-muted-foreground mb-8">{t.dashboard.selectTournament}</p>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && (!tournaments || tournaments.length === 0) && (
          <div className="text-center py-16 text-muted-foreground">
            <Monitor className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>{t.dashboard.noActiveTournaments}</p>
          </div>
        )}

        {tournaments && tournaments.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tournaments.map((tour) => (
              <Link key={`${tour.type}-${tour.id}`} to={getLink(tour)}>
                <Card className="h-full hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 cursor-pointer transition-all">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-primary">
                        {typeIcons[tour.type]}
                        <Badge variant="secondary" className="text-xs">{getTypeLabel(tour.type)}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-base">{tour.name}</CardTitle>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default DashboardPicker;

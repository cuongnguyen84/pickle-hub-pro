import { MainLayout } from "@/components/layout";
import { EmptyState } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { useTournaments } from "@/hooks/useSupabaseData";
import { Trophy, Calendar, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const Tournaments = () => {
  const { t } = useI18n();
  const { data: tournaments = [], isLoading } = useTournaments();

  const ongoingTournaments = tournaments.filter((t) => t.status === "ongoing");
  const upcomingTournaments = tournaments.filter((t) => t.status === "upcoming");
  const endedTournaments = tournaments.filter((t) => t.status === "ended");

  const TournamentCard = ({ tournament }: { tournament: typeof tournaments[0] }) => {
    const statusColors = {
      ongoing: "bg-live text-foreground",
      upcoming: "bg-primary text-primary-foreground",
      ended: "bg-muted text-foreground-muted",
    };

    const statusText = {
      ongoing: t.tournament.ongoing,
      upcoming: t.tournament.upcoming,
      ended: t.tournament.ended,
    };

    return (
      <Link
        to={`/tournament/${tournament.slug}`}
        className="group block rounded-xl overflow-hidden card-interactive bg-background-surface p-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  "px-2 py-0.5 rounded-md text-xs font-medium",
                  statusColors[tournament.status]
                )}
              >
                {statusText[tournament.status]}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {tournament.name}
            </h3>
            {tournament.description && (
              <p className="text-sm text-foreground-muted line-clamp-2 mt-1">
                {tournament.description}
              </p>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-foreground-muted">
              {tournament.start_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    {format(new Date(tournament.start_date), "dd/MM/yyyy")}
                    {tournament.end_date && ` - ${format(new Date(tournament.end_date), "dd/MM/yyyy")}`}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
        </div>
      </Link>
    );
  };

  const TournamentGrid = ({ items }: { items: typeof tournaments }) => {
    if (items.length === 0) {
      return <EmptyState icon={Trophy} title={t.common.noResults} />;
    }
    return (
      <div className="grid gap-4">
        {items.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament} />
        ))}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="container-wide py-8">
        <h1 className="text-2xl font-semibold mb-8">{t.nav.tournaments}</h1>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="ongoing" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="ongoing">
                {t.tournament.ongoing} ({ongoingTournaments.length})
              </TabsTrigger>
              <TabsTrigger value="upcoming">
                {t.tournament.upcoming} ({upcomingTournaments.length})
              </TabsTrigger>
              <TabsTrigger value="ended">
                {t.tournament.ended} ({endedTournaments.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="ongoing">
              <TournamentGrid items={ongoingTournaments} />
            </TabsContent>
            <TabsContent value="upcoming">
              <TournamentGrid items={upcomingTournaments} />
            </TabsContent>
            <TabsContent value="ended">
              <TournamentGrid items={endedTournaments} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
};

export default Tournaments;

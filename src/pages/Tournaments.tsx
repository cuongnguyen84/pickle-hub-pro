import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout";
import { EmptyState } from "@/components/content";
import { SearchBar } from "@/components/search";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { useTournaments } from "@/hooks/useSupabaseData";
import { useDebounce } from "@/hooks/useSearch";
import { Trophy, Calendar, ChevronRight, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const Tournaments = () => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery.toLowerCase().trim(), 300);

  const { data: tournaments = [], isLoading } = useTournaments();

  // Filter tournaments by search
  const filteredTournaments = useMemo(() => {
    if (!debouncedSearch) return tournaments;
    return tournaments.filter((tournament) => {
      const name = tournament.name?.toLowerCase() ?? "";
      const description = tournament.description?.toLowerCase() ?? "";
      return name.includes(debouncedSearch) || description.includes(debouncedSearch);
    });
  }, [tournaments, debouncedSearch]);

  const ongoingTournaments = filteredTournaments.filter((t) => t.status === "ongoing");
  const upcomingTournaments = filteredTournaments.filter((t) => t.status === "upcoming");
  const endedTournaments = filteredTournaments.filter((t) => t.status === "ended");

  const hasSearch = debouncedSearch.length > 0;
  const hasResults = filteredTournaments.length > 0;

  const TournamentCard = ({ tournament }: { tournament: typeof tournaments[0] }) => {
    const statusConfig = {
      ongoing: {
        color: "bg-live/90 text-foreground border-live/50",
        text: t.tournament.ongoing,
        dotClass: "bg-foreground animate-pulse",
      },
      upcoming: {
        color: "bg-primary/90 text-primary-foreground border-primary/50",
        text: t.tournament.upcoming,
        dotClass: null,
      },
      ended: {
        color: "bg-muted text-foreground-muted border-border",
        text: t.tournament.ended,
        dotClass: null,
      },
    };

    const config = statusConfig[tournament.status];

    return (
      <Link
        to={`/tournament/${tournament.slug}`}
        className="group block rounded-xl overflow-hidden card-interactive bg-background-surface border border-border-subtle hover:border-border"
      >
        <div className="p-5">
          <div className="flex items-start gap-4">
            {/* Trophy Icon */}
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-7 h-7 text-primary" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge 
                  variant="outline"
                  className={cn(
                    "px-2 py-0.5 text-xs font-medium border",
                    config.color
                  )}
                >
                  {config.dotClass && (
                    <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", config.dotClass)} />
                  )}
                  {config.text}
                </Badge>
              </div>

              <h3 className="text-lg font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors mb-2">
                {tournament.name}
              </h3>

              {tournament.description && (
                <p className="text-sm text-foreground-muted line-clamp-2 mb-3">
                  {tournament.description}
                </p>
              )}

              {(tournament.start_date || tournament.end_date) && (
                <div className="flex items-center gap-1.5 text-sm text-foreground-secondary">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {tournament.start_date && format(new Date(tournament.start_date), "dd/MM/yyyy")}
                    {tournament.start_date && tournament.end_date && " – "}
                    {tournament.end_date && format(new Date(tournament.end_date), "dd/MM/yyyy")}
                  </span>
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </div>
          </div>
        </div>
      </Link>
    );
  };

  const TournamentGrid = ({ items }: { items: typeof tournaments }) => {
    if (items.length === 0) {
      return (
        <EmptyState 
          icon={Trophy} 
          title={t.common.noResults}
          description={t.tournament.checkBackLater}
        />
      );
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
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            {t.nav.tournaments}
          </h1>
          <p className="text-foreground-muted">
            {t.home.hero.description}
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            className="max-w-md"
          />
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-80 mb-6" />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : !hasResults && hasSearch ? (
          <EmptyState icon={Search} title={t.search.noResults} />
        ) : (
          <Tabs defaultValue="ongoing" className="w-full">
            <TabsList className="mb-6 h-auto p-1 bg-background-surface">
              <TabsTrigger value="ongoing" className="gap-2">
                <span className="w-2 h-2 rounded-full bg-live animate-pulse" />
                {t.tournament.ongoing}
                <span className="px-1.5 py-0.5 rounded-full bg-muted text-foreground-muted text-xs">
                  {ongoingTournaments.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="gap-2">
                {t.tournament.upcoming}
                <span className="px-1.5 py-0.5 rounded-full bg-muted text-foreground-muted text-xs">
                  {upcomingTournaments.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="ended" className="gap-2">
                {t.tournament.ended}
                <span className="px-1.5 py-0.5 rounded-full bg-muted text-foreground-muted text-xs">
                  {endedTournaments.length}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ongoing" className="mt-0">
              <TournamentGrid items={ongoingTournaments} />
            </TabsContent>
            <TabsContent value="upcoming" className="mt-0">
              <TournamentGrid items={upcomingTournaments} />
            </TabsContent>
            <TabsContent value="ended" className="mt-0">
              <TournamentGrid items={endedTournaments} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
};

export default Tournaments;

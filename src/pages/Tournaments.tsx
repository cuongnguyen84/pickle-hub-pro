import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout";
import { EmptyState } from "@/components/content";
import { SearchBar } from "@/components/search";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { useTournaments, useOpenRegistrationTables, useUserRegisteredTournaments, useUserCompletedTournaments } from "@/hooks/useSupabaseData";
import { useDebounce } from "@/hooks/useSearch";
import { useAuth } from "@/hooks/useAuth";
import { Trophy, Calendar, ChevronRight, Search, Users, ClipboardList, CheckCircle2, Clock, User } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { DynamicMeta } from "@/components/seo";

const Tournaments = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery.toLowerCase().trim(), 300);

  const { data: tournaments = [], isLoading } = useTournaments();
  const { data: openRegistrationTables = [], isLoading: openRegLoading } = useOpenRegistrationTables();
  const { data: registeredTournaments = [], isLoading: registeredLoading } = useUserRegisteredTournaments(user?.id);
  const { data: completedTournaments = [], isLoading: completedLoading } = useUserCompletedTournaments(user?.id);

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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "setup":
        return t.quickTable.status.setup;
      case "group_stage":
        return t.quickTable.status.groupStage;
      case "playoff":
        return t.quickTable.status.playoff;
      case "completed":
        return t.quickTable.status.completed;
      default:
        return status;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" => {
    switch (status) {
      case "completed":
        return "default";
      case "playoff":
      case "group_stage":
        return "secondary";
      default:
        return "outline";
    }
  };

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
      <DynamicMeta 
        title="Pickleball Tournament Software for Organizers"
        description="Professional pickleball tournament software for organizers. Create brackets, manage team matches, run round robin tournaments, and livestream your pickleball events with ThePickleHub."
        url="https://thepicklehub.net/tournaments"
      />
      <div className="container-wide py-8">
        {/* SEO Header */}
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            {t.tournament.hubTitle}
          </h1>
          <p className="text-foreground-secondary max-w-3xl">
            {t.tournament.hubDescription}
          </p>
        </header>


        {/* Search Bar */}
        <div className="mb-8">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            className="max-w-md"
          />
        </div>

        {/* User's Registered Tournaments Section */}
        {user && registeredTournaments.length > 0 && (
          <Card className="mb-6">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-foreground">{t.quickTable.yourRegisteredTournaments}</h2>
              </div>
            </div>
            <div className="px-4 pb-4 space-y-2">
              {registeredTournaments.map((tournament: any) => (
                <Link
                  key={tournament.id}
                  to={`/quick-tables/${tournament.share_id}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-green-600/10 flex items-center justify-center flex-shrink-0">
                      <Trophy className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{tournament.name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {tournament.is_doubles ? (
                          <Badge variant="secondary" className="gap-1 text-xs bg-blue-100 text-blue-700 border-blue-200">
                            <Users className="w-3 h-3" />
                            <span>{tournament.player_count} đôi</span>
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 text-xs bg-orange-100 text-orange-700 border-orange-200">
                            <User className="w-3 h-3" />
                            <span>{tournament.player_count} người</span>
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-13 sm:pl-0">
                    <Badge 
                      variant={tournament.registrationStatus === 'approved' ? 'default' : 'outline'}
                      className={cn("text-xs", tournament.registrationStatus === 'approved' ? 'bg-green-600' : '')}
                    >
                      {tournament.registrationStatus === 'approved' ? t.quickTable.approved : t.quickTable.pending}
                    </Badge>
                    <Badge variant={getStatusVariant(tournament.status)} className="text-xs">{getStatusLabel(tournament.status)}</Badge>
                    <ChevronRight className="w-4 h-4 text-foreground-muted flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* User's Completed Tournaments Section */}
        {user && completedTournaments.length > 0 && (
          <Card className="mb-6">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-foreground-muted" />
                <h2 className="text-lg font-semibold text-foreground">{t.quickTable.yourCompletedTournaments}</h2>
              </div>
            </div>
            <div className="px-4 pb-4 space-y-2">
              {completedTournaments.slice(0, 5).map((tournament: any) => (
                <Link
                  key={tournament.id}
                  to={`/quick-tables/${tournament.share_id}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Trophy className="w-5 h-5 text-foreground-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{tournament.name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {tournament.is_doubles ? (
                          <Badge variant="secondary" className="gap-1 text-xs bg-blue-100 text-blue-700 border-blue-200">
                            <Users className="w-3 h-3" />
                            <span>{tournament.player_count} đôi</span>
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 text-xs bg-orange-100 text-orange-700 border-orange-200">
                            <User className="w-3 h-3" />
                            <span>{tournament.player_count} người</span>
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-13 sm:pl-0">
                    <Badge variant="default" className="text-xs">{t.quickTable.status.completed}</Badge>
                    <ChevronRight className="w-4 h-4 text-foreground-muted flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* Open Registration Section */}
        {openRegistrationTables.length > 0 && (
          <Card className="mb-6">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">{t.quickTable.openRegistrationTournaments}</h2>
              </div>
            </div>
            <div className="px-4 pb-4 space-y-2">
              {openRegistrationTables.slice(0, 5).map((table) => (
                <Link
                  key={table.id}
                  to={`/quick-tables/${table.share_id}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{table.name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {table.is_doubles ? (
                          <Badge variant="secondary" className="gap-1 text-xs bg-blue-100 text-blue-700 border-blue-200">
                            <Users className="w-3 h-3" />
                            <span>{table.player_count} đôi</span>
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 text-xs bg-orange-100 text-orange-700 border-orange-200">
                            <User className="w-3 h-3" />
                            <span>{table.player_count} người</span>
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-13 sm:pl-0">
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 whitespace-nowrap">
                      {t.tournament.openRegistration}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-foreground-muted flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

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

        {/* SEO Content Section - moved to bottom */}
        <section className="mt-12 p-6 rounded-xl bg-background-surface border border-border-subtle">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            {t.tournament.seo.createTitle}
          </h2>
          <p className="text-foreground-secondary mb-4">
            {t.tournament.seo.createDesc}{" "}
            <Link to="/tools/quick-tables" className="text-primary hover:underline">{t.tools.quickTable.title}</Link>
          </p>
          
          <h2 className="text-lg font-semibold text-foreground mb-3">
            {t.tournament.seo.formatsTitle}
          </h2>
          <p className="text-foreground-secondary mb-4">
            {t.tournament.seo.formatsDesc}{" "}
            <Link to="/tools/team-match" className="text-primary hover:underline">{t.tools.teamMatch.title}</Link>{" "}
            <Link to="/livestream" className="text-primary hover:underline">{t.live.hubTitle}</Link>
          </p>

          <h2 className="text-lg font-semibold text-foreground mb-3">
            {t.tournament.seo.builtTitle}
          </h2>
          <p className="text-foreground-secondary">
            {t.tournament.seo.builtDesc}
          </p>
        </section>
      </div>
    </MainLayout>
  );
};

export default Tournaments;

import { useState, useMemo, useEffect } from "react";
import { MainLayout } from "@/components/layout";
import { EmptyState } from "@/components/content";
import { SearchBar } from "@/components/search";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { useTournaments, useActivePublicQuickTables, useUserRegisteredTournaments, useUserCompletedTournaments, useOpenTeamMatchTournaments, useCompletedPublicQuickTables, useCompletedTeamMatchTournaments, useActiveDoublesElimination, useCompletedDoublesElimination, useActiveFlexTournaments, useCompletedFlexTournaments } from "@/hooks/useSupabaseData";
import { useDebounce } from "@/hooks/useSearch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Calendar, ChevronRight, Search, Users, ClipboardList, CheckCircle2, Clock, User, Mail, MapPin, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { DynamicMeta, HreflangTags } from "@/components/seo";
import { TournamentFormatSection } from "@/components/tournaments";
import type { ParentTournamentWithPreview, SubEventPreview } from "@/hooks/useParentTournament";
import ParentTournamentCard from "@/components/quicktable/ParentTournamentCard";

/**
 * Legacy Tournaments page — archived 2026-04-27 during sub-route cutover.
 * Accessible at /tournaments-legacy for 14-day rollback. Cleanup 2026-05-09.
 */
const TournamentsLegacy = () => {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery.toLowerCase().trim(), 300);
  const [parentTournaments, setParentTournaments] = useState<ParentTournamentWithPreview[]>([]);

  const { data: tournaments = [], isLoading } = useTournaments();
  const { data: activeQuickTables = [] } = useActivePublicQuickTables();
  const { data: openTeamMatchTournaments = [] } = useOpenTeamMatchTournaments();
  const { data: completedQuickTables = [] } = useCompletedPublicQuickTables({ limit: 50 });
  const { data: completedTeamMatches = [] } = useCompletedTeamMatchTournaments({ limit: 50 });
  const { data: activeDoubles = [] } = useActiveDoublesElimination({ limit: 50 });
  const { data: completedDoubles = [] } = useCompletedDoublesElimination({ limit: 50 });
  const { data: activeFlex = [] } = useActiveFlexTournaments({ limit: 50 });
  const { data: completedFlex = [] } = useCompletedFlexTournaments({ limit: 50 });
  const { data: registeredTournaments = [] } = useUserRegisteredTournaments(user?.id);
  const { data: completedTournaments = [] } = useUserCompletedTournaments(user?.id);

  useEffect(() => {
    const loadParents = async () => {
      const { data: parents } = await supabase
        .from('parent_tournaments')
        .select('*')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);
      if (!parents || parents.length === 0) {
        setParentTournaments([]);
        return;
      }
      const parentIds = parents.map(p => p.id);
      const { data: subEvents } = await supabase
        .from('quick_tables')
        .select('id, name, status, share_id, parent_tournament_id, created_at')
        .in('parent_tournament_id', parentIds);

      const statusPriority: Record<string, number> = {
        group_stage: 0, playoff: 1, setup: 2, completed: 3,
      };
      const grouped = new Map<string, SubEventPreview[]>();
      const counts = new Map<string, number>();
      for (const se of (subEvents || [])) {
        const pid = se.parent_tournament_id as string;
        if (!grouped.has(pid)) grouped.set(pid, []);
        grouped.get(pid)!.push({ id: se.id, name: se.name, status: se.status, share_id: se.share_id });
        counts.set(pid, (counts.get(pid) || 0) + 1);
      }
      for (const [pid, events] of grouped) {
        events.sort((a, b) => (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99));
        grouped.set(pid, events.slice(0, 3));
      }
      setParentTournaments(parents.map(p => ({
        ...p,
        subEventCount: counts.get(p.id) || 0,
        previewSubEvents: grouped.get(p.id) || [],
      })) as ParentTournamentWithPreview[]);
    };
    loadParents();
  }, []);

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
      case "setup": return t.quickTable.status.setup;
      case "group_stage": return t.quickTable.status.groupStage;
      case "playoff": return t.quickTable.status.playoff;
      case "completed": return t.quickTable.status.completed;
      default: return status;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" => {
    switch (status) {
      case "completed": return "default";
      case "playoff":
      case "group_stage": return "secondary";
      default: return "outline";
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
        className="group block glass-card overflow-hidden"
      >
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge 
                  variant="outline"
                  className={cn("px-2 py-0.5 text-xs font-medium border", config.color)}
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
        <EmptyState icon={Trophy} title={t.common.noResults} description={t.tournament.checkBackLater} />
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

  const renderQuickTableMeta = (item: Record<string, unknown>) => {
    const table = item as { is_doubles?: boolean; player_count?: number };
    return table.is_doubles ? (
      <Badge variant="secondary" className="gap-1 text-xs bg-blue-100 text-blue-700 border-blue-200">
        <Users className="w-3 h-3" />
        <span>{table.player_count} {t.tournament.pairs}</span>
      </Badge>
    ) : (
      <Badge variant="secondary" className="gap-1 text-xs bg-orange-100 text-orange-700 border-orange-200">
        <User className="w-3 h-3" />
        <span>{table.player_count} {t.tournament.players}</span>
      </Badge>
    );
  };

  const renderTeamMatchMeta = (item: Record<string, unknown>) => {
    const tm = item as { team_count?: number; team_roster_size?: number; format?: string };
    const getFormatLabel = (f: string) => {
      switch (f) {
        case 'round_robin': return t.teamMatch.formatRoundRobin;
        case 'single_elimination': return t.teamMatch.formatSingleElim;
        case 'rr_playoff': return t.teamMatch.formatRrPlayoff;
        default: return f;
      }
    };
    return (
      <>
        <Badge variant="secondary" className="gap-1 text-xs bg-purple-100 text-purple-700 border-purple-200">
          <Users className="w-3 h-3" />
          <span>{tm.team_count} {t.teamMatch.teams} × {tm.team_roster_size}</span>
        </Badge>
        {tm.format && <span className="text-xs text-muted-foreground">{getFormatLabel(tm.format)}</span>}
      </>
    );
  };

  const renderDoublesMeta = (item: Record<string, unknown>) => {
    const de = item as { team_count?: number };
    return (
      <Badge variant="secondary" className="gap-1 text-xs">
        <Users className="w-3 h-3" />
        <span>{de.team_count} {t.tournament.pairs}</span>
      </Badge>
    );
  };

  return (
    <MainLayout>
      <DynamicMeta
        title="Pickleball Tournament Software for Organizers"
        description="Professional pickleball tournament software for organizers. Create brackets, manage team matches, run round robin tournaments, and livestream your pickleball events with ThePickleHub."
        url="https://www.thepicklehub.net/tournaments"
      />
      <HreflangTags enPath="/tournaments" viPath="/vi/tournaments" />
      <div className="container-wide py-8 w-full min-w-0">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gradient-brand mb-2">
            {t.tournament.hubTitle}
          </h1>
          <p className="text-foreground-secondary max-w-3xl">
            {t.tournament.hubDescription}
          </p>
        </header>

        <div className="mb-8">
          <SearchBar value={searchQuery} onChange={setSearchQuery} className="max-w-md" />
        </div>

        {/* User's Registered Tournaments */}
        {user && registeredTournaments.length > 0 && (
          <Card className="mb-6">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-foreground">{t.quickTable.yourRegisteredTournaments}</h2>
              </div>
            </div>
            <div className="px-4 pb-4 space-y-2">
              {registeredTournaments.map((tournament) => {
                const tm = tournament;
                return (
                  <Link
                    key={tm.id}
                    to={`/tools/quick-tables/${tm.share_id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-green-600/10 flex items-center justify-center flex-shrink-0">
                      <Trophy className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate max-w-[180px]">{tm.name}</span>
                        <Badge 
                          variant={tm.registrationStatus === 'approved' ? 'default' : 'outline'}
                          className={cn("text-xs shrink-0", tm.registrationStatus === 'approved' ? 'bg-green-600' : '')}
                        >
                          {tm.registrationStatus === 'approved' ? t.quickTable.approved : t.quickTable.pending}
                        </Badge>
                        <Badge variant={getStatusVariant(tm.status)} className="text-xs shrink-0">
                          {getStatusLabel(tm.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {tm.is_doubles ? (
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{tm.player_count} {t.tournament.pairs}</span>
                        ) : (
                          <span className="flex items-center gap-1"><User className="w-3 h-3" />{tm.player_count} {t.tournament.players}</span>
                        )}
                        {tm.creator_display_name && (
                          <>
                            <span className="text-muted-foreground/50">•</span>
                            <span className="flex items-center gap-1 truncate max-w-[120px]">
                              <Mail className="w-3 h-3 shrink-0" />{tm.creator_display_name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-foreground-muted flex-shrink-0" />
                  </Link>
                );
              })}
            </div>
          </Card>
        )}

        {/* User's Completed Tournaments */}
        {user && completedTournaments.length > 0 && (
          <Card className="mb-6">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-foreground-muted" />
                <h2 className="text-lg font-semibold text-foreground">{t.quickTable.yourCompletedTournaments}</h2>
              </div>
            </div>
            <div className="px-4 pb-4 space-y-2">
              {completedTournaments.slice(0, 5).map((tournament) => {
                const tm = tournament;
                return (
                  <Link
                    key={tm.id}
                    to={`/tools/quick-tables/${tm.share_id}`}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-5 h-5 text-foreground-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{tm.name}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {tm.is_doubles ? (
                            <Badge variant="secondary" className="gap-1 text-xs bg-blue-100 text-blue-700 border-blue-200">
                              <Users className="w-3 h-3" /><span>{tm.player_count} {t.tournament.pairs}</span>
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-xs bg-orange-100 text-orange-700 border-orange-200">
                              <User className="w-3 h-3" /><span>{tm.player_count} {t.tournament.players}</span>
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
                );
              })}
            </div>
          </Card>
        )}

        {/* Featured Parent Tournaments */}
        {parentTournaments.filter(p => p.is_featured).length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-foreground">
                {t.tournament.featured}
              </h2>
            </div>
            <div className="grid gap-3">
              {parentTournaments.filter(p => p.is_featured).map((pt) => (
                <ParentTournamentCard
                  key={pt.id}
                  parent={pt}
                  isOwner={!!user && pt.creator_user_id === user.id}
                  variant="featured"
                />
              ))}
            </div>
          </div>
        )}

        {/* Non-featured Parent Tournaments (Multi-event) */}
        {parentTournaments.filter(p => !p.is_featured).length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
                {t.tournament.multiEvent}
              </h2>
            </div>
            <div className="grid gap-3">
              {parentTournaments.filter(p => !p.is_featured).map((pt) => (
                <ParentTournamentCard
                  key={pt.id}
                  parent={pt}
                  isOwner={!!user && pt.creator_user_id === user.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Format sections using reusable component */}
        <TournamentFormatSection
          icon={<ClipboardList className="w-5 h-5 text-primary" />}
          title="Quick Table"
          activeItems={activeQuickTables}
          completedItems={completedQuickTables}
          basePath="/tools/quick-tables"
          renderMeta={renderQuickTableMeta}
        />

        <TournamentFormatSection
          icon={<Users className="w-5 h-5 text-primary" />}
          title={t.teamMatch.publicTournaments}
          activeItems={openTeamMatchTournaments}
          completedItems={completedTeamMatches}
          basePath="/tools/team-match"
          renderMeta={renderTeamMatchMeta}
        />

        <TournamentFormatSection
          icon={<Trophy className="w-5 h-5 text-primary" />}
          title="Doubles Elimination"
          activeItems={activeDoubles}
          completedItems={completedDoubles}
          basePath="/tools/doubles-elimination"
          renderMeta={renderDoublesMeta}
        />

        <TournamentFormatSection
          icon={<Trophy className="w-5 h-5 text-primary" />}
          title="Flex Tournament"
          activeItems={activeFlex}
          completedItems={completedFlex}
          basePath="/tools/flex-tournament"
        />

        {/* Main tournaments (events) */}
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
            <TabsList className="mb-6 h-auto p-1 bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm rounded-xl">
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

export default TournamentsLegacy;

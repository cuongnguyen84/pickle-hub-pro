import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { MainLayout } from "@/components/layout";
import { SearchBar } from "@/components/search";
import ContentCard from "@/components/content/ContentCard";
import LiveCard from "@/components/content/LiveCard";
import { EmptyState } from "@/components/content";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVideos, useLivestreams, useTournaments } from "@/hooks/useSupabaseData";
import { Search as SearchIcon, Trophy, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type SearchTab = "all" | "videos" | "livestreams" | "tournaments";

const Search = () => {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<SearchTab>("all");

  const { data: videos = [], isLoading: loadingVideos } = useVideos();
  const { data: livestreams = [], isLoading: loadingLivestreams } = useLivestreams();
  const { data: tournaments = [], isLoading: loadingTournaments } = useTournaments();

  const isLoading = loadingVideos || loadingLivestreams || loadingTournaments;

  // Filter results based on search query
  const filteredResults = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      return { videos: [], livestreams: [], tournaments: [] };
    }

    const filteredVideos = videos.filter(
      (v) =>
        v.title.toLowerCase().includes(query) ||
        v.description?.toLowerCase().includes(query)
    );

    const filteredLivestreams = livestreams.filter(
      (l) =>
        l.title?.toLowerCase().includes(query) ||
        l.description?.toLowerCase().includes(query)
    );

    const filteredTournaments = tournaments.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
    );

    return {
      videos: filteredVideos,
      livestreams: filteredLivestreams,
      tournaments: filteredTournaments,
    };
  }, [searchQuery, videos, livestreams, tournaments]);

  const totalResults =
    filteredResults.videos.length +
    filteredResults.livestreams.length +
    filteredResults.tournaments.length;

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value) {
      setSearchParams({ q: value });
    } else {
      setSearchParams({});
    }
  };

  const hasQuery = searchQuery.trim().length > 0;

  return (
    <MainLayout>
      <div className="container-wide py-6 space-y-6">
        {/* Search Header */}
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-foreground">{t.search.title}</h1>
          <SearchBar
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={t.search.placeholder}
            className="max-w-2xl"
          />
        </div>

        {/* No query state */}
        {!hasQuery && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <SearchIcon className="w-12 h-12 text-foreground-muted mb-4" />
            <p className="text-foreground-secondary">{t.search.enterKeyword}</p>
          </div>
        )}

        {/* Results */}
        {hasQuery && (
          <>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-video bg-muted rounded-xl" />
                    <div className="pt-3 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <p className="text-sm text-foreground-muted">
                  {t.search.resultsCount.replace("{count}", String(totalResults))}
                </p>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SearchTab)}>
                  <TabsList>
                    <TabsTrigger value="all">
                      {t.search.tabs.all} ({totalResults})
                    </TabsTrigger>
                    <TabsTrigger value="videos">
                      {t.search.tabs.videos} ({filteredResults.videos.length})
                    </TabsTrigger>
                    <TabsTrigger value="livestreams">
                      {t.search.tabs.livestreams} ({filteredResults.livestreams.length})
                    </TabsTrigger>
                    <TabsTrigger value="tournaments">
                      {t.search.tabs.tournaments} ({filteredResults.tournaments.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="all" className="mt-6 space-y-8">
                    {/* Videos */}
                    {filteredResults.videos.length > 0 && (
                      <section>
                        <h3 className="text-lg font-semibold mb-4">{t.nav.videos}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {filteredResults.videos.slice(0, 4).map((video) => (
                            <ContentCard
                              key={video.id}
                              id={video.id}
                              title={video.title}
                              thumbnail={video.thumbnail_url ?? undefined}
                              duration={video.duration_seconds ?? undefined}
                              type={video.type}
                              organizationName={video.organization?.name}
                              organizationSlug={video.organization?.slug}
                              organizationLogo={video.organization?.logo_url ?? undefined}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Livestreams */}
                    {filteredResults.livestreams.length > 0 && (
                      <section>
                        <h3 className="text-lg font-semibold mb-4">{t.nav.live}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {filteredResults.livestreams.slice(0, 4).map((stream) => (
                            <LiveCard
                              key={stream.id!}
                              id={stream.id!}
                              title={stream.title ?? ""}
                              thumbnail={stream.thumbnail_url ?? undefined}
                              status={stream.status ?? "scheduled"}
                              organizationName={stream.organization?.name}
                              organizationSlug={stream.organization?.slug}
                              organizationLogo={stream.organization?.logo_url ?? undefined}
                              isReplay={stream.status === "ended" && !!stream.mux_playback_id}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Tournaments */}
                    {filteredResults.tournaments.length > 0 && (
                      <section>
                        <h3 className="text-lg font-semibold mb-4">{t.nav.tournaments}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredResults.tournaments.slice(0, 3).map((tournament) => (
                            <TournamentCard key={tournament.id} tournament={tournament} />
                          ))}
                        </div>
                      </section>
                    )}

                    {totalResults === 0 && (
                      <EmptyState
                        title={t.search.noResults}
                        description={t.search.tryDifferent}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="videos" className="mt-6">
                    {filteredResults.videos.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredResults.videos.map((video) => (
                          <ContentCard
                            key={video.id}
                            id={video.id}
                            title={video.title}
                            thumbnail={video.thumbnail_url ?? undefined}
                            duration={video.duration_seconds ?? undefined}
                            type={video.type}
                            organizationName={video.organization?.name}
                            organizationSlug={video.organization?.slug}
                            organizationLogo={video.organization?.logo_url ?? undefined}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title={t.search.noResults}
                        description={t.search.tryDifferent}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="livestreams" className="mt-6">
                    {filteredResults.livestreams.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredResults.livestreams.map((stream) => (
                          <LiveCard
                            key={stream.id!}
                            id={stream.id!}
                            title={stream.title ?? ""}
                            thumbnail={stream.thumbnail_url ?? undefined}
                            status={stream.status ?? "scheduled"}
                            organizationName={stream.organization?.name}
                            organizationSlug={stream.organization?.slug}
                            organizationLogo={stream.organization?.logo_url ?? undefined}
                            isReplay={stream.status === "ended" && !!stream.mux_playback_id}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title={t.search.noResults}
                        description={t.search.tryDifferent}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="tournaments" className="mt-6">
                    {filteredResults.tournaments.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredResults.tournaments.map((tournament) => (
                          <TournamentCard key={tournament.id} tournament={tournament} />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title={t.search.noResults}
                        description={t.search.tryDifferent}
                      />
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};

// Simple tournament card for search results
interface TournamentCardProps {
  tournament: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    status: "upcoming" | "ongoing" | "ended";
    start_date?: string | null;
    end_date?: string | null;
  };
}

const TournamentCard = ({ tournament }: TournamentCardProps) => {
  const { t } = useI18n();

  const statusConfig = {
    ongoing: { color: "bg-live text-foreground", text: t.tournament.ongoing },
    upcoming: { color: "bg-primary text-primary-foreground", text: t.tournament.upcoming },
    ended: { color: "bg-muted text-foreground-muted", text: t.tournament.ended },
  };

  const config = statusConfig[tournament.status];

  return (
    <Link
      to={`/tournament/${tournament.slug}`}
      className="block p-4 rounded-xl bg-background-surface border border-border-subtle hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Trophy className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={config.color}>{config.text}</Badge>
          </div>
          <h3 className="font-semibold text-foreground line-clamp-1">{tournament.name}</h3>
          {tournament.start_date && (
            <div className="flex items-center gap-1 text-sm text-foreground-muted mt-1">
              <Calendar className="w-3 h-3" />
              <span>{format(new Date(tournament.start_date), "dd/MM/yyyy")}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default Search;

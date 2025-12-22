import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout";
import { ContentCard, LiveCard, SectionHeader, EmptyState } from "@/components/content";
import { SearchBar, ContentFilters, type ContentType, type SortOption } from "@/components/search";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { useVideos, useReplays, useTournaments } from "@/hooks/useSupabaseData";
import { useDebounce } from "@/hooks/useSearch";
import { Play, RotateCcw, Search } from "lucide-react";

const Videos = () => {
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState("");
  const [contentType, setContentType] = useState<ContentType>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [selectedTournament, setSelectedTournament] = useState("all");

  const debouncedSearch = useDebounce(searchQuery.toLowerCase().trim(), 300);

  const { data: videos = [], isLoading: videosLoading } = useVideos();
  const { data: replays = [], isLoading: replaysLoading } = useReplays();
  const { data: tournaments = [] } = useTournaments();

  // Filter and search logic
  const { filteredReplays, filteredVideos, hasResults } = useMemo(() => {
    const filterBySearch = <T extends { title?: string | null; organization?: { name: string } | null }>(
      items: T[]
    ) => {
      if (!debouncedSearch) return items;
      return items.filter((item) => {
        const title = item.title?.toLowerCase() ?? "";
        const orgName = item.organization?.name?.toLowerCase() ?? "";
        return title.includes(debouncedSearch) || orgName.includes(debouncedSearch);
      });
    };

    const filterByTournament = <T extends { tournament_id?: string | null }>(items: T[]) => {
      if (selectedTournament === "all") return items;
      return items.filter((item) => item.tournament_id === selectedTournament);
    };

    let processedReplays = replays;
    let processedVideos = videos;

    // Apply search
    processedReplays = filterBySearch(processedReplays);
    processedVideos = filterBySearch(processedVideos);

    // Apply tournament filter
    processedReplays = filterByTournament(processedReplays);
    processedVideos = filterByTournament(processedVideos);

    // Apply content type filter
    if (contentType === "replay") {
      processedVideos = [];
    } else if (contentType === "video") {
      processedReplays = [];
    }

    return {
      filteredReplays: processedReplays,
      filteredVideos: processedVideos,
      hasResults: processedReplays.length > 0 || processedVideos.length > 0,
    };
  }, [videos, replays, debouncedSearch, contentType, selectedTournament]);

  const isLoading = videosLoading || replaysLoading;
  const hasSearch = debouncedSearch.length > 0;

  return (
    <MainLayout>
      <div className="container-wide py-8">
        <h1 className="text-2xl font-semibold mb-6">{t.nav.videos}</h1>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            className="flex-1"
          />
          <ContentFilters
            contentType={contentType}
            onContentTypeChange={setContentType}
            sortBy={sortBy}
            onSortChange={setSortBy}
            tournaments={tournaments}
            selectedTournament={selectedTournament}
            onTournamentChange={setSelectedTournament}
            showTournamentFilter
            showSortFilter={false}
          />
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="space-y-12">
            <section>
              <Skeleton className="h-7 w-32 mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="aspect-video rounded-xl" />
                ))}
              </div>
            </section>
          </div>
        ) : !hasResults && hasSearch ? (
          <EmptyState icon={Search} title={t.search.noResults} />
        ) : (
          <>
            {/* Replays section */}
            {(contentType === "all" || contentType === "replay") && filteredReplays.length > 0 && (
              <section className="mb-12">
                <SectionHeader title={t.live.replay} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredReplays.map((stream) => (
                    <LiveCard
                      key={stream.id}
                      id={stream.id!}
                      title={stream.title ?? ""}
                      organizationName={stream.organization?.name ?? ""}
                      status="ended"
                      thumbnail={stream.thumbnail_url ?? undefined}
                      isReplay
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Videos section */}
            {(contentType === "all" || contentType === "video") && (
              <section className="mb-12">
                <SectionHeader title={t.home.sections.latestVideos} />
                {filteredVideos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {filteredVideos.map((video) => (
                      <ContentCard
                        key={video.id}
                        id={video.id}
                        title={video.title}
                        duration={video.duration_seconds ?? 0}
                        views={0}
                        organizationName={video.organization?.name ?? ""}
                        thumbnail={video.thumbnail_url ?? undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Play} title={t.home.noVideos} />
                )}
              </section>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default Videos;

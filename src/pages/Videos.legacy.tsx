import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout";
import { ContentCard, SectionHeader, EmptyState } from "@/components/content";
import { SearchBar, ContentFilters, type SortOption } from "@/components/search";
import { LoadMoreButton } from "@/components/content/LoadMoreButton";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { useTournaments } from "@/hooks/useSupabaseData";
import { usePaginatedVideos } from "@/hooks/usePaginatedVideos";
import { useDebounce } from "@/hooks/useSearch";
import { useBatchViewCounts } from "@/hooks/useBatchViewCounts";
import { DynamicMeta, HreflangTags } from "@/components/seo";
import { Play, Search } from "lucide-react";

/**
 * Legacy Videos page — archived 2026-04-27 during sub-route cutover.
 * Accessible at /videos-legacy for 14-day rollback. Cleanup 2026-05-09.
 */
const VideosLegacy = () => {
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [selectedTournament, setSelectedTournament] = useState("all");

  const debouncedSearch = useDebounce(searchQuery.toLowerCase().trim(), 300);

  const {
    data: videosData,
    isLoading: videosLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePaginatedVideos();

  const { data: tournaments = [] } = useTournaments();

  const allVideos = useMemo(
    () => videosData?.pages.flatMap((p) => p.items) ?? [],
    [videosData]
  );

  const videoIds = useMemo(() => allVideos.map((v) => v.id), [allVideos]);
  const viewCountsMap = useBatchViewCounts("video", videoIds);

  const filteredVideos = useMemo(() => {
    let processed = allVideos;

    if (debouncedSearch) {
      processed = processed.filter((item) => {
        const title = item.title?.toLowerCase() ?? "";
        const orgName = item.organization?.name?.toLowerCase() ?? "";
        return title.includes(debouncedSearch) || orgName.includes(debouncedSearch);
      });
    }

    if (selectedTournament !== "all") {
      processed = processed.filter((item) => item.tournament_id === selectedTournament);
    }

    return processed;
  }, [allVideos, debouncedSearch, selectedTournament]);

  const hasSearch = debouncedSearch.length > 0;

  return (
    <MainLayout>
      <DynamicMeta
        title={t.nav.videos}
        description="Xem lại các trận pickleball hay nhất. Watch pickleball replays, highlights and match videos on ThePickleHub."
      />
      <HreflangTags enPath="/videos" viPath="/vi/videos" />
      <div className="container-wide py-8">
        <h1 className="text-2xl font-semibold text-gradient-brand mb-6">{t.nav.videos}</h1>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            className="flex-1"
          />
          <ContentFilters
            contentType="video"
            onContentTypeChange={() => {}}
            sortBy={sortBy}
            onSortChange={setSortBy}
            tournaments={tournaments}
            selectedTournament={selectedTournament}
            onTournamentChange={setSelectedTournament}
            showTournamentFilter
            showSortFilter={false}
          />
        </div>

        {videosLoading ? (
          <div className="space-y-12">
            <section>
              <Skeleton className="h-7 w-32 mb-4" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="aspect-video rounded-xl" />
                ))}
              </div>
            </section>
          </div>
        ) : filteredVideos.length === 0 && hasSearch ? (
          <EmptyState icon={Search} title={t.search.noResults} />
        ) : (
          <section className="mb-12">
            <SectionHeader title={t.home.sections.latestVideos} />
            {filteredVideos.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {filteredVideos.map((video) => (
                    <ContentCard
                      key={video.id}
                      id={video.id}
                      title={video.title}
                      duration={video.duration_seconds ?? 0}
                      views={viewCountsMap[video.id] ?? 0}
                      organizationName={video.organization?.name ?? ""}
                      organizationSlug={video.organization?.slug}
                      organizationLogo={video.organization?.display_logo ?? video.organization?.logo_url ?? undefined}
                      thumbnail={video.thumbnail_url ?? undefined}
                    />
                  ))}
                </div>
                {!hasSearch && (
                  <LoadMoreButton
                    onClick={() => fetchNextPage()}
                    isLoading={isFetchingNextPage}
                    hasMore={!!hasNextPage}
                  />
                )}
              </>
            ) : (
              <EmptyState icon={Play} title={t.home.noVideos} />
            )}
          </section>
        )}
      </div>
    </MainLayout>
  );
};

export default VideosLegacy;

import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout";
import { ContentCard, SectionHeader, EmptyState } from "@/components/content";
import { SearchBar, ContentFilters, type ContentType, type SortOption } from "@/components/search";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { useVideos, useTournaments } from "@/hooks/useSupabaseData";
import { useDebounce } from "@/hooks/useSearch";
import { useBatchViewCounts } from "@/hooks/useBatchViewCounts";
import { Play, Search } from "lucide-react";

const Videos = () => {
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [selectedTournament, setSelectedTournament] = useState("all");

  const debouncedSearch = useDebounce(searchQuery.toLowerCase().trim(), 300);

  const { data: videos = [], isLoading: videosLoading } = useVideos();
  const { data: tournaments = [] } = useTournaments();

  // Batch fetch view counts for all videos
  const videoIds = useMemo(() => videos.map((v) => v.id), [videos]);
  const viewCountsMap = useBatchViewCounts("video", videoIds);

  const filteredVideos = useMemo(() => {
    let processed = videos;

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
  }, [videos, debouncedSearch, selectedTournament]);

  const hasSearch = debouncedSearch.length > 0;

  return (
    <MainLayout>
      <div className="container-wide py-8">
        <h1 className="text-2xl font-semibold mb-6">{t.nav.videos}</h1>

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
                    thumbnail={video.thumbnail_url ?? undefined}
                  />
                ))}
              </div>
            ) : (
              <EmptyState icon={Play} title={t.home.noVideos} />
            )}
          </section>
        )}
      </div>
    </MainLayout>
  );
};

export default Videos;

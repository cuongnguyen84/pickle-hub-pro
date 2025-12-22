import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout";
import { LiveCard, SectionHeader, EmptyState } from "@/components/content";
import { SearchBar } from "@/components/search";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { useLivestreams } from "@/hooks/useSupabaseData";
import { useDebounce } from "@/hooks/useSearch";
import { Radio, Search } from "lucide-react";

const Live = () => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery.toLowerCase().trim(), 300);

  const { data: liveStreams = [], isLoading: liveLoading } = useLivestreams("live");
  const { data: scheduledStreams = [], isLoading: scheduledLoading } = useLivestreams("scheduled");

  // Filter by search
  const { filteredLive, filteredScheduled, hasResults } = useMemo(() => {
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

    const live = filterBySearch(liveStreams);
    const scheduled = filterBySearch(scheduledStreams);

    return {
      filteredLive: live,
      filteredScheduled: scheduled,
      hasResults: live.length > 0 || scheduled.length > 0,
    };
  }, [liveStreams, scheduledStreams, debouncedSearch]);

  const isLoading = liveLoading || scheduledLoading;
  const hasSearch = debouncedSearch.length > 0;

  return (
    <MainLayout>
      <div className="container-wide py-8">
        <h1 className="text-2xl font-semibold mb-6">{t.nav.live}</h1>

        {/* Search Bar */}
        <div className="mb-8">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            className="max-w-md"
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
            {/* Live Now Section */}
            <section className="mb-12">
              <SectionHeader title={t.home.sections.liveNow} />
              {filteredLive.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredLive.map((stream) => (
                    <LiveCard
                      key={stream.id}
                      id={stream.id!}
                      title={stream.title ?? ""}
                      viewerCount={0}
                      organizationName={stream.organization?.name ?? ""}
                      status={stream.status as "live" | "scheduled" | "ended"}
                      thumbnail={stream.thumbnail_url ?? undefined}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Radio} title={t.home.noLive} />
              )}
            </section>

            {/* Scheduled Section */}
            {filteredScheduled.length > 0 && (
              <section>
                <SectionHeader title={t.live.scheduled} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredScheduled.map((stream) => (
                    <LiveCard
                      key={stream.id}
                      id={stream.id!}
                      title={stream.title ?? ""}
                      organizationName={stream.organization?.name ?? ""}
                      status={stream.status as "live" | "scheduled" | "ended"}
                      thumbnail={stream.thumbnail_url ?? undefined}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default Live;

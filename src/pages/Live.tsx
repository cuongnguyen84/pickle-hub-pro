import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { LiveCard, SectionHeader, EmptyState } from "@/components/content";
import { SearchBar } from "@/components/search";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { useLivestreams } from "@/hooks/useSupabaseData";
import { useDebounce } from "@/hooks/useSearch";
import { Radio, Search } from "lucide-react";
import { DynamicMeta } from "@/components/seo";

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
      <DynamicMeta 
        title="Pickleball Livestream | Watch Pickleball Tournaments Live"
        description="Watch live pickleball tournaments and matches on ThePickleHub. Stream pickleball events from top creators, professional tournaments, and community competitions in real-time."
        url="https://thepicklehub.net/livestream"
      />
      <div className="container-wide py-8">
        {/* SEO Header Section */}
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Pickleball Livestream
          </h1>
          <p className="text-foreground-secondary max-w-3xl">
            Watch pickleball tournaments live on ThePickleHub – your destination for real-time pickleball action.
          </p>
        </header>

        {/* SEO Content Section */}
        <section className="mb-8 p-6 rounded-xl bg-background-surface border border-border-subtle">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Watch Pickleball Tournaments Live
          </h2>
          <p className="text-foreground-secondary mb-4">
            ThePickleHub brings you the best pickleball livestream experience in Vietnam and beyond. 
            Watch live matches from professional <Link to="/tournaments" className="text-primary hover:underline">pickleball tournaments</Link>, amateur competitions, and community events. 
            Our platform features streams from top pickleball creators including TAPickleball, featuring 
            high-quality broadcasts of singles, doubles, and mixed doubles matches.
          </p>
          
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Livestream From Top Pickleball Creators
          </h2>
          <p className="text-foreground-secondary mb-4">
            Follow your favorite pickleball content creators and never miss a live match. 
            Our creators broadcast tournaments, training sessions, and exhibition matches regularly. 
            Get real-time scores, commentary, and the excitement of live pickleball competition 
            directly on your device.
          </p>

          <h2 className="text-lg font-semibold text-foreground mb-3">
            Upcoming & Ongoing Pickleball Livestreams
          </h2>
          <p className="text-foreground-secondary">
            Browse our schedule of upcoming livestreams and set reminders for matches you don't want to miss. 
            Whether you're looking for recreational club tournaments or competitive league matches with 
            <Link to="/tools/quick-tables" className="text-primary hover:underline"> pickleball tournament brackets</Link>, 
            ThePickleHub has your pickleball livestream needs covered.
          </p>
        </section>

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
                      organizationSlug={stream.organization?.slug}
                      organizationLogo={stream.organization?.display_logo ?? stream.organization?.logo_url ?? undefined}
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
                      organizationSlug={stream.organization?.slug}
                      organizationLogo={stream.organization?.display_logo ?? stream.organization?.logo_url ?? undefined}
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

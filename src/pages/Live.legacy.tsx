import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { SectionHeader, EmptyState } from "@/components/content";
import LiveCardWithPresence from "@/components/content/LiveCardWithPresence";
import { SearchBar } from "@/components/search";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { useLivestreams, useReplays } from "@/hooks/useSupabaseData";
import { useDebounce } from "@/hooks/useSearch";
import { Radio, Search, RotateCcw } from "lucide-react";
import { DynamicMeta, HreflangTags } from "@/components/seo";

/**
 * Legacy Live page — archived 2026-04-27 during sub-route cutover.
 * Accessible at /live-legacy for 14-day rollback. Cleanup 2026-05-09.
 */
const LiveLegacy = () => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery.toLowerCase().trim(), 300);

  const { data: liveStreams = [], isLoading: liveLoading } = useLivestreams("live");
  const { data: scheduledStreams = [], isLoading: scheduledLoading } = useLivestreams("scheduled");
  const { data: replays = [], isLoading: replaysLoading } = useReplays();

  const { filteredLive, filteredScheduled, filteredReplays, hasResults } = useMemo(() => {
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
    const reps = filterBySearch(replays);

    return {
      filteredLive: live,
      filteredScheduled: scheduled,
      filteredReplays: reps,
      hasResults: live.length > 0 || scheduled.length > 0 || reps.length > 0,
    };
  }, [liveStreams, scheduledStreams, replays, debouncedSearch]);

  const isLoading = liveLoading || scheduledLoading || replaysLoading;
  const hasSearch = debouncedSearch.length > 0;

  return (
    <MainLayout>
      <DynamicMeta
        title="Pickleball Livestream | Watch Pickleball Tournaments Live"
        description="Watch live pickleball tournaments and matches on ThePickleHub. Stream pickleball events from top creators, professional tournaments, and community competitions in real-time."
        url="https://www.thepicklehub.net/livestream"
      />
      <HreflangTags enPath="/live" viPath="/vi/live" />
      <div className="container-wide py-8">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gradient-brand mb-2">
            {t.live.hubTitle}
          </h1>
          <p className="text-foreground-secondary max-w-3xl">
            {t.live.hubDescription}
          </p>
        </header>

        <div className="mb-6">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            className="max-w-md"
          />
        </div>

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
            {/* Live Now */}
            <section className="mb-12">
              <SectionHeader title={t.home.sections.liveNow} />
              {filteredLive.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredLive.map((stream) => (
                    <LiveCardWithPresence
                      key={stream.id}
                      id={stream.id!}
                      title={stream.title ?? ""}
                      organizationName={stream.organization?.name ?? ""}
                      organizationSlug={stream.organization?.slug}
                      organizationLogo={stream.organization?.display_logo ?? stream.organization?.logo_url ?? undefined}
                      status="live"
                      thumbnail={stream.thumbnail_url ?? undefined}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Radio} title={t.home.noLive} />
              )}
            </section>

            {/* Scheduled */}
            {filteredScheduled.length > 0 && (
              <section className="mb-12">
                <SectionHeader title={t.live.scheduled} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredScheduled.map((stream) => (
                    <LiveCardWithPresence
                      key={stream.id}
                      id={stream.id!}
                      title={stream.title ?? ""}
                      organizationName={stream.organization?.name ?? ""}
                      organizationSlug={stream.organization?.slug}
                      organizationLogo={stream.organization?.display_logo ?? stream.organization?.logo_url ?? undefined}
                      status="scheduled"
                      thumbnail={stream.thumbnail_url ?? undefined}
                      scheduledStartAt={stream.scheduled_start_at}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Replays */}
            <section className="mb-12">
              <SectionHeader title={t.live.replay} />
              {filteredReplays.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredReplays.map((stream) => (
                    <LiveCardWithPresence
                      key={stream.id}
                      id={stream.id!}
                      title={stream.title ?? ""}
                      organizationName={stream.organization?.name ?? ""}
                      organizationSlug={stream.organization?.slug}
                      organizationLogo={stream.organization?.display_logo ?? stream.organization?.logo_url ?? undefined}
                      status="ended"
                      thumbnail={stream.thumbnail_url ?? undefined}
                      isReplay
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={RotateCcw} title={t.tournament.noReplays} />
              )}
            </section>
          </>
        )}

        {/* SEO Content */}
        <section className="mt-16 space-y-8">
          <article className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {t.live.seo.tournamentsTitle}
            </h2>
            <p className="text-foreground-secondary">
              {t.live.seo.tournamentsDesc}{" "}
              <Link to="/tournaments" className="text-primary hover:underline">
                {t.tournament.title}
              </Link>
            </p>
          </article>
          <article className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {t.live.seo.creatorsTitle}
            </h2>
            <p className="text-foreground-secondary">
              {t.live.seo.creatorsDesc}
            </p>
          </article>
          <article className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {t.live.seo.upcomingTitle}
            </h2>
            <p className="text-foreground-secondary">
              {t.live.seo.upcomingDesc}{" "}
              <Link to="/tools/quick-tables" className="text-primary hover:underline">
                {t.tools.quickTable.title}
              </Link>
            </p>
          </article>
        </section>
      </div>
    </MainLayout>
  );
};

export default LiveLegacy;

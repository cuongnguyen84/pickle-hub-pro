import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { LiveCard, ReplayCard, SectionHeader, EmptyState } from "@/components/content";
import { SearchBar } from "@/components/search";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { useLivestreams } from "@/hooks/useSupabaseData";
import { useDebounce } from "@/hooks/useSearch";
import { Radio, Search, PlayCircle } from "lucide-react";
import { DynamicMeta } from "@/components/seo";

const Live = () => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery.toLowerCase().trim(), 300);

  const { data: liveStreams = [], isLoading: liveLoading } = useLivestreams("live");
  const { data: scheduledStreams = [], isLoading: scheduledLoading } = useLivestreams("scheduled");
  const { data: endedStreams = [], isLoading: endedLoading } = useLivestreams("ended");

  // Filter by search
  const { filteredLive, filteredScheduled, filteredEnded, hasResults } = useMemo(() => {
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
    // Only show ended streams that have a vod_url (replay available)
    const ended = filterBySearch(endedStreams).filter((s: any) => s.vod_url);

    return {
      filteredLive: live,
      filteredScheduled: scheduled,
      filteredEnded: ended,
      hasResults: live.length > 0 || scheduled.length > 0 || ended.length > 0,
    };
  }, [liveStreams, scheduledStreams, endedStreams, debouncedSearch]);

  const isLoading = liveLoading || scheduledLoading || endedLoading;
  const hasSearch = debouncedSearch.length > 0;

  return (
    <MainLayout>
      <DynamicMeta 
        title="Pickleball Livestream | Watch Pickleball Tournaments Live"
        description="Watch live pickleball tournaments and matches on ThePickleHub. Stream pickleball events from top creators, professional tournaments, and community competitions in real-time."
        url="https://thepicklehub.net/livestream"
      />
      <div className="container-wide py-8">
        {/* SEO Header Section - H1 giữ nguyên */}
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            {t.live.hubTitle}
          </h1>
          <p className="text-foreground-secondary max-w-3xl">
            {t.live.hubDescription}
          </p>
        </header>

        {/* Search Bar - Ngay dưới header */}
        <div className="mb-6">
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
            {/* Live Now Section - Ưu tiên hiển thị đầu tiên */}
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

            {/* Scheduled Section - Thứ hai */}
            {filteredScheduled.length > 0 && (
              <section className="mb-12">
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

            {/* Replay Section - Ended streams with VoD */}
            {filteredEnded.length > 0 && (
              <section className="mb-12">
                <SectionHeader title={t.live.ended || "Replay"} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredEnded.map((stream) => (
                    <LiveCard
                      key={stream.id}
                      id={stream.id!}
                      title={stream.title ?? ""}
                      organizationName={stream.organization?.name ?? ""}
                      organizationSlug={stream.organization?.slug}
                      organizationLogo={stream.organization?.display_logo ?? stream.organization?.logo_url ?? undefined}
                      status="ended"
                      thumbnail={stream.thumbnail_url ?? undefined}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* SEO Content Section - Đưa xuống cuối, chia thành các blocks rõ ràng */}
        <section className="mt-16 space-y-8">
          {/* Block 1: Livestream Tournaments */}
          <article className="p-6 rounded-xl bg-background-surface border border-border-subtle">
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

          {/* Block 2: Livestream from Creators */}
          <article className="p-6 rounded-xl bg-background-surface border border-border-subtle">
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {t.live.seo.creatorsTitle}
            </h2>
            <p className="text-foreground-secondary">
              {t.live.seo.creatorsDesc}
            </p>
          </article>

          {/* Block 3: Upcoming & Match Types */}
          <article className="p-6 rounded-xl bg-background-surface border border-border-subtle">
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

export default Live;

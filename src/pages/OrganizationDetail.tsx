import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { ContentCard, LiveCard, EmptyState } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import {
  useOrganizationBySlug,
  useOrganizationContent,
} from "@/hooks/useOrganizationData";
import { OrganizationHero } from "@/components/organization";
import { ContentSection, CourtTabs } from "@/components/tournament";
import { SearchBar, ContentFilters, ContentType, SortOption } from "@/components/search";
import { Building2, Radio, Clock, RotateCcw, Play, Bell } from "lucide-react";
import { useDebounce } from "@/hooks/useSearch";

const OrganizationDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useI18n();

  const { data: organization, isLoading: orgLoading } = useOrganizationBySlug(
    slug ?? ""
  );
  const { data: content, isLoading: contentLoading } = useOrganizationContent(
    organization?.id ?? ""
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [contentType, setContentType] = useState<ContentType>("all");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [videoFilter, setVideoFilter] = useState<"all" | "short" | "long">("all");

  const debouncedSearch = useDebounce(searchQuery.toLowerCase().trim(), 300);

  // Process content
  const {
    liveStreams,
    scheduledStreams,
    replays,
    videos,
    filteredVideos,
    filteredContent,
  } = useMemo(() => {
    const livestreams = content?.livestreams ?? [];
    const allVideos = content?.videos ?? [];

    // Base categorization
    const live = livestreams.filter((ls) => ls.status === "live");
    const scheduled = livestreams
      .filter((ls) => ls.status === "scheduled")
      .sort((a, b) => {
        if (!a.scheduled_start_at || !b.scheduled_start_at) return 0;
        return (
          new Date(a.scheduled_start_at).getTime() -
          new Date(b.scheduled_start_at).getTime()
        );
      });
    const replay = livestreams
      .filter((ls) => ls.status === "ended" && ls.mux_playback_id)
      .sort((a, b) => {
        const aDate = a.ended_at || a.created_at;
        const bDate = b.ended_at || b.created_at;
        if (!aDate || !bDate) return 0;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });

    // Apply search filter
    const filterBySearch = <T extends { title?: string | null }>(items: T[]) => {
      if (!debouncedSearch) return items;
      return items.filter((item) =>
        item.title?.toLowerCase().includes(debouncedSearch)
      );
    };

    // Apply content type filter
    let filteredLive = contentType === "all" || contentType === "live" ? filterBySearch(live) : [];
    let filteredScheduled = contentType === "all" || contentType === "live" ? filterBySearch(scheduled) : [];
    let filteredReplay = contentType === "all" || contentType === "replay" ? filterBySearch(replay) : [];
    let filteredVids = contentType === "all" || contentType === "video" ? filterBySearch(allVideos) : [];

    // Sort by sortOption
    if (sortOption === "upcoming") {
      filteredScheduled = [...filteredScheduled].sort((a, b) => {
        if (!a.scheduled_start_at || !b.scheduled_start_at) return 0;
        return new Date(a.scheduled_start_at).getTime() - new Date(b.scheduled_start_at).getTime();
      });
    }

    return {
      liveStreams: filteredLive,
      scheduledStreams: filteredScheduled,
      replays: filteredReplay,
      videos: filteredVids,
      filteredVideos:
        videoFilter === "all"
          ? filteredVids
          : filteredVids.filter((v) => v.type === videoFilter),
      filteredContent: {
        hasResults:
          filteredLive.length > 0 ||
          filteredScheduled.length > 0 ||
          filteredReplay.length > 0 ||
          filteredVids.length > 0,
      },
    };
  }, [content, debouncedSearch, contentType, sortOption, videoFilter]);

  if (orgLoading) {
    return (
      <MainLayout>
        <div className="container-wide py-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-12 w-96 mb-4" />
          <Skeleton className="h-6 w-64 mb-8" />
          <div className="space-y-8">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-7 w-48 mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((j) => (
                    <Skeleton key={j} className="aspect-video rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!organization) {
    return (
      <MainLayout>
        <div className="container-wide py-16 text-center">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-foreground-muted" />
          <h1 className="text-xl font-semibold mb-2">{t.errors.notFound}</h1>
          <p className="text-foreground-muted mb-6">{t.errors.notFoundDesc}</p>
          <Link to="/" className="text-primary hover:underline">
            {t.nav.home}
          </Link>
        </div>
      </MainLayout>
    );
  }

  const hasAnyContent =
    (content?.livestreams?.length ?? 0) > 0 || (content?.videos?.length ?? 0) > 0;
  const isFiltering = debouncedSearch || contentType !== "all";

  return (
    <MainLayout>
      {/* Hero Section */}
      <OrganizationHero
        id={organization.id}
        name={organization.name}
        slug={organization.slug}
        description={organization.description}
        logoUrl={organization.display_logo ?? organization.logo_url}
        isVerifiedCreator
      />

      <div className="container-wide pb-12">
        {/* Search & Filters */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-4 mb-6 -mx-4 px-4 border-b border-border-subtle">
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t.search.placeholder}
              className="flex-1"
            />
            <ContentFilters
              contentType={contentType}
              onContentTypeChange={setContentType}
              sortBy={sortOption}
              onSortChange={setSortOption}
              showSortFilter
            />
          </div>
        </div>

        {contentLoading ? (
          <div className="space-y-10 pt-4">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-7 w-48 mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((j) => (
                    <Skeleton key={j} className="aspect-video rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : !hasAnyContent ? (
          <div className="py-12">
            <EmptyState
              icon={Play}
              title={t.common.noResults}
              description={t.organization.noContent}
              action={
                <div className="flex items-center gap-2 text-sm text-foreground-muted">
                  <Bell className="w-4 h-4" />
                  {t.organization.followForUpdates}
                </div>
              }
            />
          </div>
        ) : isFiltering && !filteredContent.hasResults ? (
          <div className="py-12">
            <EmptyState
              icon={Play}
              title={t.search.noResults}
              description={t.search.tryDifferent}
            />
          </div>
        ) : (
          <div className="space-y-10">
            {/* Live Now Section */}
            {liveStreams.length > 0 && (
              <ContentSection
                title={t.tournament.liveNow}
                count={liveStreams.length}
                icon={Radio}
                isEmpty={false}
                horizontal
              >
                <CourtTabs
                  items={liveStreams}
                  renderItem={(stream) => (
                    <LiveCard
                      key={stream.id}
                      id={stream.id!}
                      title={stream.title ?? ""}
                      viewerCount={0}
                      organizationName={organization.name}
                      organizationLogo={organization.display_logo ?? organization.logo_url ?? undefined}
                      isVerifiedCreator
                      status="live"
                      thumbnail={stream.thumbnail_url ?? undefined}
                    />
                  )}
                />
              </ContentSection>
            )}

            {/* Scheduled Section */}
            {scheduledStreams.length > 0 && (
              <ContentSection
                title={t.tournament.scheduled}
                count={scheduledStreams.length}
                icon={Clock}
                isEmpty={false}
              >
                <CourtTabs
                  items={scheduledStreams}
                  renderItem={(stream) => (
                    <LiveCard
                      key={stream.id}
                      id={stream.id!}
                      title={stream.title ?? ""}
                      organizationName={organization.name}
                      organizationLogo={organization.display_logo ?? organization.logo_url ?? undefined}
                      isVerifiedCreator
                      status="scheduled"
                      thumbnail={stream.thumbnail_url ?? undefined}
                      scheduledAt={stream.scheduled_start_at ?? undefined}
                    />
                  )}
                />
              </ContentSection>
            )}

            {/* Replays Section */}
            {replays.length > 0 && (
              <ContentSection
                title={t.tournament.replays}
                count={replays.length}
                icon={RotateCcw}
                isEmpty={false}
              >
                <CourtTabs
                  items={replays}
                  renderItem={(stream) => (
                    <LiveCard
                      key={stream.id}
                      id={stream.id!}
                      title={stream.title ?? ""}
                      organizationName={organization.name}
                      organizationLogo={organization.display_logo ?? organization.logo_url ?? undefined}
                      isVerifiedCreator
                      status="ended"
                      thumbnail={stream.thumbnail_url ?? undefined}
                      isReplay
                    />
                  )}
                />
              </ContentSection>
            )}

            {/* Videos Section */}
            {videos.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg md:text-xl font-semibold text-foreground">
                      {t.tournament.videos}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-foreground-muted text-sm font-medium">
                      {videos.length}
                    </span>
                  </div>

                  {/* Video type filter chips */}
                  <div className="flex gap-1">
                    {(["all", "short", "long"] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setVideoFilter(filter)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          videoFilter === filter
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground-muted hover:bg-muted/80"
                        }`}
                      >
                        {filter === "all" && t.tournament.allVideos}
                        {filter === "short" && t.tournament.shortVideos}
                        {filter === "long" && t.tournament.longVideos}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredVideos.length === 0 ? (
                  <EmptyState icon={Play} title={t.common.noResults} />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {filteredVideos.map((video) => (
                      <ContentCard
                        key={video.id}
                        id={video.id}
                        title={video.title}
                        duration={video.duration_seconds ?? 0}
                        views={0}
                        organizationName={organization.name}
                        organizationLogo={organization.display_logo ?? organization.logo_url ?? undefined}
                        isVerifiedCreator
                        thumbnail={video.thumbnail_url ?? undefined}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Empty sections when no content after filtering */}
            {!liveStreams.length &&
              !scheduledStreams.length &&
              !replays.length &&
              !videos.length &&
              !isFiltering && (
                <EmptyState
                  icon={Play}
                  title={t.common.noResults}
                  description={t.organization.noContent}
                />
              )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default OrganizationDetail;

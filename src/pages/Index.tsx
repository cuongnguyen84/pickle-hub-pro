import { useEffect, lazy, Suspense } from "react";
import { MainLayout } from "@/components/layout";
import { cn } from "@/lib/utils";
import { SectionHeader, ContentCard, EmptyState, AdSlot } from "@/components/content";
import LiveCardWithPresence from "@/components/content/LiveCardWithPresence";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { useLivestreams, useVideos, useTournaments } from "@/hooks/useSupabaseData";
import { useFeaturedNews } from "@/hooks/useFeaturedNews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Play, Radio, Trophy, Users, Tv, Calendar, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { DynamicMeta, HreflangTags, OrganizationSchema } from "@/components/seo";

const OpenRegistrationSection = lazy(() => import("@/components/quicktable/OpenRegistrationSection").then(m => ({ default: m.OpenRegistrationSection })));
const NewsCard = lazy(() => import("@/components/news/NewsCard").then(m => ({ default: m.NewsCard })));
const ViHomeBlogSection = lazy(() => import("@/components/content/ViHomeBlogSection").then(m => ({ default: m.ViHomeBlogSection })));
const EnHomeBlogSection = lazy(() => import("@/components/content/EnHomeBlogSection").then(m => ({ default: m.EnHomeBlogSection })));
const VietnameseContentTeaser = lazy(() => import("@/components/content/VietnameseContentTeaser").then(m => ({ default: m.VietnameseContentTeaser })));

const Index = () => {
  const { t, language } = useI18n();

  const { data: liveStreams = [], isLoading: liveLoading } = useLivestreams("live");
  const { data: scheduledStreams = [], isLoading: scheduledLoading } = useLivestreams("scheduled");
  const { data: videos = [], isLoading: videosLoading } = useVideos({ limit: 8 });
  const { data: featuredNews = [] } = useFeaturedNews(3);
  const { data: allTournaments = [] } = useTournaments();

  // Tournaments for homepage section — prioritize upcoming/ongoing, fallback to recent ended
  const activeTournaments = allTournaments.filter((t) => t.status === "upcoming" || t.status === "ongoing");
  const homeTournaments = activeTournaments.length > 0
    ? activeTournaments.slice(0, 3)
    : allTournaments.slice(0, 3); // fallback: show most recent regardless of status

  const streamsLoading = liveLoading || scheduledLoading;
  // Show scheduled section at top if no live streams
  const showScheduledFirst = !streamsLoading && liveStreams.length === 0 && scheduledStreams.length > 0;

  // Preload LCP image as soon as data arrives so browser discovers it early
  useEffect(() => {
    const lcpStreams = showScheduledFirst ? scheduledStreams : liveStreams;
    const lcpThumbnail = lcpStreams[0]?.thumbnail_url || videos[0]?.thumbnail_url;
    if (!lcpThumbnail) return;

    const existingPreload = document.querySelector(`link[rel="preload"][href="${lcpThumbnail}"]`);
    if (existingPreload) return;

    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = lcpThumbnail;
    link.setAttribute("fetchpriority", "high");
    document.head.appendChild(link);

    return () => {
      link.remove();
    };
  }, [showScheduledFirst, scheduledStreams, liveStreams, videos]);

  return (
    <MainLayout>
      {/* SEO Meta Tags */}
      <DynamicMeta
        title="Pickleball Tournaments, Livestream & Community"
        description={language === 'vi' ?
        "ThePickleHub là nền tảng pickleball toàn cầu với livestream trực tiếp các giải đấu, bracket chia bảng thông minh, và cộng đồng pickleball sôi động. Xem livestream, theo dõi giải đấu và kết nối ngay!" :
        "ThePickleHub is a global pickleball platform with live tournament streaming, smart bracket tools, and a vibrant pickleball community. Watch livestreams, follow tournaments, and connect now!"
        }
      />
      <HreflangTags enPath="/" viPath="/vi" />
      <OrganizationSchema />

      {/* Hero Section — Bento Grid */}
      <section className="relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

        <div className="container-wide pt-8 md:pt-12 lg:pt-16 pb-4">
          {/* Bento Grid: 2+1 desktop, stack mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">

            {/* Main Hero Card — spans 2 cols on desktop */}
            <div className="lg:col-span-2 glass-card p-6 md:p-10 relative overflow-hidden min-h-[240px] md:min-h-[300px] flex flex-col justify-between">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/8 to-blue-500/4 pointer-events-none" />
              <div className="relative z-10 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                  <Radio className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">{t.home.hero.badge}</span>
                </div>

                {/* H1 - gradient text */}
                <h1 className="text-balance text-gradient-brand !text-2xl md:!text-3xl lg:!text-4xl">
                  {t.home.hero.mainTitle}
                </h1>

                <p className="text-sm md:text-base text-foreground-secondary leading-relaxed max-w-lg">
                  {t.home.hero.mainDescription}
                </p>
              </div>
              <div className="relative z-10 flex flex-wrap gap-3 pt-4">
                <Link to="/live">
                  <Button size="lg" className="gap-2 btn-gradient border-0 rounded-full px-6">
                    <Play className="w-4 h-4" fill="currentColor" />
                    {t.live.watchLive}
                  </Button>
                </Link>
                <Link to="/tournaments">
                  <Button variant="outline" size="lg" className="gap-2 rounded-full px-6 border-white/10 hover:bg-white/5">
                    {t.home.hero.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Live Now / Next Up Card — right column */}
            <div className="glass-card p-5 flex flex-col justify-between relative overflow-hidden min-h-[200px] md:min-h-[300px]">
              <div className="absolute top-[-20px] right-[-20px] w-[80px] h-[80px] rounded-full bg-live/15 blur-[30px] pointer-events-none" />
              {streamsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="aspect-video rounded-xl mt-4" />
                </div>
              ) : liveStreams.length > 0 ? (
                <>
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-live/15 border border-live/25">
                      <span className="w-1.5 h-1.5 rounded-full bg-live live-dot" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-red-300">{t.home.sections.liveNow}</span>
                    </div>
                    <h3 className="text-sm md:text-base font-semibold text-foreground mt-3 line-clamp-2">
                      {liveStreams[0]?.title}
                    </h3>
                    <p className="text-xs text-foreground-muted mt-1">
                      {liveStreams[0]?.organization?.name}
                    </p>
                  </div>
                  <Link to={`/live/${liveStreams[0]?.id}`} className="block mt-3">
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-background-surface">
                      {liveStreams[0]?.thumbnail_url && (
                        <img src={liveStreams[0].thumbnail_url} alt="" className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="w-10 h-10 rounded-full bg-live/80 flex items-center justify-center glow-live">
                          <Play className="w-4 h-4 text-white" fill="white" />
                        </div>
                      </div>
                      <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-live rounded text-[10px] font-bold text-white">LIVE</div>
                    </div>
                  </Link>
                </>
              ) : scheduledStreams.length > 0 ? (
                <>
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-300">{t.live.scheduled}</span>
                    </div>
                    <h3 className="text-sm md:text-base font-semibold text-foreground mt-3 line-clamp-2">
                      {scheduledStreams[0]?.title}
                    </h3>
                    <p className="text-xs text-foreground-muted mt-1">
                      {scheduledStreams[0]?.organization?.name}
                    </p>
                  </div>
                  <Link to="/live" className="block mt-3">
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-background-surface">
                      {scheduledStreams[0]?.thumbnail_url && (
                        <img src={scheduledStreams[0].thumbnail_url} alt="" className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Play className="w-8 h-8 text-white/80" />
                      </div>
                    </div>
                  </Link>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-6">
                  <Radio className="w-8 h-8 text-foreground-muted mb-3" />
                  <p className="text-sm text-foreground-muted">{t.home.noLive}</p>
                  <Link to="/live" className="text-xs text-primary mt-2 hover:underline">{t.live.scheduled} →</Link>
                </div>
              )}
            </div>
          </div>

          {/* Stats Row — 3 glass cards with emojis */}
          <div className="grid grid-cols-3 gap-3 md:gap-5 mt-4 md:mt-5">
            <div className="glass-card py-4 px-3 md:py-5 md:px-6 text-center">
              <div className="flex items-center justify-center gap-1.5 md:gap-2">
                <span className="text-base md:text-xl">👥</span>
                <span className="text-lg md:text-2xl font-bold text-foreground">1,669</span>
              </div>
              <div className="text-[10px] md:text-xs text-foreground-muted uppercase tracking-wider mt-1">{language === 'vi' ? 'Người chơi' : 'Players'}</div>
            </div>
            <div className="glass-card py-4 px-3 md:py-5 md:px-6 text-center">
              <div className="flex items-center justify-center gap-1.5 md:gap-2">
                <span className="text-base md:text-xl">🏆</span>
                <span className="text-lg md:text-2xl font-bold text-foreground">156</span>
              </div>
              <div className="text-[10px] md:text-xs text-foreground-muted uppercase tracking-wider mt-1">{language === 'vi' ? 'Giải đấu' : 'Tournaments'}</div>
            </div>
            <div className="glass-card py-4 px-3 md:py-5 md:px-6 text-center">
              <div className="flex items-center justify-center gap-1.5 md:gap-2">
                <span className="text-base md:text-xl">🌏</span>
                <span className="text-lg md:text-2xl font-bold text-foreground">10</span>
              </div>
              <div className="text-[10px] md:text-xs text-foreground-muted uppercase tracking-wider mt-1">{language === 'vi' ? 'Điểm PPA Asia' : 'PPA Asia Stops'}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Blog section — EN blog for English, VI blog for Vietnamese */}
      <Suspense fallback={null}>
        {language === 'vi' ? <ViHomeBlogSection /> : <EnHomeBlogSection />}
      </Suspense>

      {/* Extra Live/Scheduled streams — show remaining after the first (which is in hero bento) */}
      {!streamsLoading && (liveStreams.length > 1 || (showScheduledFirst && scheduledStreams.length > 1)) && (
        <section className="container-wide section-spacing">
          <SectionHeader title={liveStreams.length > 1 ? t.home.sections.liveNow : t.live.scheduled} href="/live" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {(liveStreams.length > 1 ? liveStreams.slice(1, 4) : scheduledStreams.slice(1, 4)).map((stream, index) => (
              <LiveCardWithPresence
                key={stream.id}
                id={stream.id!}
                title={stream.title ?? ""}
                organizationName={stream.organization?.name ?? ""}
                organizationSlug={stream.organization?.slug}
                organizationLogo={stream.organization?.display_logo ?? stream.organization?.logo_url ?? undefined}
                status={stream.status as "live" | "scheduled" | "ended"}
                thumbnail={stream.thumbnail_url ?? undefined}
                scheduledStartAt={stream.scheduled_start_at}
                priority={index === 0} />
            ))}
          </div>
        </section>
      )}

      {/* Open Registration Tournaments */}
      <Suspense fallback={null}>
        <OpenRegistrationSection limit={5} showViewAll={true} />
      </Suspense>

      {/* Featured News - Only show if there are items */}
      {featuredNews.length > 0 &&
      <section className="container-wide section-spacing">
          <SectionHeader title={t.news.title} href="/news" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Suspense fallback={null}>
              {featuredNews.map((item) =>
            <NewsCard
              key={item.id}
              title={item.title}
              summary={item.summary}
              source={item.source}
              sourceUrl={item.source_url}
              publishedAt={item.published_at} />
              )}
            </Suspense>
          </div>
        </section>
      }

      {/* Ad Slot */}
      <div className="container-wide">
        <AdSlot variant="banner" />
      </div>

      {/* Trending Videos */}
      <section className="container-wide section-spacing">
        <SectionHeader title={t.home.sections.trendingVideos} href="/videos" />
        
        {videosLoading ?
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[1, 2, 3, 4].map((i) =>
          <div key={i} className="space-y-3">
                <Skeleton className="aspect-video rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
          )}
          </div> :
        videos.length > 0 ?
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {videos.slice(0, 4).map((video) =>
          <ContentCard
            key={video.id}
            id={video.id}
            title={video.title}
            duration={video.duration_seconds ?? 0}
            views={0}
            organizationName={video.organization?.name ?? ""}
            organizationSlug={video.organization?.slug}
            thumbnail={video.thumbnail_url ?? undefined} />

          )}
          </div> :

        <EmptyState icon={Play} title={t.home.noVideos} />
        }
      </section>

      {/* Upcoming Tournaments — real data from DB */}
      {homeTournaments.length > 0 && (
        <section className="container-wide section-spacing">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">{t.home.sections.homeTournaments}</h2>
                <p className="text-sm text-foreground-muted mt-1">{t.home.sections.upcomingSubtitle}</p>
              </div>
              <Link
                to="/tournaments"
                className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover transition-colors duration-200"
              >
                <span>{t.common.viewAll}</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {homeTournaments.map((tournament) => {
              const isOngoing = tournament.status === "ongoing";
              const isEnded = tournament.status === "ended";
              return (
                <Link
                  key={tournament.id}
                  to={`/tournament/${tournament.slug}`}
                  className="group block glass-card overflow-hidden"
                >
                  <div className="p-5 flex flex-col h-full">
                    {/* Status + Date row */}
                    <div className="flex items-center justify-between mb-3">
                      <Badge className={cn(
                        "text-xs border-0 gap-1",
                        isOngoing
                          ? "bg-live/90 hover:bg-live"
                          : isEnded
                            ? "bg-muted text-foreground-muted"
                            : "bg-primary/90 hover:bg-primary"
                      )}>
                        {isOngoing && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                        {isOngoing ? t.tournament.ongoing : isEnded ? t.tournament.ended : t.tournament.upcoming}
                      </Badge>
                      {tournament.start_date && (
                        <span className="text-xs text-foreground-muted">
                          {format(new Date(tournament.start_date), "MMM dd")}
                          {tournament.end_date && ` - ${format(new Date(tournament.end_date), "dd")}`}
                        </span>
                      )}
                    </div>

                    {/* Tournament name */}
                    <h3 className="font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                      {tournament.name}
                    </h3>

                    {/* Description */}
                    {tournament.description && (
                      <p className="text-sm text-foreground-muted line-clamp-2 mb-4">
                        {tournament.description}
                      </p>
                    )}

                    {/* CTA */}
                    <div className="mt-auto pt-3">
                      <Button size="sm" className="w-full btn-gradient border-0 rounded-lg gap-1.5">
                        <Trophy className="w-3.5 h-3.5" />
                        {language === 'vi' ? 'Xem chi tiết' : 'View Details'}
                      </Button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}


      {/* VietnameseContentTeaser removed — unified into ViHomeBlogSection above */}

      {/* SEO Content Section - Features Overview */}
      <section className="container-wide py-12 border-t border-white/5">
        <div className="grid md:grid-cols-3 gap-4 md:gap-6">
          {/* Livestream */}
          <div className="glass-card p-6 md:p-7 space-y-4 group hover:border-emerald-500/20">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 flex items-center justify-center ring-1 ring-emerald-500/10">
              <Tv className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">{t.home.features.livestreamTitle}</h2>
            <p className="text-sm text-foreground-secondary leading-relaxed">
              {t.home.features.livestreamDesc}
            </p>
          </div>

          {/* Tournaments */}
          <div className="glass-card p-6 md:p-7 space-y-4 group hover:border-amber-500/20">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center ring-1 ring-amber-500/10">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">{t.home.features.tournamentsTitle}</h2>
            <p className="text-sm text-foreground-secondary leading-relaxed">
              {t.home.features.tournamentsDesc}
            </p>
          </div>

          {/* Community */}
          <div className="glass-card p-6 md:p-7 space-y-4 group hover:border-blue-500/20">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 flex items-center justify-center ring-1 ring-blue-500/10">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">{t.home.features.communityTitle}</h2>
            <p className="text-sm text-foreground-secondary leading-relaxed">
              {t.home.features.communityDesc}
            </p>
          </div>
        </div>
      </section>

      {/* SEO Footer Content - About ThePickleHub */}
      <section className="container-wide py-12 glass-card mb-8">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">{t.home.about.title}</h2>
          <p className="text-foreground-secondary leading-relaxed">
            {t.home.about.description}
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Link to="/live" className="text-primary hover:underline font-medium">{t.home.about.watchLive}</Link>
            <Link to="/tournaments" className="text-primary hover:underline font-medium">{t.home.about.tournaments}</Link>
            <Link to="/tools" className="text-primary hover:underline font-medium">{t.home.about.freeTools}</Link>
          </div>
        </div>
      </section>

      {/* Footer - Using plain <a> tag for Google OAuth Branding Verification */}
      <footer className="container-wide py-8 border-t border-border">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-foreground-muted">
          <p>©{new Date().getFullYear()} ThePickleHub – Pickleball Tournaments, Livestream & Community</p>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            {/* Product Hunt badge — ThePickleHub launched 2026-04-21.
                Uses inline SVG logo instead of PH embed-image endpoint because
                PH's image endpoint requires a numeric post_id (not exposed via
                the product-page share URL we received). This keeps the badge
                self-contained, zero network, and lets us control styling. */}
            <a
              href="https://www.producthunt.com/products/thepicklehub?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-thepicklehub"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="ThePickleHub on Product Hunt"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#da552f]/10 border border-[#da552f]/30 text-xs font-medium text-[#da552f] hover:bg-[#da552f]/20 transition-colors"
            >
              <svg viewBox="0 0 40 40" width="14" height="14" aria-hidden="true" fill="currentColor">
                <path d="M20 40C31.046 40 40 31.046 40 20S31.046 0 20 0 0 8.954 0 20s8.954 20 20 20Zm-3-22h6a4 4 0 0 0 0-8h-6v8Zm0 4v10h-4V10h10a8 8 0 1 1 0 16h-6Z" />
              </svg>
              <span>Featured on Product Hunt</span>
            </a>
            <a href="/terms" className="hover:text-foreground transition-colors">
              {t.terms.title.replace(" – The Pickle Hub", "")}
            </a>
            <a href="/privacy" className="hover:text-foreground transition-colors">
              {t.privacy.title.replace(" – The Pickle Hub", "")}
            </a>
            <a className="hover:text-foreground transition-colors" href="mailto:thepicklehub.net@gmail.com">
              thepicklehub.net@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </MainLayout>);

};

export default Index;
import { MainLayout } from "@/components/layout";
import { SectionHeader, LiveCard, ContentCard, EmptyState, AdSlot } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { useLivestreams, useVideos } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Play, Radio, Trophy, Users, Tv } from "lucide-react";
import { OpenRegistrationSection } from "@/components/quicktable/OpenRegistrationSection";
import { DynamicMeta } from "@/components/seo";

const Index = () => {
  const { t } = useI18n();
  
  const { data: liveStreams = [], isLoading: liveLoading } = useLivestreams("live");
  const { data: videos = [], isLoading: videosLoading } = useVideos({ limit: 8 });

  return (
    <MainLayout>
      {/* SEO Meta Tags */}
      <DynamicMeta 
        title="Pickleball Tournaments, Livestream & Community"
        description="ThePickleHub là nền tảng pickleball hàng đầu Việt Nam với livestream trực tiếp các giải đấu, bracket chia bảng thông minh, và cộng đồng pickleball sôi động. Xem livestream, theo dõi giải đấu và kết nối ngay!"
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="container-wide py-16 md:py-24 lg:py-32">
          <div className="max-w-2xl space-y-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <Radio className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">{t.home.hero.badge}</span>
            </div>
            
            {/* H1 - Only one per page */}
            <h1 className="text-foreground text-balance">
              {t.home.hero.mainTitle}
            </h1>
            
            <p className="text-lg text-foreground-secondary leading-relaxed">
              {t.home.hero.mainDescription}
            </p>
            
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/live">
                <Button size="lg" className="gap-2">
                  <Play className="w-4 h-4" fill="currentColor" />
                  {t.live.watchLive}
                </Button>
              </Link>
              <Link to="/videos">
                <Button variant="outline" size="lg" className="gap-2">
                  {t.home.hero.cta}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Decorative gradient */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
      </section>

      {/* SEO Content Section - About ThePickleHub */}
      <section className="container-wide py-12 border-b border-border">
        <div className="grid md:grid-cols-3 gap-8">
          {/* H2 - Livestream */}
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Tv className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">{t.home.features.livestreamTitle}</h2>
            <p className="text-foreground-secondary leading-relaxed">
              {t.home.features.livestreamDesc}
            </p>
          </div>
          
          {/* H2 - Tournaments */}
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">{t.home.features.tournamentsTitle}</h2>
            <p className="text-foreground-secondary leading-relaxed">
              {t.home.features.tournamentsDesc}
            </p>
          </div>
          
          {/* H2 - Community */}
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">{t.home.features.communityTitle}</h2>
            <p className="text-foreground-secondary leading-relaxed">
              {t.home.features.communityDesc}
            </p>
          </div>
        </div>
      </section>

      {/* Live Now Section */}
      <section className="container-wide section-spacing">
        <SectionHeader title={t.home.sections.liveNow} href="/live" />
        
        {liveLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : liveStreams.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {liveStreams.slice(0, 3).map((stream) => (
              <LiveCard
                key={stream.id}
                id={stream.id!}
                title={stream.title ?? ""}
                viewerCount={0}
                organizationName={stream.organization?.name ?? ""}
                organizationSlug={stream.organization?.slug}
                status={stream.status as "live" | "scheduled" | "ended"}
                thumbnail={stream.thumbnail_url ?? undefined}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={Radio} title={t.home.noLive} />
        )}
      </section>

      {/* Open Registration Tournaments */}
      <OpenRegistrationSection limit={5} showViewAll={true} />

      {/* Ad Slot */}
      <div className="container-wide">
        <AdSlot variant="banner" />
      </div>

      {/* Latest Videos */}
      <section className="container-wide section-spacing">
        <SectionHeader title={t.home.sections.latestVideos} href="/videos" />
        
        {videosLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : videos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {videos.slice(0, 4).map((video) => (
              <ContentCard
                key={video.id}
                id={video.id}
                title={video.title}
                duration={video.duration_seconds ?? 0}
                views={0}
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

      {/* Popular This Week */}
      <section className="container-wide section-spacing">
        <SectionHeader title={t.home.sections.popularThisWeek} href="/videos?sort=popular" />
        
        {videosLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : videos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {videos.slice().reverse().slice(0, 4).map((video) => (
              <ContentCard
                key={video.id}
                id={video.id}
                title={video.title}
                duration={video.duration_seconds ?? 0}
                views={0}
                organizationName={video.organization?.name ?? ""}
                organizationSlug={video.organization?.slug}
                thumbnail={video.thumbnail_url ?? undefined}
              />
            ))}
          </div>
        ) : null}
      </section>

      {/* SEO Footer Content */}
      <section className="container-wide py-12 bg-surface-elevated rounded-xl mb-8">
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
          <p>© 2024 ThePickleHub – Pickleball Tournaments, Livestream & Community</p>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </a>
            <a href="mailto:tapickleballvn@gmail.com" className="hover:text-foreground transition-colors">
              tapickleballvn@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </MainLayout>
  );
};

export default Index;

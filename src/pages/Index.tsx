import { MainLayout } from "@/components/layout";
import { SectionHeader, LiveCard, ContentCard, EmptyState, AdSlot } from "@/components/content";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Play, Radio } from "lucide-react";

// Mock data for demo
const mockLivestreams = [
  { id: "1", title: "Vietnam Pickleball Open 2024 - Chung kết nam đơn", viewerCount: 1234, organizationName: "VN Pickleball", status: "live" as const },
  { id: "2", title: "Giải Pickleball Hà Nội mở rộng - Bán kết", viewerCount: 856, organizationName: "Hanoi PB Club", status: "live" as const },
];

const mockVideos = [
  { id: "1", title: "Hướng dẫn kỹ thuật dink cơ bản cho người mới", duration: 845, views: 12500, organizationName: "PB Academy" },
  { id: "2", title: "Top 10 pha rally đỉnh cao tháng 12/2024", duration: 623, views: 8900, organizationName: "VN Pickleball" },
  { id: "3", title: "Phỏng vấn nhà vô địch Nguyễn Văn A", duration: 1245, views: 5600, organizationName: "Sports TV" },
  { id: "4", title: "Chiến thuật đôi nam: Stacking và Switching", duration: 1890, views: 4200, organizationName: "PB Academy" },
];

const Index = () => {
  const { t } = useI18n();

  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="container-wide py-16 md:py-24 lg:py-32">
          <div className="max-w-2xl space-y-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <Radio className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Livestream & Video</span>
            </div>
            
            <h1 className="text-foreground text-balance">
              {t.home.hero.title}
            </h1>
            
            <p className="text-lg text-foreground-secondary leading-relaxed">
              {t.home.hero.description}
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

      {/* Live Now Section */}
      <section className="container-wide section-spacing">
        <SectionHeader title={t.home.sections.liveNow} href="/live" />
        
        {mockLivestreams.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {mockLivestreams.map((stream) => (
              <LiveCard key={stream.id} {...stream} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Radio} title={t.home.noLive} />
        )}
      </section>

      {/* Ad Slot */}
      <div className="container-wide">
        <AdSlot variant="banner" />
      </div>

      {/* Latest Videos */}
      <section className="container-wide section-spacing">
        <SectionHeader title={t.home.sections.latestVideos} href="/videos" />
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {mockVideos.map((video) => (
            <ContentCard key={video.id} {...video} />
          ))}
        </div>
      </section>

      {/* Popular This Week */}
      <section className="container-wide section-spacing">
        <SectionHeader title={t.home.sections.popularThisWeek} href="/videos?sort=popular" />
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {mockVideos.slice().reverse().map((video) => (
            <ContentCard key={video.id} {...video} />
          ))}
        </div>
      </section>
    </MainLayout>
  );
};

export default Index;

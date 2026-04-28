import { useI18n } from "@/i18n";
import { MainLayout } from "@/components/layout";
import { DynamicMeta, HreflangTags, SoftwareApplicationSchema, FAQSchema, ToolsHubSeoContent } from "@/components/seo";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Users, Swords, Trophy, GitBranch, Sparkles, Monitor, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MyRefereeTournaments } from "@/components/tools/MyRefereeTournaments";
import { useAuth } from "@/hooks/useAuth";

interface ToolCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  comingSoon?: boolean;
  highlight?: boolean;
  emoji?: string;
  gradientClass?: string;
}

const ToolCard = ({ title, description, icon, href, comingSoon, highlight, emoji, gradientClass = "from-primary/20 to-primary/5" }: ToolCardProps) => {
  const { t, language } = useI18n();

  const content = (
    <Card className={cn(
      "group h-full transition-all duration-300 bg-transparent border-white/[0.06] backdrop-blur-xl overflow-hidden relative",
      comingSoon
        ? "opacity-50 cursor-not-allowed"
        : "hover:border-primary/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 cursor-pointer",
      highlight && "border-primary/40 bg-primary/5 shadow-lg shadow-primary/10 ring-1 ring-primary/20"
    )}>
      {/* Gradient glow on hover */}
      {!comingSoon && (
        <div className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br pointer-events-none",
          gradientClass
        )} />
      )}
      <CardHeader className="pb-4 relative z-10">
        <div className="flex items-start justify-between mb-1">
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-transform duration-300",
            !comingSoon && "group-hover:scale-110",
            highlight
              ? "bg-gradient-to-br from-primary to-emerald-400 text-white shadow-lg shadow-primary/25"
              : cn("bg-gradient-to-br shadow-lg", gradientClass)
          )}>
            {emoji ? <span className="text-2xl">{emoji}</span> : icon}
          </div>
          {comingSoon && (
            <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
              {t.tools.comingSoon}
            </Badge>
          )}
          {highlight && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse mr-1.5 inline-block" />
              Live
            </Badge>
          )}
        </div>
        <CardTitle className="text-lg mt-3 group-hover:text-primary transition-colors">{title}</CardTitle>
        <CardDescription className="text-foreground-secondary/80 leading-relaxed">{description}</CardDescription>
        {!comingSoon && (
          <div className="flex items-center gap-1 text-sm font-medium text-primary mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {language === "vi" ? "Mở công cụ" : "Open tool"}
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        )}
      </CardHeader>
    </Card>
  );

  if (comingSoon || !href) {
    return content;
  }

  return (
    <Link to={href} className="block h-full">
      {content}
    </Link>
  );
};

/**
 * Legacy Tools page — archived 2026-04-28 during sub-route cutover.
 * Accessible at /tools-legacy for 14-day rollback. Cleanup 2026-05-09.
 */
const ToolsLegacy = () => {
  const { t, language } = useI18n();
  const { user } = useAuth();

  const tools: ToolCardProps[] = [
    {
      title: t.tools.quickTable.title,
      description: t.tools.quickTable.description,
      icon: <Users className="w-6 h-6" />,
      emoji: "🏓",
      gradientClass: "from-emerald-500/20 to-emerald-500/5",
      href: "/tools/quick-tables",
    },
    {
      title: t.tools.teamMatch.title,
      description: t.tools.teamMatch.description,
      icon: <Swords className="w-6 h-6" />,
      emoji: "⚔️",
      gradientClass: "from-amber-500/20 to-amber-500/5",
      href: "/tools/team-match",
    },
    {
      title: t.tools.singleElimination.title,
      description: t.tools.singleElimination.description,
      icon: <Trophy className="w-6 h-6" />,
      emoji: "🏆",
      gradientClass: "from-yellow-500/20 to-yellow-500/5",
      comingSoon: true,
    },
    {
      title: t.tools.doublesElimination.title,
      description: t.tools.doublesElimination.description,
      icon: <GitBranch className="w-6 h-6" />,
      emoji: "🔀",
      gradientClass: "from-blue-500/20 to-blue-500/5",
      href: "/tools/doubles-elimination",
    },
    {
      title: t.tools.flexTournament.title,
      description: t.tools.flexTournament.description,
      icon: <Sparkles className="w-6 h-6" />,
      emoji: "✨",
      gradientClass: "from-purple-500/20 to-purple-500/5",
      href: "/tools/flex-tournament",
    },
    {
      title: t.dashboard.title,
      description: t.dashboard.description,
      icon: <Monitor className="w-6 h-6" />,
      emoji: "📊",
      gradientClass: "from-primary/20 to-emerald-400/5",
      href: "/tools/dashboard",
      highlight: true,
    },
  ];

  return (
    <MainLayout>
      <DynamicMeta
        title="Free Pickleball Tournament Software – Bracket Generator, Team Match & Scoring"
        description="Free pickleball tournament software for organizers. Generate brackets, run round robin, MLP team matches & double elimination. Real-time scoring, mobile-friendly. No signup required."
        url="https://www.thepicklehub.net/tools"
      />
      <HreflangTags enPath="/tools" viPath="/vi/tools" />
      <SoftwareApplicationSchema
        name="ThePickleHub – Free Pickleball Tournament Software"
        description="Free pickleball tournament software and bracket generator. Create round-robin brackets, MLP team matches, double elimination tournaments. Real-time scoring, mobile-friendly, no signup required."
        applicationCategory="SportsApplication"
        operatingSystem="Web"
        offers={{ price: "0", priceCurrency: "USD" }}
        aggregateRating={{ ratingValue: 4.8, ratingCount: 156 }}
      />
      <FAQSchema items={[
        { question: "Is ThePickleHub tournament software free?", answer: "Yes, all tournament tools on ThePickleHub are completely free. You can create round robin brackets, double elimination tournaments, MLP team matches, and flex tournaments without any payment or subscription." },
        { question: "Do I need to create an account to use the bracket generator?", answer: "No signup is required to create and manage tournaments. Anyone can create a bracket instantly. An account is only needed for advanced features like saving tournaments to your profile." },
        { question: "What tournament formats does ThePickleHub support?", answer: "ThePickleHub supports four tournament formats: Quick Tables (round robin with optional playoffs), Team Match (MLP-style team competitions), Double Elimination (winner and loser brackets), and Flex Tournament (fully customizable format)." },
        { question: "Can referees score matches from their phones?", answer: "Yes, ThePickleHub has a dedicated referee mode. Tournament organizers can assign referees who update match scores in real-time from any mobile device. All participants see live score updates." },
        { question: "How many players can a tournament support?", answer: "Quick Tables support 4 to 200+ players with automatic group distribution. Double Elimination supports up to 128 teams. Team Match supports multiple teams with customizable roster sizes." },
      ]} />
      <div className="container-wide py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gradient-brand mb-2">
            {t.tools.title}
          </h1>
          <p className="text-foreground-secondary">
            {t.tools.description}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {language === "vi" 
              ? "Tạo pickleball brackets, bracket maker miễn phí, phần mềm quản lý giải đấu cho CLB và BTC."
              : "Create pickleball brackets with our free bracket maker. Tournament bracket generator for clubs, leagues, and organizers."}
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {tools.map((tool) => (
            <ToolCard key={tool.title} {...tool} />
          ))}
        </div>

        {/* Referee Tournaments Section */}
        {user && (
          <div className="mt-8">
            <MyRefereeTournaments />
          </div>
        )}

        {/* SEO Content Section */}
        <ToolsHubSeoContent />
      </div>
    </MainLayout>
  );
};

export default ToolsLegacy;

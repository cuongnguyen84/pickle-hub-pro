import { useI18n } from "@/i18n";
import { MainLayout } from "@/components/layout";
import { DynamicMeta, SoftwareApplicationSchema, ToolsHubSeoContent } from "@/components/seo";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Users, Swords, Trophy, GitBranch, Sparkles, Monitor } from "lucide-react";
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
}

const ToolCard = ({ title, description, icon, href, comingSoon, highlight }: ToolCardProps) => {
  const { t } = useI18n();
  
  const content = (
    <Card className={cn(
      "h-full transition-all duration-200",
      comingSoon 
        ? "opacity-60 cursor-not-allowed" 
        : "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 cursor-pointer",
      highlight && "border-primary/60 bg-primary/5 shadow-lg shadow-primary/10 ring-1 ring-primary/20"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            highlight ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
          )}>
            {icon}
          </div>
          {comingSoon && (
            <Badge variant="secondary" className="text-xs">
              {t.tools.comingSoon}
            </Badge>
          )}
          {highlight && (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs animate-pulse">
              Live
            </Badge>
          )}
        </div>
        <CardTitle className="text-lg mt-3">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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

const Tools = () => {
  const { t, language } = useI18n();
  const { user } = useAuth();

  const tools: ToolCardProps[] = [
    {
      title: t.tools.quickTable.title,
      description: t.tools.quickTable.description,
      icon: <Users className="w-6 h-6" />,
      href: "/tools/quick-tables",
    },
    {
      title: t.tools.teamMatch.title,
      description: t.tools.teamMatch.description,
      icon: <Swords className="w-6 h-6" />,
      href: "/tools/team-match",
    },
    {
      title: t.tools.singleElimination.title,
      description: t.tools.singleElimination.description,
      icon: <Trophy className="w-6 h-6" />,
      comingSoon: true,
    },
    {
      title: t.tools.doublesElimination.title,
      description: t.tools.doublesElimination.description,
      icon: <GitBranch className="w-6 h-6" />,
      href: "/tools/doubles-elimination",
    },
    {
      title: t.tools.flexTournament.title,
      description: t.tools.flexTournament.description,
      icon: <Sparkles className="w-6 h-6" />,
      href: "/tools/flex-tournament",
    },
    {
      title: t.dashboard.title,
      description: t.dashboard.description,
      icon: <Monitor className="w-6 h-6" />,
      href: "/tools/dashboard",
      highlight: true,
    },
  ];

  return (
    <MainLayout>
      <DynamicMeta 
        title="Free Pickleball Tournament Software – Bracket Generator, Team Match & Scoring"
        description="Free pickleball tournament software for organizers. Generate brackets, run round robin, MLP team matches & double elimination. Real-time scoring, mobile-friendly. No signup required."
        url="https://thepicklehub.net/tools"
        enableHreflang={true}
      />
      <SoftwareApplicationSchema
        name="ThePickleHub – Free Pickleball Tournament Software"
        description="Free pickleball tournament software and bracket generator. Create round-robin brackets, MLP team matches, double elimination tournaments. Real-time scoring, mobile-friendly, no signup required."
        applicationCategory="SportsApplication"
        operatingSystem="Web"
        offers={{ price: "0", priceCurrency: "USD" }}
      />
      <div className="container-wide py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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

export default Tools;

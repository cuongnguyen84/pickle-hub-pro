import { useI18n } from "@/i18n";
import { MainLayout } from "@/components/layout";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Users, Swords, Trophy, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { MyRefereeTournaments } from "@/components/tools/MyRefereeTournaments";
import { useAuth } from "@/hooks/useAuth";

interface ToolCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  comingSoon?: boolean;
}

const ToolCard = ({ title, description, icon, href, comingSoon }: ToolCardProps) => {
  const { t } = useI18n();
  
  const content = (
    <Card className={cn(
      "h-full transition-all duration-200",
      comingSoon 
        ? "opacity-60 cursor-not-allowed" 
        : "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
          {comingSoon && (
            <Badge variant="secondary" className="text-xs">
              {t.tools.comingSoon}
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
  const { t } = useI18n();
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
  ];

  return (
    <MainLayout>
      <div className="container-wide py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            {t.tools.title}
          </h1>
          <p className="text-foreground-secondary">
            {t.tools.description}
          </p>
        </div>

        {/* Referee Tournaments Section */}
        {user && (
          <div className="mb-8">
            <MyRefereeTournaments />
          </div>
        )}

        {/* Tools Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tools.map((tool) => (
            <ToolCard key={tool.title} {...tool} />
          ))}
        </div>
      </div>
    </MainLayout>
  );
};

export default Tools;

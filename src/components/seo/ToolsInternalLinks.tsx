import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { Users, Trophy, Layers } from "lucide-react";

interface ToolsInternalLinksProps {
  currentTool: "quick-tables" | "doubles-elimination" | "flex-tournament" | "team-match";
}

/**
 * Internal linking component for tools pages
 * Helps SEO by cross-linking between tournament tools
 */
export const ToolsInternalLinks = ({ currentTool }: ToolsInternalLinksProps) => {
  const { language } = useI18n();

  const tools = [
    {
      id: "quick-tables" as const,
      path: "/tools/quick-tables",
      icon: Users,
      title: language === "vi" ? "Chia bảng nhanh" : "Quick Tables",
      description: language === "vi" 
        ? "Chia bảng tự động, tạo lịch thi đấu round robin hoặc playoff"
        : "Auto bracket generator for round robin or playoff formats",
    },
    {
      id: "team-match" as const,
      path: "/tools/team-match",
      icon: Users,
      title: language === "vi" ? "Đồng đội MLP" : "Team Match",
      description: language === "vi"
        ? "Thi đấu theo đội kiểu Major League Pickleball"
        : "MLP-style team competition with lineup management",
    },
    {
      id: "doubles-elimination" as const,
      path: "/tools/doubles-elimination",
      icon: Trophy,
      title: language === "vi" ? "Loại trực tiếp đôi" : "Doubles Elimination",
      description: language === "vi"
        ? "Bracket loại trực tiếp cho các giải đấu đôi"
        : "Single elimination bracket for doubles tournaments",
    },
    {
      id: "flex-tournament" as const,
      path: "/tools/flex-tournament",
      icon: Layers,
      title: language === "vi" ? "Giải đấu linh hoạt" : "Flex Tournament",
      description: language === "vi"
        ? "Tạo cấu trúc giải đấu tùy chỉnh, không giới hạn format"
        : "Create custom tournament structures with no format restrictions",
    },
  ];

  // Filter out current tool
  const otherTools = tools.filter((tool) => tool.id !== currentTool);

  return (
    <nav className="mt-8 pt-6 border-t border-border">
      <h3 className="text-base font-semibold text-foreground mb-4">
        {language === "vi" ? "Công cụ giải đấu khác" : "Other Tournament Tools"}
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {otherTools.map((tool) => (
          <Link
            key={tool.id}
            to={tool.path}
            className="group flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              <tool.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium text-foreground group-hover:text-primary transition-colors">
                {tool.title}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {tool.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </nav>
  );
};

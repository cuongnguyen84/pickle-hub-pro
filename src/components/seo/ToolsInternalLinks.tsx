import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { localePath } from "@/lib/locale-path";
import { Users, Trophy, Layers } from "lucide-react";

interface ToolsInternalLinksProps {
  currentTool: "quick-tables" | "doubles-elimination" | "flex-tournament" | "team-match" | "hub";
}

/**
 * Internal linking component for tools pages
 * Helps SEO by cross-linking between tournament tools
 */
export const ToolsInternalLinks = ({ currentTool }: ToolsInternalLinksProps) => {
  const { language } = useI18n();
  const vi = language === "vi";
  const lp = (path: string) => localePath(path, vi ? "vi" : "en");

  const tools = [
    {
      id: "hub" as const,
      path: lp("/tools"),
      icon: Users,
      title: vi ? "Tất cả công cụ giải đấu" : "All Tournament Tools",
      description: vi
        ? "Công cụ tổ chức giải pickleball miễn phí — chia bảng, đấu đồng đội, loại trực tiếp"
        : "Free pickleball tournament software — brackets, team match, elimination",
    },
    {
      id: "quick-tables" as const,
      path: lp("/tools/quick-tables"),
      icon: Users,
      title: vi ? "Chia bảng" : "Pickleball Bracket Generator",
      description: vi
        ? "Chia bảng, xếp lịch đánh vòng tròn hoặc vòng loại trực tiếp"
        : "Auto bracket generator for round robin or playoff formats",
    },
    {
      id: "team-match" as const,
      path: lp("/tools/team-match"),
      icon: Users,
      title: vi ? "Đấu đồng đội" : "MLP Team Match Software",
      description: vi
        ? "Hai đội đấu với nhau, có trận quyết định khi hoà"
        : "MLP-style team competition with lineup management",
    },
    {
      id: "doubles-elimination" as const,
      path: lp("/tools/doubles-elimination"),
      icon: Trophy,
      title: vi ? "Loại trực tiếp đôi" : "Double Elimination Bracket",
      description: vi
        ? "Thua một trận vẫn còn một cơ hội, rồi vào chung kết"
        : "Double elimination bracket for doubles pickleball tournaments",
    },
    {
      id: "flex-tournament" as const,
      path: lp("/tools/flex-tournament"),
      icon: Layers,
      title: vi ? "Giải linh hoạt" : "Custom Tournament Bracket Maker",
      description: vi
        ? "Tự chọn vòng, bảng và cách xếp"
        : "Create custom tournament structures with no format restrictions",
    },
  ];

  const otherTools = tools.filter((tool) => tool.id !== currentTool);

  return (
    <nav style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--tl-border)" }}>
      <div
        style={{
          fontFamily: "Geist Mono, ui-monospace, monospace",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--tl-fg-3)",
          marginBottom: 16,
        }}
      >
        ◆ {language === "vi" ? "Công cụ khác" : "Other tools"}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 1,
          background: "var(--tl-border)",
          border: "1px solid var(--tl-border)",
          borderRadius: "var(--tl-radius-lg)",
          overflow: "hidden",
        }}
      >
        {otherTools.map((tool) => (
          <Link
            key={tool.id}
            to={tool.path}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              padding: 18,
              background: "var(--tl-bg)",
              textDecoration: "none",
              color: "inherit",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--tl-bg-elev)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--tl-bg)";
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: "var(--tl-green-glow)",
                color: "var(--tl-green)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <tool.icon className="w-5 h-5" />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h4
                style={{
                  fontFamily: "Instrument Serif, serif",
                  fontStyle: "italic",
                  fontWeight: 400,
                  fontSize: 18,
                  letterSpacing: "-0.015em",
                  lineHeight: 1.15,
                  color: "var(--tl-fg)",
                  margin: 0,
                }}
              >
                {tool.title}
              </h4>
              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--tl-fg-3)",
                  margin: "6px 0 0",
                  lineHeight: 1.5,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {tool.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </nav>
  );
};

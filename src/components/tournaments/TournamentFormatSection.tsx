import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, Mail, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

interface TournamentItem {
  id: string;
  name: string;
  share_id: string;
  creator_display_name?: string | null;
  [key: string]: unknown;
}

interface TournamentFormatSectionProps {
  icon: React.ReactNode;
  title: string;
  activeItems: TournamentItem[];
  completedItems: TournamentItem[];
  basePath: string;
  renderMeta?: (item: TournamentItem, isActive: boolean) => React.ReactNode;
}

export const TournamentFormatSection = ({
  icon,
  title,
  activeItems,
  completedItems,
  basePath,
  renderMeta,
}: TournamentFormatSectionProps) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [expanded, setExpanded] = useState(false);

  if (activeItems.length === 0 && completedItems.length === 0) return null;

  const items = tab === "active" ? activeItems : completedItems;
  const displayItems = expanded ? items : items.slice(0, 5);

  return (
    <Card className="mb-6 bg-transparent border-white/[0.06] backdrop-blur-xl">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          {icon}
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant={tab === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => { setTab("active"); setExpanded(false); }}
          >
            {t.tournament.ongoing} ({activeItems.length})
          </Button>
          <Button
            variant={tab === "completed" ? "default" : "outline"}
            size="sm"
            onClick={() => { setTab("completed"); setExpanded(false); }}
          >
            {t.tournament.ended} ({completedItems.length})
          </Button>
        </div>
      </div>
      <div className="px-4 pb-4 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t.common.noResults}</p>
        ) : (
          <>
            {displayItems.map((item) => (
              <Link
                key={item.id}
                to={`${basePath}/${item.share_id}`}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.name}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {renderMeta?.(item, tab === "active")}
                      {item.creator_display_name && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="truncate max-w-[150px]">{item.creator_display_name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-13 sm:pl-0">
                  <Badge variant="outline" className={cn(
                    "text-xs whitespace-nowrap",
                    tab === "active"
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-muted text-muted-foreground border-border"
                  )}>
                    {tab === "active" ? t.tournament.ongoing : t.quickTable.status.completed}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-foreground-muted flex-shrink-0" />
                </div>
              </Link>
            ))}
            {items.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={(e) => { e.preventDefault(); setExpanded(!expanded); }}
              >
                {expanded ? t.quickTable.showLess : `${t.quickTable.showMore} (${items.length})`}
              </Button>
            )}
          </>
        )}
      </div>
    </Card>
  );
};

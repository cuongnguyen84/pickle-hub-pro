import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, MapPin, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { ParentTournamentWithPreview } from "@/hooks/useParentTournament";
import { useI18n } from "@/i18n";

interface ParentTournamentCardProps {
  parent: ParentTournamentWithPreview;
  isOwner: boolean;
  variant?: "default" | "featured";
}

const STATUS_CONFIG: Record<string, { labelVi: string; labelEn: string; className: string }> = {
  setup: {
    labelVi: "Sắp diễn",
    labelEn: "Upcoming",
    className: "border-muted-foreground/30 text-muted-foreground",
  },
  group_stage: {
    labelVi: "Vòng bảng",
    labelEn: "Group stage",
    className: "border-blue-500/30 text-blue-400 bg-blue-500/10",
  },
  playoff: {
    labelVi: "Playoff",
    labelEn: "Playoff",
    className: "border-orange-500/30 text-orange-400 bg-orange-500/10",
  },
  completed: {
    labelVi: "Hoàn thành",
    labelEn: "Completed",
    className: "border-green-500/30 text-green-400 bg-green-500/10",
  },
};

const ParentTournamentCard = ({ parent, isOwner, variant = "default" }: ParentTournamentCardProps) => {
  const navigate = useNavigate();
  const { language, t } = useI18n();
  const isVi = language === "vi";
  const pt = t.quickTable.parentTournament;
  const isFeatured = variant === "featured";

  const handleHeaderClick = () => {
    navigate(`/tools/quick-tables/parent/${parent.share_id}`);
  };

  const handleSubEventClick = (e: React.MouseEvent, shareId: string) => {
    e.stopPropagation();
    navigate(`/tools/quick-tables/${shareId}`);
  };

  const handleAddEvent = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/tools/quick-tables?parentId=${parent.id}`);
  };

  const remaining = parent.subEventCount - parent.previewSubEvents.length;

  return (
    <Card
      className={cn(
        "p-5 space-y-3 relative overflow-hidden",
        isFeatured
          ? "bg-gradient-to-br from-amber-500/[0.07] via-card/90 to-orange-500/[0.07] ring-1 ring-amber-500/30"
          : "bg-card/80"
      )}
    >
      {/* Featured shimmer accent */}
      {isFeatured && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />
      )}

      {/* Banner image for featured */}
      {isFeatured && parent.banner_url && (
        <div className="-mx-5 -mt-5 mb-3">
          <img
            src={parent.banner_url}
            alt={parent.name}
            className="w-full aspect-[3/1] object-cover"
          />
        </div>
      )}

      {/* Header — clickable to parent page */}
      <div className="cursor-pointer" onClick={handleHeaderClick}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Trophy className={cn("w-5 h-5 shrink-0", isFeatured ? "text-amber-500" : "text-primary")} />
            <h3 className="text-lg font-semibold text-foreground truncate">
              {parent.name}
            </h3>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 text-xs whitespace-nowrap",
              isFeatured
                ? "border-amber-500/40 text-amber-500"
                : "border-primary/50 text-primary"
            )}
          >
            {pt.subEventCount.replace("{count}", String(parent.subEventCount))}
          </Badge>
        </div>

        {/* Meta row */}
        {(parent.event_date || parent.location) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-muted-foreground">
            {parent.event_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(parent.event_date), "dd/MM/yyyy")}
              </span>
            )}
            {parent.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {parent.location}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className={cn("border-t", isFeatured ? "border-amber-500/20" : "border-border/50")} />

      {/* Sub-event preview list */}
      {parent.previewSubEvents.length > 0 ? (
        <div className="space-y-1">
          {parent.previewSubEvents.map((se) => {
            const config = STATUS_CONFIG[se.status];
            return (
              <div
                key={se.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/30 cursor-pointer transition-colors"
                onClick={(e) => handleSubEventClick(e, se.share_id)}
              >
                <span className="text-muted-foreground text-sm">•</span>
                <span className="flex-1 text-sm font-medium truncate min-w-0">
                  {se.name}
                </span>
                {config && (
                  <Badge
                    variant="outline"
                    className={cn("text-xs shrink-0 px-2 py-0", config.className)}
                  >
                    {isVi ? config.labelVi : config.labelEn}
                  </Badge>
                )}
              </div>
            );
          })}

          {/* "+ N more" link */}
          {remaining > 0 && (
            <div
              className="text-sm text-muted-foreground italic text-center pt-1 cursor-pointer hover:text-primary transition-colors"
              onClick={handleHeaderClick}
            >
              {pt.moreEvents
                ? pt.moreEvents.replace("{count}", String(remaining))
                : `+ ${remaining} more`}
            </div>
          )}
        </div>
      ) : (
        /* Empty state */
        <div className="text-center py-3 space-y-2">
          <p className="text-sm text-muted-foreground italic">
            {pt.noEventsYet || (isVi ? "Chưa có nội dung nào" : "No events yet")}
          </p>
          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary"
              onClick={handleAddEvent}
            >
              <Plus className="w-4 h-4 mr-1" />
              {pt.addFirstEvent || pt.addSubEvent}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
};

export default ParentTournamentCard;

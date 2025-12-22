import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { Trophy, Calendar, Share2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "react-router-dom";
import { FollowButton } from "@/components/follow";

interface TournamentHeroProps {
  id: string;
  name: string;
  description?: string | null;
  status: "upcoming" | "ongoing" | "ended";
  startDate?: string | null;
  endDate?: string | null;
  slug: string;
}

export const TournamentHero = ({
  id,
  name,
  description,
  status,
  startDate,
  endDate,
  slug,
}: TournamentHeroProps) => {
  const { t } = useI18n();

  const statusConfig = {
    ongoing: {
      color: "bg-live/90 text-foreground border-live/50",
      text: t.tournament.ongoing,
      dotClass: "bg-foreground animate-pulse",
    },
    upcoming: {
      color: "bg-primary/90 text-primary-foreground border-primary/50",
      text: t.tournament.upcoming,
      dotClass: null,
    },
    ended: {
      color: "bg-muted text-foreground-muted border-border",
      text: t.tournament.ended,
      dotClass: null,
    },
  };

  const config = statusConfig[status];

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success(t.common.copied);
  };


  return (
    <div className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
      
      <div className="container-wide relative">
        {/* Breadcrumb */}
        <Breadcrumb className="pt-6 pb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/" className="text-foreground-muted hover:text-foreground transition-colors">
                  {t.nav.home}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/tournaments" className="text-foreground-muted hover:text-foreground transition-colors">
                  {t.nav.tournaments}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-foreground font-medium">{name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Hero content */}
        <div className="pb-8 pt-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            {/* Left: Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-7 h-7 text-primary" />
                </div>
                <Badge 
                  className={cn(
                    "px-3 py-1 text-sm font-medium border",
                    config.color
                  )}
                >
                  {config.dotClass && (
                    <span className={cn("w-2 h-2 rounded-full mr-2", config.dotClass)} />
                  )}
                  {config.text}
                </Badge>
              </div>

              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-3">
                {name}
              </h1>

              {(startDate || endDate) && (
                <div className="flex items-center gap-2 text-foreground-secondary mb-4">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm md:text-base">
                    {startDate && format(new Date(startDate), "dd/MM/yyyy")}
                    {startDate && endDate && " – "}
                    {endDate && format(new Date(endDate), "dd/MM/yyyy")}
                  </span>
                </div>
              )}

              {description && (
                <p className="text-foreground-muted max-w-2xl line-clamp-3">
                  {description}
                </p>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="gap-2"
              >
                <Share2 className="w-4 h-4" />
                {t.common.share}
              </Button>
              <FollowButton targetType="tournament" targetId={id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import { Link } from "react-router-dom";
import { Play, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

interface LiveCardProps {
  id: string;
  title: string;
  thumbnail?: string;
  viewerCount?: number;
  organizationName?: string;
  organizationLogo?: string;
  status?: "live" | "scheduled" | "ended";
  scheduledAt?: string;
  className?: string;
}

const LiveCard = ({
  id,
  title,
  thumbnail,
  viewerCount,
  organizationName,
  organizationLogo,
  status = "live",
  scheduledAt,
  className,
}: LiveCardProps) => {
  const { t } = useI18n();

  const formatViewers = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <Link
      to={`/live/${id}`}
      className={cn(
        "group block rounded-xl overflow-hidden card-interactive",
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden rounded-xl bg-background-surface">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-background-surface to-background-elevated">
            <Play className="w-12 h-12 text-foreground-muted" />
          </div>
        )}
        
        {/* Live badge or status */}
        <div className="absolute top-3 left-3">
          {status === "live" ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-live/90 backdrop-blur-sm">
              <span className="live-dot" />
              <span className="text-xs font-semibold text-foreground">{t.live.live}</span>
            </div>
          ) : status === "scheduled" ? (
            <div className="px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm text-xs font-medium text-foreground">
              {t.live.scheduled}
            </div>
          ) : (
            <div className="px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm text-xs font-medium text-foreground-muted">
              {t.live.ended}
            </div>
          )}
        </div>

        {/* Viewer count */}
        {status === "live" && viewerCount !== undefined && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm text-xs font-medium text-foreground">
            <Users className="w-3 h-3" />
            <span>{formatViewers(viewerCount)} {t.live.watching}</span>
          </div>
        )}
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-background/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center">
            <Play className="w-6 h-6 text-primary-foreground ml-0.5" fill="currentColor" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="pt-3 space-y-1">
        <h3 className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-200">
          {title}
        </h3>
        
        <div className="flex items-center gap-2 text-xs text-foreground-muted">
          {organizationName && (
            <div className="flex items-center gap-1.5">
              {organizationLogo ? (
                <img
                  src={organizationLogo}
                  alt={organizationName}
                  className="w-4 h-4 rounded-full object-cover"
                />
              ) : (
                <div className="w-4 h-4 rounded-full bg-muted" />
              )}
              <span className="line-clamp-1">{organizationName}</span>
            </div>
          )}
          
          {status === "scheduled" && scheduledAt && (
            <span>{t.live.scheduledFor} {scheduledAt}</span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default LiveCard;

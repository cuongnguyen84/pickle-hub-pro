import { Link } from "react-router-dom";
import { Play, Users, RotateCcw, BadgeCheck, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { optimizeImageUrl } from "@/lib/image-utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LiveCardProps {
  id: string;
  title: string;
  thumbnail?: string;
  viewerCount?: number;
  totalViews?: number;
  organizationName?: string;
  organizationSlug?: string;
  organizationLogo?: string;
  isVerifiedCreator?: boolean;
  status?: "live" | "scheduled" | "ended";
  scheduledAt?: string;
  className?: string;
  isReplay?: boolean;
  priority?: boolean; // For LCP optimization
}

const LiveCard = ({
  id,
  title,
  thumbnail,
  viewerCount,
  totalViews,
  organizationName,
  organizationSlug,
  organizationLogo,
  isVerifiedCreator = true, // All organizations are verified creators
  status = "live",
  scheduledAt,
  className,
  isReplay = false,
  priority = false,
}: LiveCardProps) => {
  const { t } = useI18n();

  const formatViewers = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // For ended streams with replay, show replay badge
  const showReplayBadge = status === "ended" && isReplay;
  const isLive = status === "live";
  const isEnded = status === "ended";

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
            src={optimizeImageUrl(thumbnail, { width: 640 })}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading={priority ? "eager" : "lazy"}
            decoding={priority ? "sync" : "async"}
            // @ts-ignore - fetchpriority is a valid HTML attribute
            fetchpriority={priority ? "high" : "auto"}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-background-surface to-background-elevated">
            <Play className="w-12 h-12 text-foreground-muted" />
          </div>
        )}
        
        {/* Status badge */}
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
          ) : showReplayBadge ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/90 backdrop-blur-sm">
              <RotateCcw className="w-3 h-3 text-primary-foreground" />
              <span className="text-xs font-semibold text-primary-foreground">{t.live.replay}</span>
            </div>
          ) : (
            <div className="px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm text-xs font-medium text-foreground-muted">
              {t.live.ended}
            </div>
          )}
        </div>

        {/* Viewer/View count badge */}
        <TooltipProvider>
          {isLive && viewerCount !== undefined && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-live/90 backdrop-blur-sm text-xs font-medium text-foreground cursor-help">
                  <Users className="w-3 h-3" />
                  <span>{formatViewers(viewerCount)} {t.live.watching}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t.live.watchingTooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {isEnded && totalViews !== undefined && totalViews > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm text-xs font-medium text-foreground-muted cursor-help">
                  <Eye className="w-3 h-3" />
                  <span>{formatViewers(totalViews)} {t.live.totalViews}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t.live.totalViewsTooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
        
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
                  src={optimizeImageUrl(organizationLogo, { width: 56, height: 56 })}
                  alt={organizationName}
                  className="w-4 h-4 rounded-full object-cover"
                />
              ) : (
                <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-[8px] font-medium text-primary">
                    {organizationName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {organizationSlug ? (
                <Link
                  to={`/org/${organizationSlug}`}
                  onClick={(e) => e.stopPropagation()}
                  className="line-clamp-1 hover:text-primary hover:underline inline-flex items-center gap-1"
                >
                  {organizationName}
                  {isVerifiedCreator && (
                    <BadgeCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                </Link>
              ) : (
                <span className="line-clamp-1 inline-flex items-center gap-1">
                  {organizationName}
                  {isVerifiedCreator && (
                    <BadgeCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                </span>
              )}
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

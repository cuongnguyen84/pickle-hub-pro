import { Link } from "react-router-dom";
import { Play, Clock, Eye, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { optimizeImageUrl } from "@/lib/image-utils";

interface ContentCardProps {
  id: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  views?: number;
  organizationName?: string;
  organizationSlug?: string;
  organizationLogo?: string;
  isVerifiedCreator?: boolean;
  type?: "short" | "long";
  publishedAt?: string;
  className?: string;
}

const formatDuration = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatViews = (views: number): string => {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
};

const ContentCard = ({
  id,
  title,
  thumbnail,
  duration,
  views,
  organizationName,
  organizationSlug,
  organizationLogo,
  isVerifiedCreator = true,
  type = "long",
  publishedAt,
  className,
}: ContentCardProps) => {
  const { t } = useI18n();

  return (
    <Link
      to={`/watch/${id}`}
      className={cn(
        "group block rounded-xl overflow-hidden card-interactive",
        className
      )}
    >
      {/* Thumbnail */}
      <div className={cn(
        "relative overflow-hidden rounded-xl bg-background-surface",
        type === "short" ? "aspect-[9/16]" : "aspect-video"
      )}>
        {thumbnail ? (
          <img
            src={optimizeImageUrl(thumbnail, { width: 640 })}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            decoding="async"
            sizes={type === "short" ? "(max-width: 640px) 50vw, 25vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-12 h-12 text-foreground-muted" />
          </div>
        )}
        
        {/* Duration badge */}
        {duration && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur-sm text-xs font-medium text-foreground">
            {formatDuration(duration)}
          </div>
        )}
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-background/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
            <Play className="w-5 h-5 text-primary-foreground ml-0.5" fill="currentColor" />
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
          
          {views !== undefined && (
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              <span>{formatViews(views)} {t.video.views}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ContentCard;

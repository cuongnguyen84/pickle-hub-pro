import { Link } from "react-router-dom";
import { Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

interface ReplayCardProps {
  id: string;
  title: string;
  thumbnail?: string;
  organizationName?: string;
  organizationLogo?: string;
  className?: string;
}

const ReplayCard = ({
  id,
  title,
  thumbnail,
  organizationName,
  organizationLogo,
  className,
}: ReplayCardProps) => {
  const { t } = useI18n();

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
        
        {/* Replay badge */}
        <div className="absolute top-3 left-3">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/90 backdrop-blur-sm">
            <RotateCcw className="w-3 h-3 text-primary-foreground" />
            <span className="text-xs font-semibold text-primary-foreground">{t.live.replay}</span>
          </div>
        </div>
        
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
        </div>
      </div>
    </Link>
  );
};

export default ReplayCard;

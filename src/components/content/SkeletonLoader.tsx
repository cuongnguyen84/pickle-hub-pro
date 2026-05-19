import { cn } from "@/lib/utils";

interface SkeletonLoaderProps {
  variant?: "card" | "live-card" | "text" | "avatar" | "button";
  className?: string;
}

const SkeletonLoader = ({ variant = "card", className }: SkeletonLoaderProps) => {
  switch (variant) {
    case "card":
      return (
        <div className={cn("animate-pulse", className)}>
          <div className="aspect-video bg-muted rounded-xl" />
          <div className="pt-3 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
      );
    
    case "live-card":
      return (
        <div className={cn("animate-pulse", className)}>
          <div className="aspect-video bg-muted rounded-xl" />
          <div className="pt-3 space-y-2">
            <div className="h-4 bg-muted rounded w-4/5" />
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-muted rounded-full" />
              <div className="h-3 bg-muted rounded w-24" />
            </div>
          </div>
        </div>
      );
    
    case "text":
      return (
        <div className={cn("h-4 bg-muted rounded animate-pulse", className)} />
      );
    
    case "avatar":
      return (
        <div className={cn("w-10 h-10 bg-muted rounded-full animate-pulse", className)} />
      );
    
    case "button":
      return (
        <div className={cn("h-10 w-24 bg-muted rounded-lg animate-pulse", className)} />
      );
    
    default:
      return <div className={cn("bg-muted rounded-lg animate-pulse", className)} />;
  }
};

export default SkeletonLoader;

import { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/content";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContentSectionProps {
  title: string;
  count?: number;
  icon?: LucideIcon;
  children: ReactNode;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  isLoading?: boolean;
  className?: string;
  horizontal?: boolean;
}

export const ContentSection = ({
  title,
  count,
  icon,
  children,
  isEmpty = false,
  emptyTitle,
  emptyDescription,
  isLoading = false,
  className,
  horizontal = false,
}: ContentSectionProps) => {
  return (
    <section className={cn("", className)}>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg md:text-xl font-semibold text-foreground">
          {title}
        </h2>
        {typeof count === "number" && (
          <span className="px-2 py-0.5 rounded-full bg-muted text-foreground-muted text-sm font-medium">
            {count}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className={cn(
          horizontal 
            ? "flex gap-4 overflow-x-auto scrollbar-hide pb-2" 
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        )}>
          {[1, 2, 3].map((i) => (
            <Skeleton 
              key={i} 
              className={cn(
                "rounded-xl",
                horizontal ? "w-72 h-48 flex-shrink-0" : "aspect-video"
              )} 
            />
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={icon}
          title={emptyTitle || ""}
          description={emptyDescription}
        />
      ) : (
        <div className={cn(
          horizontal 
            ? "flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 md:mx-0 md:px-0" 
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
        )}>
          {children}
        </div>
      )}
    </section>
  );
};

export const ContentSectionSkeleton = () => (
  <section>
    <Skeleton className="h-7 w-48 mb-4" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="aspect-video rounded-xl" />
      ))}
    </div>
  </section>
);

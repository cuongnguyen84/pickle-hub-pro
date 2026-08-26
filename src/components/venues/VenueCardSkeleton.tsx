import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder for VenueCard.
 *
 * /san rendered a single centred spinner while its grid loaded, then replaced
 * it with rows of cards — PageSpeed measured lab CLS 0.449 on the route, third
 * worst on the site. This mirrors VenueCard's own wrapper and inner structure
 * class for class, so the reserved box is produced by the same Tailwind rules
 * that lay out the real card instead of by heights copied here that would
 * drift the next time the card is restyled.
 *
 * Keep this file next to VenueCard.tsx: if the card's outer padding, gap, or
 * the 14x14 thumbnail changes, this must change with it.
 */
export function VenueCardSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 rounded-md border border-border bg-card p-5"
      aria-hidden="true"
    >
      <div className="flex items-start gap-3">
        <Skeleton className="h-14 w-14 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          {/* text-2xl / leading-tight — matches the card's venue name line */}
          <Skeleton className="h-7 w-3/4" />
          {/* text-sm line with mt-0.5 — matches the location row */}
          <Skeleton className="mt-1 h-4 w-1/2" />
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

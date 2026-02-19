import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatterBadgeProps {
  rank: number | null;
  className?: string;
}

export function ChatterBadge({ rank, className }: ChatterBadgeProps) {
  if (!rank || rank > 3) return null;

  if (rank === 1) {
    return (
      <Crown
        className={cn("h-3.5 w-3.5 shrink-0", className)}
        style={{ color: "#FFD700" }}
        fill="#FFD700"
        strokeWidth={1.5}
      />
    );
  }

  return (
    <span className={cn("text-sm leading-none shrink-0", className)}>
      {rank === 2 ? "🥈" : "🥉"}
    </span>
  );
}

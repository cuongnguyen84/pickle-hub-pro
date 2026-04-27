import { Eye } from "lucide-react";

interface ViewCountBadgeProps {
  count: number | undefined;
  className?: string;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function ViewCountBadge({ count, className }: ViewCountBadgeProps) {
  if (count === undefined || count === null) return null;

  return (
    <span className={`inline-flex items-center gap-1 text-muted-foreground ${className ?? ""}`}>
      <Eye className="w-3.5 h-3.5" />
      <span>{formatCount(count)}</span>
    </span>
  );
}

import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

interface SponsoredBadgeProps {
  className?: string;
}

/**
 * Small bilingual "Sponsored / Được tài trợ" label for marking paid placements
 * (sponsored articles, brand posts). FTC / ad-transparency friendly.
 */
export function SponsoredBadge({ className }: SponsoredBadgeProps) {
  const { language } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-900",
        className,
      )}
    >
      {language === "vi" ? "Được tài trợ" : "Sponsored"}
    </span>
  );
}

import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

interface AdSlotProps {
  variant?: "banner" | "sidebar" | "inline";
  className?: string;
}

const AdSlot = ({ variant = "banner", className }: AdSlotProps) => {
  const { t } = useI18n();

  const variantClasses = {
    banner: "h-24 md:h-20",
    sidebar: "h-64",
    inline: "h-32",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-background-surface border border-border-subtle",
        "flex items-center justify-center",
        variantClasses[variant],
        className
      )}
    >
      {/* Subtle pattern background */}
      <div className="absolute inset-0 opacity-5">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="ad-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="1" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ad-pattern)" />
        </svg>
      </div>
      
      <span className="text-xs text-foreground-muted font-medium tracking-wide uppercase">
        {t.ads.advertisement}
      </span>
    </div>
  );
};

export default AdSlot;

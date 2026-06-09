import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ADS, AD_SLOTS, SHOW_AD_PLACEHOLDERS, ensureAdsenseScript, type AdSlotKey } from "@/lib/monetization";
import { trackAdImpression } from "@/utils/monetization-events";

interface AdSlotProps {
  /** Named placement from AD_SLOTS. */
  slot: AdSlotKey;
  className?: string;
  /** Reserved height in px to prevent layout shift (CLS). */
  minHeight?: number;
  /** AdSense format hint. */
  format?: string;
}

/**
 * Responsive ad container.
 *
 * - Prerender/SSR safe: renders a plain element; bots see an empty box.
 * - Renders NOTHING in production until a publisher id + slot id are set,
 *   so it's safe to ship today. Set VITE_AD_PLACEHOLDERS=1 on a preview build
 *   to visualise placements as grey boxes.
 * - Fires a GA4 `ad_impression` event once the slot scrolls into view.
 */
export function AdSlot({ slot, className, minHeight = 250, format = "auto" }: AdSlotProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [seen, setSeen] = useState(false);
  const slotId = AD_SLOTS[slot];
  const active = ADS.enabled && Boolean(slotId);

  useEffect(() => {
    if (!active) return;
    ensureAdsenseScript();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* AdSense library not ready yet — safe to ignore. */
    }
  }, [active, slotId]);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setSeen(true);
            trackAdImpression({ slot, network: ADS.network });
            observer.disconnect();
          }
        });
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [slot, seen]);

  if (!active) {
    if (!SHOW_AD_PLACEHOLDERS) return null;
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground",
          className,
        )}
        style={{ minHeight }}
        aria-hidden="true"
      >
        Ad slot · {slot} (inactive)
      </div>
    );
  }

  return (
    <div ref={ref} className={cn("ad-slot", className)} style={{ minHeight }}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADS.adsenseClient}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}

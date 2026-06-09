/**
 * GA4 event helpers for monetization. Thin wrappers over trackEvent so every
 * affiliate click / ad impression is fired with a consistent event name+shape.
 */
import { trackEvent } from "@/utils/ga";

interface AffiliateClickParams {
  partner: string;
  url: string;
  /** Where the click happened, e.g. a blog slug or "media-kit". */
  placement?: string;
}

interface AdImpressionParams {
  slot: string;
  network: string;
}

export function trackAffiliateClick(params: AffiliateClickParams): void {
  trackEvent("affiliate_click", { ...params });
}

export function trackAdImpression(params: AdImpressionParams): void {
  trackEvent("ad_impression", { ...params });
}

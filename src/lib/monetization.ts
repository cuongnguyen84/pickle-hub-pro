/**
 * Central monetization config for ThePickleHub — Horizon 1 (Quick wins).
 *
 * Everything here is SAFE TO SHIP in a "scaffolding" state: nothing renders a
 * real ad or appends an affiliate tag until the matching VITE_ env var is set.
 * Fill the env vars below once the relevant account is approved.
 *
 *   Display ads:   VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
 *                  VITE_ADSENSE_SLOT_BLOG=1234567890   (etc.)
 *                  VITE_AD_PLACEHOLDERS=1              (show grey slot boxes on preview)
 *   Affiliate:     VITE_AFF_AMAZON_TAG=thepicklehub-20  (etc.)
 */

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const env = import.meta.env as Record<string, string | undefined>;

export type AdNetwork = "adsense" | "ezoic" | "none";

interface AdsConfig {
  network: AdNetwork;
  /** Google AdSense publisher id, e.g. "ca-pub-XXXXXXXXXXXXXXXX". Empty = disabled. */
  adsenseClient: string;
  enabled: boolean;
}

const adsenseClient: string = env.VITE_ADSENSE_CLIENT ?? "";

export const ADS: AdsConfig = {
  network: adsenseClient ? "adsense" : "none",
  adsenseClient,
  enabled: Boolean(adsenseClient),
};

/** Named ad placements. The slot ids come from AdSense once approved. */
export const AD_SLOTS = {
  blogInArticle: env.VITE_ADSENSE_SLOT_BLOG ?? "",
  blogSidebar: env.VITE_ADSENSE_SLOT_SIDEBAR ?? "",
  newsInArticle: env.VITE_ADSENSE_SLOT_NEWS ?? "",
} as const;

export type AdSlotKey = keyof typeof AD_SLOTS;

/** Show labelled grey placeholder boxes where ads will go (preview only). */
export const SHOW_AD_PLACEHOLDERS: boolean = !ADS.enabled && env.VITE_AD_PLACEHOLDERS === "1";

/** Injects the AdSense library once, only when a publisher id is configured. */
export function ensureAdsenseScript(): void {
  if (!ADS.enabled || typeof document === "undefined") return;
  if (document.getElementById("adsbygoogle-js")) return;
  const script = document.createElement("script");
  script.id = "adsbygoogle-js";
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS.adsenseClient}`;
  document.head.appendChild(script);
}

export interface AffiliatePartner {
  id: string;
  label: string;
  /** Base store URL (used to resolve relative product paths). */
  baseUrl: string;
  /** Query param that carries the affiliate tag (e.g. "tag" for Amazon). */
  tagParam?: string;
  /** Affiliate tag/id — read from env so real ids never live in source. */
  tag?: string;
  /** Headline commission rate, for the media kit / internal reference. */
  commissionNote?: string;
}

const partners: AffiliatePartner[] = [
  { id: "amazon", label: "Amazon", baseUrl: "https://www.amazon.com", tagParam: "tag", tag: env.VITE_AFF_AMAZON_TAG ?? "", commissionNote: "3–5%" },
  { id: "selkirk", label: "Selkirk", baseUrl: "https://www.selkirk.com", tag: env.VITE_AFF_SELKIRK_TAG ?? "", commissionNote: "15%" },
  { id: "justpaddles", label: "JustPaddles", baseUrl: "https://www.justpaddles.com", tag: env.VITE_AFF_JUSTPADDLES_TAG ?? "", commissionNote: "4–10%" },
  { id: "crbn", label: "CRBN", baseUrl: "https://www.crbnpickleball.com", tag: env.VITE_AFF_CRBN_TAG ?? "", commissionNote: "15%" },
];

export const AFFILIATE_PARTNERS: ReadonlyArray<AffiliatePartner> = partners;

export function getPartner(id: string): AffiliatePartner | undefined {
  return partners.find((partner) => partner.id === id);
}

/** True once at least one partner tag is configured. */
export const AFFILIATE_ENABLED: boolean = partners.some((partner) => Boolean(partner.tag));

/**
 * Build an affiliate URL. If the partner has no tag configured yet, the raw
 * URL is returned unchanged — the link still works, it just earns nothing.
 */
export function buildAffiliateUrl(partnerId: string, url: string): string {
  const partner = getPartner(partnerId);
  if (!partner || !partner.tag || !partner.tagParam) return url;
  try {
    const parsed = new URL(url, partner.baseUrl);
    parsed.searchParams.set(partner.tagParam, partner.tag);
    return parsed.toString();
  } catch {
    return url;
  }
}

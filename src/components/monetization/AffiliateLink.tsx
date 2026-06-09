import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { buildAffiliateUrl } from "@/lib/monetization";
import { trackAffiliateClick } from "@/utils/monetization-events";

interface AffiliateLinkProps {
  /** Partner id from AFFILIATE_PARTNERS (e.g. "amazon", "selkirk"). */
  partner: string;
  /** Destination product URL (absolute, or relative to the partner store). */
  href: string;
  children: ReactNode;
  className?: string;
  /** Optional analytics label, e.g. the blog slug the link sits in. */
  placement?: string;
}

/**
 * Outbound affiliate link. Always rel="sponsored nofollow" (SEO-safe), opens in
 * a new tab, fires a GA4 `affiliate_click` event, and appends the partner tag
 * when one is configured (see src/lib/monetization.ts).
 */
export function AffiliateLink({ partner, href, children, className, placement }: AffiliateLinkProps) {
  const finalUrl = buildAffiliateUrl(partner, href);
  return (
    <a
      href={finalUrl}
      target="_blank"
      rel="sponsored nofollow noopener noreferrer"
      className={cn("text-primary underline underline-offset-2 hover:opacity-80", className)}
      onClick={() => trackAffiliateClick({ partner, url: finalUrl, placement })}
    >
      {children}
    </a>
  );
}

/** Manual GA calls never include credential URLs, query/hash or raw referrers. */
import { analyticsLocation, analyticsProps, isPrivateAnalyticsUrl } from "./analyticsPrivacy";
declare global {
  interface Window {
    gtag: (command: string, ...args: unknown[]) => void;
    dataLayer: unknown[];
    __tphAnalyticsAllowed?: () => boolean;
  }
}
export const trackPageView = (path?: string): void => {
  if (typeof window.gtag !== "function" || isPrivateAnalyticsUrl(window.location.href) || path && isPrivateAnalyticsUrl(path)) return;
  const location = analyticsLocation(window.location.href);
  if (!location) return;
  window.gtag("event", "page_view", location);
};
export const trackEvent = (eventName: string, params?: Record<string, unknown>): void => {
  if (typeof window.gtag !== "function" || isPrivateAnalyticsUrl(window.location.href) || !/^[a-z][a-z0-9_]{0,63}$/i.test(eventName)) return;
  const location = analyticsLocation(window.location.href);
  if (!location) return;
  window.gtag("event", eventName, { ...analyticsProps(params), ...location, transport_type: "beacon" });
};

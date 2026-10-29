// Safari Smart App Banner (`<meta name="apple-itunes-app">`). app-argument is
// the page's canonical URL so "Open" in the banner lands the native app on the
// same entity (DeepLink.parse in /apple) instead of the homepage. Shared by the
// SPA (DynamicMeta) and the Pages middleware (human HTML responses).
export const APP_STORE_ID = "6759968026";

export function smartAppBannerContent(canonicalUrl: string): string {
  return `app-id=${APP_STORE_ID}, app-argument=${canonicalUrl}`;
}

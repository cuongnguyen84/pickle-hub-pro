/**
 * Google Analytics 4 Utility Functions
 * Measurement ID: G-JQG63B6NX0
 */

declare global {
  interface Window {
    gtag: (command: string, ...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

/**
 * Track page view - call on route change
 * @param path - The page path to track (defaults to current pathname)
 */
export const trackPageView = (path?: string): void => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: path || window.location.pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }
};

/**
 * Track custom events
 * @param eventName - Name of the event
 * @param params - Event parameters
 */
export const trackEvent = (eventName: string, params?: Record<string, unknown>): void => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
};

/**
 * Predefined events for future use:
 * - view_livestream
 * - watch_replay
 * - create_tournament
 * - view_tools
 * - login
 * - signup
 */

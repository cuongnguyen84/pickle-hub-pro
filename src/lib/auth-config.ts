/**
 * ========================================
 * AUTH CONFIGURATION FOR CUSTOM DOMAIN
 * ========================================
 * 
 * This file centralizes auth-related URLs and configurations
 * to support Google OAuth with custom domain (thepicklehub.net)
 * 
 * SETUP CHECKLIST FOR CUSTOM AUTH DOMAIN:
 * ========================================
 * 
 * 1. DNS Configuration:
 *    - Add CNAME record: auth.thepicklehub.net -> nijiwypubmkvmjuafmgp.supabase.co
 * 
 * 2. Supabase Dashboard (via Lovable Cloud):
 *    - Enable Custom Domain for auth.thepicklehub.net
 *    - Set Site URL: https://thepicklehub.net
 *    - Add Redirect URLs:
 *      - https://thepicklehub.net
 *      - https://thepicklehub.net/login
 *      - https://thepicklehub.net/auth/callback
 *      - https://auth.thepicklehub.net/auth/v1/callback
 * 
 * 3. Google Cloud Console (OAuth Consent Screen):
 *    - Authorized JavaScript origins:
 *      - https://thepicklehub.net
 *      - https://auth.thepicklehub.net
 *    - Authorized redirect URIs:
 *      - https://auth.thepicklehub.net/auth/v1/callback
 *      (After custom domain is verified, Google will show auth.thepicklehub.net instead of supabase.co)
 * 
 * 4. Environment Variables (optional, for future use):
 *    - VITE_SITE_URL=https://thepicklehub.net
 *    - VITE_AUTH_DOMAIN=https://auth.thepicklehub.net
 * 
 * IMPORTANT NOTES:
 * - DB/API calls still use VITE_SUPABASE_URL (nijiwypubmkvmjuafmgp.supabase.co)
 * - Only OAuth flows will go through auth.thepicklehub.net after custom domain is set up
 * - The consent screen will show your custom domain once Supabase custom domain is verified
 */

/**
 * Get the site URL for auth redirects
 * Uses window.location.origin to ensure it works in all environments
 */
export const getSiteUrl = (): string => {
  // In browser, use current origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // Fallback for SSR/build time
  return import.meta.env.VITE_SITE_URL || 'https://thepicklehub.net';
};

/**
 * Get OAuth redirect URL
 * @param path - Optional path to redirect to after auth (default: '/')
 */
export const getOAuthRedirectUrl = (path: string = '/'): string => {
  const siteUrl = getSiteUrl();
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl}${normalizedPath}`;
};

/**
 * Get email verification redirect URL
 */
export const getEmailRedirectUrl = (): string => {
  return `${getSiteUrl()}/`;
};

/**
 * Auth callback route for OAuth providers
 */
export const AUTH_CALLBACK_ROUTE = '/auth/callback';

/**
 * Get login URL with optional redirect back to current page
 * @param currentPath - Current path to redirect back to after login
 */
export const getLoginUrl = (currentPath?: string): string => {
  if (!currentPath) {
    if (typeof window !== 'undefined') {
      currentPath = window.location.pathname + window.location.search;
    } else {
      return '/login';
    }
  }
  return `/login?redirect=${encodeURIComponent(currentPath)}`;
};

/**
 * Production URLs (for reference)
 */
export const PRODUCTION_URLS = {
  site: 'https://thepicklehub.net',
  authDomain: 'https://auth.thepicklehub.net', // Custom auth domain (after setup)
  privacyPolicy: 'https://thepicklehub.net/privacy',
  termsOfService: 'https://thepicklehub.net/terms', // TODO: Create terms page
} as const;

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
 *    - Add CNAME record: auth.thepicklehub.net -> ajvlcamxemgbxduhiqrl.supabase.co
 * 
 * 2. Supabase Dashboard (via Lovable Cloud):
 *    - Enable Custom Domain for auth.thepicklehub.net
 *    - Set Site URL: https://www.thepicklehub.net
 *    - Add Redirect URLs:
 *      - https://www.thepicklehub.net
 *      - https://www.thepicklehub.net/login
 *      - https://www.thepicklehub.net/auth/callback
 *      - https://auth.thepicklehub.net/auth/v1/callback
 * 
 * 3. Google Cloud Console (OAuth Consent Screen):
 *    - Authorized JavaScript origins:
 *      - https://www.thepicklehub.net
 *      - https://auth.thepicklehub.net
 *    - Authorized redirect URIs:
 *      - https://auth.thepicklehub.net/auth/v1/callback
 *      (After custom domain is verified, Google will show auth.thepicklehub.net instead of supabase.co)
 * 
 * 4. Environment Variables (optional, for future use):
 *    - VITE_SITE_URL=https://www.thepicklehub.net
 *    - VITE_AUTH_DOMAIN=https://auth.thepicklehub.net
 * 
 * IMPORTANT NOTES:
 * - DB/API calls still use VITE_SUPABASE_URL (ajvlcamxemgbxduhiqrl.supabase.co)
 * - Only OAuth flows will go through auth.thepicklehub.net after custom domain is set up
 * - The consent screen will show your custom domain once Supabase custom domain is verified
 */

const CANONICAL_SITE_URL = 'https://www.thepicklehub.net';

/**
 * Get the site URL for auth redirects.
 * Canonicalize non-www to www so OAuth allow-lists stay consistent.
 */
export const getSiteUrl = (): string => {
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'thepicklehub.net') {
      return CANONICAL_SITE_URL; // normalize non-www → www
    }

    return window.location.origin;
  }

  return import.meta.env.VITE_SITE_URL || CANONICAL_SITE_URL;
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
 * Redirect URL for password reset emails.
 * User clicks → lands on /auth/reset-password to set new password.
 */
export const getPasswordResetRedirectUrl = (): string => {
  return `${getSiteUrl()}/auth/reset-password`;
};

/**
 * Redirect URL for email verification (signup confirm).
 * User clicks → lands on /auth/callback to complete signup.
 */
export const getEmailVerificationRedirectUrl = (): string => {
  return `${getSiteUrl()}/auth/callback`;
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
  site: 'https://www.thepicklehub.net',
  authDomain: 'https://auth.thepicklehub.net', // Custom auth domain (after setup)
  privacyPolicy: 'https://www.thepicklehub.net/privacy',
  termsOfService: 'https://www.thepicklehub.net/terms', // TODO: Create terms page
} as const;

/**
 * Capacitor Platform Detection Utilities
 *
 * Provides utilities for detecting if the app is running in a native context
 * (iOS/Android via Capacitor) vs web browser.
 */

import type { CapacitorGlobal } from '@capacitor/core';

// Type-only view of window.Capacitor — we intentionally read the injected
// global instead of importing the runtime, so web bundles skip the module.
const getCapacitor = (): CapacitorGlobal | undefined =>
  typeof window !== 'undefined'
    ? (window as { Capacitor?: CapacitorGlobal }).Capacitor
    : undefined;

/**
 * Check if running in a Capacitor native app (iOS or Android)
 */
export const isNativeApp = (): boolean => {
  // Check if Capacitor is available and we're on a native platform
  const cap = getCapacitor();
  if (cap) {
    const platform = cap.getPlatform();
    return platform === 'ios' || platform === 'android';
  }
  return false;
};

/**
 * Check if running on iOS
 */
export const isIOS = (): boolean => {
  const cap = getCapacitor();
  if (cap) {
    return cap.getPlatform() === 'ios';
  }
  // Fallback: check user agent
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
};

/**
 * Check if running on Android
 */
export const isAndroid = (): boolean => {
  const cap = getCapacitor();
  if (cap) {
    return cap.getPlatform() === 'android';
  }
  return false;
};

/**
 * Get the current platform
 */
export const getPlatform = (): 'ios' | 'android' | 'web' => {
  const cap = getCapacitor();
  if (cap) {
    const platform = cap.getPlatform();
    if (platform === 'ios') return 'ios';
    if (platform === 'android') return 'android';
  }
  return 'web';
};

/**
 * Production domain for OAuth redirect
 * Native apps use Universal Links / App Links to intercept this URL
 */
export const NATIVE_OAUTH_REDIRECT_URL = 'https://www.thepicklehub.net/auth/callback';

/**
 * Get the OAuth redirect URL based on platform
 *
 * APPROACH: Universal Links / App Links
 * - All platforms redirect to https://www.thepicklehub.net/auth/callback
 * - Native apps configure Associated Domains (iOS) / App Links (Android) to intercept this URL
 * - This avoids the need for custom URL schemes (https:// URLs required for OAuth)
 */
export const getOAuthRedirectForPlatform = (webRedirectUrl: string): string => {
  if (isNativeApp()) {
    // For native apps, use the production domain
    // The native app must be configured with Universal Links (iOS) or App Links (Android)
    // to intercept this URL and handle the OAuth callback
    return NATIVE_OAUTH_REDIRECT_URL;
  }
  return webRedirectUrl;
};

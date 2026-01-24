/**
 * Capacitor Platform Detection Utilities
 * 
 * Provides utilities for detecting if the app is running in a native context
 * (iOS/Android via Capacitor) vs web browser.
 */

/**
 * Check if running in a Capacitor native app (iOS or Android)
 */
export const isNativeApp = (): boolean => {
  // Check if Capacitor is available and we're on a native platform
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    const platform = (window as any).Capacitor.getPlatform();
    return platform === 'ios' || platform === 'android';
  }
  return false;
};

/**
 * Check if running on iOS
 */
export const isIOS = (): boolean => {
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    return (window as any).Capacitor.getPlatform() === 'ios';
  }
  // Fallback: check user agent
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
};

/**
 * Check if running on Android
 */
export const isAndroid = (): boolean => {
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    return (window as any).Capacitor.getPlatform() === 'android';
  }
  return false;
};

/**
 * Get the current platform
 */
export const getPlatform = (): 'ios' | 'android' | 'web' => {
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    const platform = (window as any).Capacitor.getPlatform();
    if (platform === 'ios') return 'ios';
    if (platform === 'android') return 'android';
  }
  return 'web';
};

/**
 * Custom URL scheme for the app (used for OAuth deep linking)
 * This must match the scheme configured in native projects:
 * - iOS: URL Types in Info.plist
 * - Android: intent-filter in AndroidManifest.xml
 */
export const APP_URL_SCHEME = 'thepicklehub';

/**
 * Get the OAuth redirect URL based on platform
 * - Native apps: Use custom URL scheme for deep linking back to app
 * - Web: Use regular web URL
 */
export const getOAuthRedirectForPlatform = (webRedirectUrl: string): string => {
  if (isNativeApp()) {
    // For native apps, use custom scheme to ensure the OAuth callback
    // opens the app instead of the web browser
    return `${APP_URL_SCHEME}://auth/callback`;
  }
  return webRedirectUrl;
};

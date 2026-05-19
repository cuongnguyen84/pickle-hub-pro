/**
 * Deep Link Handler for OAuth Callback
 * 
 * This hook listens for app URL open events (deep links) on native platforms
 * and handles OAuth callbacks by:
 * 1. Closing the browser
 * 2. Parsing the auth tokens from the URL
 * 3. Setting the session in Supabase
 * 
 * Also includes a polling fallback for when App Links don't work properly.
 */
import { useEffect, useRef, useCallback } from 'react';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/integrations/supabase/client';
import { isNativeApp } from '@/lib/capacitor-utils';

// Track if OAuth flow is in progress
let oauthInProgress = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;

export const setOAuthInProgress = (value: boolean) => {
  oauthInProgress = value;
  console.log('[DeepLink] OAuth in progress:', value);
};

export const useDeepLinkHandler = () => {
  const hasSessionRef = useRef(false);

  // Function to close browser and stop polling
  const cleanupOAuth = useCallback(async () => {
    console.log('[DeepLink] Cleaning up OAuth flow');
    oauthInProgress = false;
    
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    
    try {
      await Browser.close();
      console.log('[DeepLink] Browser closed');
    } catch (e) {
      console.log('[DeepLink] Browser close skipped:', e);
    }
  }, []);

  useEffect(() => {
    // Only set up on native platforms
    if (!isNativeApp()) {
      return;
    }

    // Listen for auth state changes - this is the fallback mechanism
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[DeepLink] Auth state changed:', event, 'hasSession:', !!session);
      
      if (oauthInProgress && session && !hasSessionRef.current) {
        hasSessionRef.current = true;
        console.log('[DeepLink] Session detected during OAuth flow, closing browser');
        await cleanupOAuth();
      }
    });

    // Start polling when app resumes from background (browser OAuth completed)
    const startPolling = () => {
      if (pollInterval) return;
      
      console.log('[DeepLink] Starting session polling');
      pollInterval = setInterval(async () => {
        if (!oauthInProgress) {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          return;
        }

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && !hasSessionRef.current) {
            hasSessionRef.current = true;
            console.log('[DeepLink] Session found via polling');
            await cleanupOAuth();
          }
        } catch (e) {
          console.error('[DeepLink] Polling error:', e);
        }
      }, 1000);
    };

    // Listen for app resume (when user comes back from browser)
    const resumeListener = App.addListener('appStateChange', ({ isActive }) => {
      console.log('[DeepLink] App state changed, isActive:', isActive);
      if (isActive && oauthInProgress) {
        startPolling();
      }
    });

    // Listen for deep link URL opens
    const handleAppUrlOpen = async (event: URLOpenListenerEvent) => {
      const url = event.url;
      console.log('[DeepLink] App opened with URL:', url);

      // Check if this is an OAuth callback
      if (url.includes('/auth/callback')) {
        await cleanupOAuth();

        try {
          // Parse the URL to extract tokens
          const urlObj = new URL(url);
          
          let accessToken: string | null = null;
          let refreshToken: string | null = null;

          // Check for encoded hash param (from native OAuth redirect)
          const encodedHash = urlObj.searchParams.get('hash');
          if (encodedHash) {
            const decodedHash = decodeURIComponent(encodedHash);
            const hashParams = new URLSearchParams(decodedHash.substring(1));
            accessToken = hashParams.get('access_token');
            refreshToken = hashParams.get('refresh_token');
          }

          // Try hash directly (fragment)
          if (!accessToken && urlObj.hash) {
            const hashParams = new URLSearchParams(urlObj.hash.substring(1));
            accessToken = hashParams.get('access_token');
            refreshToken = hashParams.get('refresh_token');
          }

          // If not in hash, check query params
          if (!accessToken) {
            accessToken = urlObj.searchParams.get('access_token');
            refreshToken = urlObj.searchParams.get('refresh_token');
          }

          // Also check for authorization code (PKCE flow)
          const code = urlObj.searchParams.get('code');

          if (accessToken && refreshToken) {
            console.log('[DeepLink] Setting session with tokens');
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('[DeepLink] Error setting session:', error);
            } else {
              console.log('[DeepLink] Session set successfully');
              hasSessionRef.current = true;
            }
          } else if (code) {
            // For PKCE flow, exchange the code for a session
            console.log('[DeepLink] Exchanging code for session');
            const { error } = await supabase.auth.exchangeCodeForSession(code);

            if (error) {
              console.error('[DeepLink] Error exchanging code:', error);
            } else {
              console.log('[DeepLink] Code exchanged successfully');
              hasSessionRef.current = true;
            }
          } else {
            console.log('[DeepLink] No tokens or code found in URL');
            const error = urlObj.searchParams.get('error');
            const errorDescription = urlObj.searchParams.get('error_description');
            if (error) {
              console.error('[DeepLink] OAuth error:', error, errorDescription);
            }
          }
        } catch (e) {
          console.error('[DeepLink] Error processing OAuth callback:', e);
        }
      }
    };

    // Add the URL listener
    const urlListener = App.addListener('appUrlOpen', handleAppUrlOpen);
    console.log('[DeepLink] Listeners registered');

    // Cleanup on unmount
    return () => {
      subscription.unsubscribe();
      urlListener.then(listener => listener.remove());
      resumeListener.then(listener => listener.remove());
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      console.log('[DeepLink] Listeners removed');
    };
  }, [cleanupOAuth]);
};

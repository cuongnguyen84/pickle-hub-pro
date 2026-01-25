/**
 * Deep Link Handler for OAuth Callback
 * 
 * This hook listens for app URL open events (deep links) on native platforms
 * and handles OAuth callbacks by:
 * 1. Closing the browser
 * 2. Parsing the auth tokens from the URL
 * 3. Setting the session in Supabase
 */
import { useEffect } from 'react';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/integrations/supabase/client';
import { isNativeApp } from '@/lib/capacitor-utils';

export const useDeepLinkHandler = () => {
  useEffect(() => {
    // Only set up listener on native platforms
    if (!isNativeApp()) {
      return;
    }

    const handleAppUrlOpen = async (event: URLOpenListenerEvent) => {
      const url = event.url;
      console.log('[DeepLink] App opened with URL:', url);

      // Check if this is an OAuth callback
      if (url.includes('/auth/callback')) {
        try {
          // Close the browser that was used for OAuth
          await Browser.close();
          console.log('[DeepLink] Browser closed');
        } catch (e) {
          // Browser might already be closed
          console.log('[DeepLink] Browser close skipped:', e);
        }

        try {
          // Parse the URL to extract tokens
          const urlObj = new URL(url);
          
          // Check for tokens in hash (implicit flow) or query params (PKCE flow)
          let accessToken: string | null = null;
          let refreshToken: string | null = null;

          // Try hash first (fragment)
          if (urlObj.hash) {
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
            }
          } else if (code) {
            // For PKCE flow, exchange the code for a session
            console.log('[DeepLink] Exchanging code for session');
            const { error } = await supabase.auth.exchangeCodeForSession(code);

            if (error) {
              console.error('[DeepLink] Error exchanging code:', error);
            } else {
              console.log('[DeepLink] Code exchanged successfully');
            }
          } else {
            console.log('[DeepLink] No tokens or code found in URL');
            // Check for error in URL
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

    // Add the listener
    const listenerPromise = App.addListener('appUrlOpen', handleAppUrlOpen);
    console.log('[DeepLink] Listener registered');

    // Cleanup on unmount
    return () => {
      listenerPromise.then(listener => {
        listener.remove();
        console.log('[DeepLink] Listener removed');
      });
    };
  }, []);
};

/**
 * Native Google Sign-In Hook
 * 
 * Uses @capgo/capacitor-social-login for native Google Sign-In
 * Compatible with Capacitor 8
 */

import { SocialLogin } from '@capgo/capacitor-social-login';
import { supabase } from '@/integrations/supabase/client';
import { isNativeApp } from '@/lib/capacitor-utils';

// Web Client ID for Google OAuth
const WEB_CLIENT_ID = '799212701204-pnak3bsb956b9n8mfttct7r3uhmuphqp.apps.googleusercontent.com';

/**
 * Initialize Google Auth plugin (call once on app startup)
 * Only initializes on native platforms (iOS/Android)
 */
export const initializeGoogleAuth = async () => {
  if (isNativeApp()) {
    try {
      await SocialLogin.initialize({
        google: {
          webClientId: WEB_CLIENT_ID,
        },
      });
      console.log('[GoogleAuth] Initialized successfully');
    } catch (error) {
      console.error('[GoogleAuth] Initialization failed:', error);
    }
  }
};

/**
 * Sign in with Google using native SDK
 * Returns Supabase session data
 */
export const nativeGoogleSignIn = async () => {
  console.log('[GoogleAuth] Starting native sign-in...');
  
  // 1. Call native Google SDK to get user info + idToken
  const result = await SocialLogin.login({
    provider: 'google',
    options: {
      scopes: ['profile', 'email'],
    },
  });

  if (!result.result) {
    throw new Error('Google Sign-In failed: No result returned');
  }

  // Access idToken from the authentication object
  const googleResult = result.result as { idToken?: string; authentication?: { idToken?: string } };
  const idToken = googleResult.idToken || googleResult.authentication?.idToken;
  
  if (!idToken) {
    throw new Error('Google Sign-In failed: No idToken returned');
  }
  
  // 2. Use idToken to create Supabase session
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });

  if (error) {
    console.error('[GoogleAuth] Supabase signInWithIdToken failed:', error);
    throw error;
  }
  
  console.log('[GoogleAuth] Supabase session created successfully');
  return data;
};

/**
 * Sign out from Google (native platforms only)
 */
export const nativeGoogleSignOut = async () => {
  if (isNativeApp()) {
    try {
      await SocialLogin.logout({ provider: 'google' });
      console.log('[GoogleAuth] Signed out from Google');
    } catch (error) {
      console.error('[GoogleAuth] Sign out error:', error);
    }
  }
};

/**
 * Check if user is logged in with Google
 */
export const isGoogleLoggedIn = async () => {
  if (isNativeApp()) {
    try {
      const result = await SocialLogin.isLoggedIn({ provider: 'google' });
      return result.isLoggedIn;
    } catch (error) {
      console.error('[GoogleAuth] Check login status error:', error);
      return false;
    }
  }
  return false;
};

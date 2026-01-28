/**
 * Native Google Sign-In Hook
 * 
 * Uses @codetrix-studio/capacitor-google-auth plugin for native platforms
 * to avoid web-based OAuth issues (disallowed_useragent, App Links complexity)
 */

import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { supabase } from '@/integrations/supabase/client';
import { isNativeApp } from '@/lib/capacitor-utils';

/**
 * Initialize Google Auth plugin (call once on app startup)
 * Only initializes on native platforms (iOS/Android)
 */
export const initializeGoogleAuth = () => {
  if (isNativeApp()) {
    try {
      GoogleAuth.initialize({
        scopes: ['profile', 'email'],
        grantOfflineAccess: true,
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
  const googleUser = await GoogleAuth.signIn();
  console.log('[GoogleAuth] Got Google user:', googleUser.email);
  
  // 2. Use idToken to create Supabase session
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: googleUser.authentication.idToken,
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
      await GoogleAuth.signOut();
      console.log('[GoogleAuth] Signed out from Google');
    } catch (error) {
      console.error('[GoogleAuth] Sign out error:', error);
    }
  }
};

/**
 * Refresh Google authentication (if needed)
 */
export const refreshGoogleAuth = async () => {
  if (isNativeApp()) {
    try {
      const result = await GoogleAuth.refresh();
      console.log('[GoogleAuth] Token refreshed');
      return result;
    } catch (error) {
      console.error('[GoogleAuth] Refresh failed:', error);
      throw error;
    }
  }
  return null;
};

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'net.thepicklehub.app',
  appName: 'ThePickleHub',
  webDir: 'dist',
  
  // Production: Load directly from thepicklehub.net (WebView wrapper mode)
  server: {
    url: 'https://thepicklehub.net',
    cleartext: true,
    // Allow navigation to external URLs (including OAuth providers)
    allowNavigation: [
      'thepicklehub.net', 
      '*.thepicklehub.net', 
      '*.supabase.co', 
      '*.mux.com',
      'accounts.google.com',
      '*.google.com'
    ]
  },

  // iOS-specific configuration
  ios: {
    // Allow inline video playback (critical for livestreams)
    allowsLinkPreview: false,
    scrollEnabled: true,
    // Content inset adjustment for safe areas
    contentInset: 'automatic',
    // Background modes
    backgroundColor: '#000000',
    // Prefer using WKWebView with inline media playback
    preferredContentMode: 'mobile'
  },

  // Android-specific configuration  
  android: {
    // Allow mixed content (HTTPS + potential HTTP resources)
    allowMixedContent: true,
    // Background color while loading
    backgroundColor: '#000000',
    // Capture all navigation
    captureInput: true,
    // WebView settings for video
    webContentsDebuggingEnabled: false,
    // Use hardware acceleration
    useLegacyBridge: false
  },

  // Plugins configuration
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000'
    }
  }
};

export default config;

/**
 * =====================================================
 * IMPORTANT: NATIVE PROJECT CONFIGURATION REQUIRED
 * =====================================================
 * 
 * After updating this config, you MUST configure the native projects
 * for OAuth deep linking to work correctly:
 * 
 * === iOS (ios/App/App/Info.plist) ===
 * Add URL scheme for OAuth callback:
 * 
 * <key>CFBundleURLTypes</key>
 * <array>
 *   <dict>
 *     <key>CFBundleURLSchemes</key>
 *     <array>
 *       <string>thepicklehub</string>
 *     </array>
 *     <key>CFBundleURLName</key>
 *     <string>net.thepicklehub.app</string>
 *   </dict>
 * </array>
 * 
 * === Android (android/app/src/main/AndroidManifest.xml) ===
 * Add intent-filter inside <activity> for OAuth callback:
 * 
 * <intent-filter>
 *   <action android:name="android.intent.action.VIEW" />
 *   <category android:name="android.intent.category.DEFAULT" />
 *   <category android:name="android.intent.category.BROWSABLE" />
 *   <data android:scheme="thepicklehub" android:host="auth" android:pathPrefix="/callback" />
 * </intent-filter>
 * 
 * === Supabase Dashboard ===
 * Add redirect URL: thepicklehub://auth/callback
 * 
 * === Google Cloud Console ===
 * Add authorized redirect URI: thepicklehub://auth/callback
 * (May require custom scheme support, check Google OAuth docs)
 * 
 * =====================================================
 */

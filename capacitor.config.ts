import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'net.thepicklehub.app',
  appName: 'ThePickleHub',
  webDir: 'dist',
  
  // Production: Load directly from thepicklehub.net (WebView wrapper mode)
  server: {
    url: 'https://thepicklehub.net',
    cleartext: true,
    // Allow navigation to external URLs
    allowNavigation: ['thepicklehub.net', '*.thepicklehub.net', '*.supabase.co', '*.mux.com']
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

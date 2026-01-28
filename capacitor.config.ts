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
    },
    // Native Google Sign-In configuration
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '799212701204-pnak3bsb956b9n8mfttct7r3uhmuphqp.apps.googleusercontent.com',
      androidClientId: '799212701204-9aac8nqnkth7ch36822a3cjh89ddsmgs.apps.googleusercontent.com',
      iosClientId: '799212701204-256cmrlb95s2m5nv6u3dsq3v646r44fj.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    }
  }
};

export default config;

/**
 * =====================================================
 * IMPORTANT: UNIVERSAL LINKS / APP LINKS CONFIGURATION
 * =====================================================
 * 
 * This app uses Universal Links (iOS) and App Links (Android) for OAuth
 * instead of custom URL schemes, because Lovable Cloud only supports https:// URLs.
 * 
 * OAuth flow: Google → https://thepicklehub.net/auth/callback → Native App
 * 
 * === iOS: Universal Links Setup ===
 * 
 * 1. Create file: ios/App/App/.well-known/apple-app-site-association (on web server)
 *    Or host at: https://thepicklehub.net/.well-known/apple-app-site-association
 *    Content:
 *    {
 *      "applinks": {
 *        "apps": [],
 *        "details": [{
 *          "appID": "TEAM_ID.net.thepicklehub.app",
 *          "paths": ["/auth/callback"]
 *        }]
 *      }
 *    }
 * 
 * 2. Add Associated Domains in Xcode:
 *    - Open ios/App/App.xcworkspace in Xcode
 *    - Go to Signing & Capabilities → + Capability → Associated Domains
 *    - Add: applinks:thepicklehub.net
 * 
 * 3. In ios/App/App/Info.plist, ensure CFBundleURLTypes exists (for fallback):
 *    <key>CFBundleURLTypes</key>
 *    <array>
 *      <dict>
 *        <key>CFBundleURLSchemes</key>
 *        <array><string>thepicklehub</string></array>
 *      </dict>
 *    </array>
 * 
 * === Android: App Links Setup ===
 * 
 * 1. Add intent-filter in android/app/src/main/AndroidManifest.xml inside <activity>:
 *    <intent-filter android:autoVerify="true">
 *      <action android:name="android.intent.action.VIEW" />
 *      <category android:name="android.intent.category.DEFAULT" />
 *      <category android:name="android.intent.category.BROWSABLE" />
 *      <data android:scheme="https" android:host="thepicklehub.net" android:pathPrefix="/auth/callback" />
 *    </intent-filter>
 * 
 * 2. Host assetlinks.json at: https://thepicklehub.net/.well-known/assetlinks.json
 *    Content:
 *    [{
 *      "relation": ["delegate_permission/common.handle_all_urls"],
 *      "target": {
 *        "namespace": "android_app",
 *        "package_name": "net.thepicklehub.app",
 *        "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
 *      }
 *    }]
 * 
 * === After Configuration ===
 * Run: npx cap sync && rebuild native apps
 * 
 * =====================================================
 */

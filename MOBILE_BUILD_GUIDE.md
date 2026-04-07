# ThePickleHub Mobile App Build Guide

> Native mobile app wrapper sử dụng Capacitor, load trực tiếp từ https://www.thepicklehub.net

## 📋 Thông tin App

| Field | Value |
|-------|-------|
| App Name | ThePickleHub |
| Bundle ID | `net.thepicklehub.app` |
| Production URL | https://www.thepicklehub.net |

---

## 🚀 Bước 1: Setup Local Environment

### Prerequisites

- **Node.js** 18+ 
- **Git**
- **iOS**: macOS + Xcode 15+
- **Android**: Android Studio + JDK 17

### Clone & Install

```bash
# Clone repo từ GitHub
git clone <your-repo-url>
cd pickle-hub-pro

# Install dependencies
npm install
```

---

## 📱 Bước 2: Build iOS App

### 2.1 Add iOS Platform

```bash
# Add iOS project
npx cap add ios

# Sync web assets
npx cap sync ios
```

### 2.2 Configure Info.plist

Mở file `ios/App/App/Info.plist` trong Xcode và thêm các key sau:

```xml
<!-- Allow network loads for video streaming -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
    <key>NSAllowsArbitraryLoadsForMedia</key>
    <true/>
    <key>NSAllowsArbitraryLoadsInWebContent</key>
    <true/>
</dict>

<!-- Allow inline video playback -->
<key>UIWebViewAllowsInlineMediaPlayback</key>
<true/>

<!-- Background audio for livestreams -->
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>
```

### 2.3 Configure WebView for Video

Mở `ios/App/App/AppDelegate.swift` và thêm vào `application(_:didFinishLaunchingWithOptions:)`:

```swift
// Enable inline media playback
let webViewConfiguration = WKWebViewConfiguration()
webViewConfiguration.allowsInlineMediaPlayback = true
webViewConfiguration.mediaTypesRequiringUserActionForPlayback = []
```

### 2.4 Open in Xcode & Build

```bash
# Open Xcode
npx cap open ios
```

Trong Xcode:
1. Select target device hoặc simulator
2. **Product → Build** (Cmd+B)
3. **Product → Run** (Cmd+R)

### 2.5 Archive for App Store

1. Select **Any iOS Device (arm64)** 
2. **Product → Archive**
3. **Distribute App → App Store Connect**

---

## 🤖 Bước 3: Build Android App

### 3.1 Add Android Platform

```bash
# Add Android project  
npx cap add android

# Sync web assets
npx cap sync android
```

### 3.2 Configure Network Security

Tạo file `android/app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system"/>
        </trust-anchors>
    </base-config>
</network-security-config>
```

Thêm vào `android/app/src/main/AndroidManifest.xml`:

```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    android:hardwareAccelerated="true"
    ...>
```

### 3.3 Configure WebView for Video

Mở `android/app/src/main/java/.../MainActivity.java` và override:

```java
@Override
public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    
    // Enable hardware acceleration for video
    getWindow().setFlags(
        WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
        WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
    );
}
```

### 3.4 Open in Android Studio & Build

```bash
# Open Android Studio
npx cap open android
```

### 3.5 Build Release AAB for Play Store

1. **Build → Generate Signed Bundle / APK**
2. Chọn **Android App Bundle**
3. Tạo hoặc chọn keystore
4. Chọn **release** build variant
5. Output: `android/app/release/app-release.aab`

---

## ✅ Bước 4: Testing Checklist

### Critical Tests

| Feature | iOS | Android |
|---------|-----|---------|
| ✅ App launches, loads thepicklehub.net | | |
| ✅ Livestream plays (tap to play) | | |
| ✅ Video không bị letterbox | | |
| ✅ Chat realtime hoạt động | | |
| ✅ Login/Logout works | | |
| ✅ Rotate screen không reload | | |
| ✅ Background → Foreground không crash | | |
| ✅ Deep links hoạt động | | |
| ✅ Pull-to-refresh | | |
| ✅ Network offline handling | | |

### Livestream-Specific Tests

- [ ] Video autoplay sau tap
- [ ] Inline playback (không fullscreen forced)
- [ ] Audio continues khi lock screen (iOS)
- [ ] Picture-in-Picture (nếu hỗ trợ)

---

## 🔧 Bước 5: Troubleshooting

### Video không play trên iOS

Đảm bảo `Info.plist` có:
```xml
<key>NSAllowsArbitraryLoadsForMedia</key>
<true/>
```

### WebSocket disconnect trên Android

Thêm permissions vào `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
```

### App bị kill khi background

iOS: Thêm `audio` vào `UIBackgroundModes`
Android: Sử dụng Foreground Service cho long-running tasks

### White screen on launch

1. Check console logs: `npx cap run ios -l` 
2. Verify https://www.thepicklehub.net accessible
3. Check network_security_config

---

## 📦 Bước 6: Store Submission

### App Store (iOS)

1. **App Store Connect**: https://appstoreconnect.apple.com
2. Tạo new app với Bundle ID: `net.thepicklehub.app`
3. Upload build từ Xcode Organizer
4. Fill metadata, screenshots
5. Submit for review

### Google Play (Android)

1. **Google Play Console**: https://play.google.com/console
2. Create new app
3. Upload AAB file
4. Complete store listing
5. Submit for review

---

## 🔄 Update Workflow

Khi web app thay đổi → **Không cần rebuild native app!**

App tự động load version mới từ https://www.thepicklehub.net

Chỉ cần rebuild khi:
- Thay đổi native config
- Update Capacitor version
- Thêm native plugins mới

---

## 📚 Resources

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Lovable Mobile Guide](https://docs.lovable.dev/tips-tricks/mobile-development)
- [App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Play Store Guidelines](https://play.google.com/about/developer-content-policy/)

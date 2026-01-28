
## Kế hoạch: Triển khai Native Google Sign-In với @codetrix-studio/capacitor-google-auth

### Tổng quan

Chuyển từ web-based OAuth (đang gặp lỗi redirect về app) sang Native Google Sign-In SDK, giúp:
- ✅ Tránh hoàn toàn lỗi `disallowed_useragent`
- ✅ Không cần App Links / Universal Links phức tạp
- ✅ Trải nghiệm native popup chọn tài khoản Google
- ✅ Đáng tin cậy hơn trên cả iOS và Android

### OAuth Client IDs (đã cung cấp)

| Loại | Client ID |
|------|-----------|
| Web (serverClientId) | `799212701204-pnak3bsb956b9n8mfttct7r3uhmuphqp.apps.googleusercontent.com` |
| Android | `799212701204-9aac8nqnkth7ch36822a3cjh89ddsmgs.apps.googleusercontent.com` |
| iOS | `799212701204-256cmrlb95s2m5nv6u3dsq3v646r44fj.apps.googleusercontent.com` |

---

### Luồng đăng nhập mới (Native Flow)

```text
┌─────────────────────────────────────────────────────────────┐
│  User nhấn "Đăng nhập bằng Google"                          │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  isNativeApp() → true?                                      │
├────────────────────────┬────────────────────────────────────┤
│  YES (Native)          │  NO (Web)                          │
│  ↓                     │  ↓                                 │
│  GoogleAuth.signIn()   │  supabase.auth.signInWithOAuth()  │
│  (Native SDK popup)    │  (Redirect browser)                │
│  ↓                     │                                    │
│  Nhận idToken          │                                    │
│  ↓                     │                                    │
│  supabase.auth         │                                    │
│  .signInWithIdToken()  │                                    │
│  ↓                     │                                    │
│  Session created ✓     │                                    │
└─────────────────────────────────────────────────────────────┘
```

---

### Các thay đổi code

#### 1. Cài đặt package mới

```bash
npm install @codetrix-studio/capacitor-google-auth
npx cap sync
```

**File:** `package.json`
- Thêm dependency: `@codetrix-studio/capacitor-google-auth`

#### 2. Cấu hình Capacitor

**File:** `capacitor.config.ts`
- Thêm plugin config `GoogleAuth` với 3 Client IDs

```typescript
plugins: {
  // ... existing plugins
  GoogleAuth: {
    scopes: ['profile', 'email'],
    serverClientId: '799212701204-pnak3bsb956b9n8mfttct7r3uhmuphqp.apps.googleusercontent.com',
    androidClientId: '799212701204-9aac8nqnkth7ch36822a3cjh89ddsmgs.apps.googleusercontent.com',
    iosClientId: '799212701204-256cmrlb95s2m5nv6u3dsq3v646r44fj.apps.googleusercontent.com',
    forceCodeForRefreshToken: true
  }
}
```

#### 3. Tạo hook useNativeGoogleAuth

**File mới:** `src/hooks/useNativeGoogleAuth.ts`

```typescript
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { supabase } from '@/integrations/supabase/client';
import { isNativeApp } from '@/lib/capacitor-utils';

export const initializeGoogleAuth = () => {
  if (isNativeApp()) {
    GoogleAuth.initialize({
      scopes: ['profile', 'email'],
      grantOfflineAccess: true,
    });
  }
};

export const nativeGoogleSignIn = async () => {
  // Gọi native Google SDK → lấy idToken
  const googleUser = await GoogleAuth.signIn();
  
  // Dùng idToken để tạo Supabase session
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: googleUser.authentication.idToken,
  });

  if (error) throw error;
  return data;
};

export const nativeGoogleSignOut = async () => {
  if (isNativeApp()) {
    await GoogleAuth.signOut();
  }
};
```

#### 4. Cập nhật Login.tsx

**File:** `src/pages/Login.tsx`

Sửa `handleGoogleSignIn` để phân biệt Native vs Web:

```typescript
import { isNativeApp } from '@/lib/capacitor-utils';
import { nativeGoogleSignIn } from '@/hooks/useNativeGoogleAuth';

const handleGoogleSignIn = async () => {
  setIsSubmitting(true);

  try {
    if (isNativeApp()) {
      // ===== NATIVE: Dùng native SDK =====
      const result = await nativeGoogleSignIn();
      
      toast({ title: t.auth.loginSuccess });
      navigate(redirectUrl || '/', { replace: true });
      
    } else {
      // ===== WEB: Dùng OAuth redirect =====
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://thepicklehub.net/auth/callback',
        },
      });
      if (error) throw error;
    }
  } catch (err: any) {
    console.error('[OAuth]', err);
    toast({
      variant: 'destructive',
      title: t.common.error,
      description: err.message || 'Google Sign-In failed',
    });
  } finally {
    setIsSubmitting(false);
  }
};
```

#### 5. Khởi tạo plugin trong App.tsx

**File:** `src/App.tsx`

```typescript
import { initializeGoogleAuth } from '@/hooks/useNativeGoogleAuth';

// Khởi tạo Google Auth khi app load (đặt trước component App)
initializeGoogleAuth();
```

Đồng thời, có thể bỏ logic `CapacitorApp.addListener("appUrlOpen")` cho OAuth vì không còn cần thiết với native flow.

#### 6. Cấu hình Android (Manual step)

**File:** `android/app/src/main/res/values/strings.xml`
- Thêm `server_client_id`

```xml
<resources>
    <string name="app_name">ThePickleHub</string>
    <string name="title_activity_main">ThePickleHub</string>
    <string name="package_name">net.thepicklehub.app</string>
    <string name="custom_url_scheme">net.thepicklehub.app</string>
    <string name="server_client_id">799212701204-pnak3bsb956b9n8mfttct7r3uhmuphqp.apps.googleusercontent.com</string>
</resources>
```

#### 7. Cấu hình iOS (Manual step)

**File:** `ios/App/App/Info.plist`
- Thêm URL scheme cho iOS client

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.799212701204-256cmrlb95s2m5nv6u3dsq3v646r44fj</string>
    </array>
  </dict>
</array>

<key>GIDClientID</key>
<string>799212701204-256cmrlb95s2m5nv6u3dsq3v646r44fj.apps.googleusercontent.com</string>
```

---

### Tóm tắt các file thay đổi

| File | Thao tác | Mô tả |
|------|----------|-------|
| `package.json` | Sửa | Thêm `@codetrix-studio/capacitor-google-auth` |
| `capacitor.config.ts` | Sửa | Thêm config GoogleAuth plugin với 3 Client IDs |
| `src/hooks/useNativeGoogleAuth.ts` | **Tạo mới** | Hook để khởi tạo và gọi native Google Sign-In |
| `src/pages/Login.tsx` | Sửa | Phân biệt native vs web flow |
| `src/App.tsx` | Sửa | Gọi `initializeGoogleAuth()` khi khởi động |
| `android/.../strings.xml` | Manual | Thêm `server_client_id` |
| `ios/.../Info.plist` | Manual | Thêm URL scheme + GIDClientID |

---

### Sau khi approve kế hoạch này

1. Tôi sẽ tạo/sửa các file code TypeScript
2. Bạn cần chạy:
   ```bash
   npm install
   npx cap sync
   ```
3. Cập nhật file `strings.xml` (Android) và `Info.plist` (iOS) theo hướng dẫn
4. Rebuild native app và test Google Sign-In

---

### Lưu ý quan trọng

- **Web flow vẫn hoạt động**: Code mới chỉ dùng native SDK khi `isNativeApp() === true`
- **Không cần App Links nữa**: Native SDK xử lý hoàn toàn trong app
- **idToken verification**: Supabase sẽ verify idToken với Google để tạo session an toàn



## Fix OAuth Login trên Custom Domain (Google + Apple)

### Nguyên nhân gốc

1. **Google (web)**: Code đang dùng `supabase.auth.signInWithOAuth` trực tiếp thay vì `lovable.auth.signInWithOAuth`. Lovable Cloud quản lý OAuth credentials — phải dùng Lovable managed flow.
2. **Apple (web)**: Đã dùng `lovable.auth.signInWithOAuth` đúng, nhưng `redirect_uri: window.location.origin` trả về `https://thepicklehub.net` — domain này chưa được thêm vào allowed redirect URIs.
3. **Native (iOS/Android)**: Dùng `supabase.auth.signInWithOAuth` trực tiếp là đúng (cần `skipBrowserRedirect`), nhưng `redirectTo` trỏ về `thepicklehub.net` cũng có thể gặp vấn đề.

### Thay đổi code: `src/pages/Login.tsx`

**1. Google web flow (lines 117-126):** Chuyển sang dùng Lovable managed OAuth
```typescript
// Trước (sai)
const { error } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: "https://thepicklehub.net/auth/callback" },
});

// Sau (đúng)
const { error } = await lovable.auth.signInWithOAuth("google", {
  redirect_uri: window.location.origin,
});
```

**2. Apple web flow (lines 160-162):** Giữ nguyên, đã đúng pattern. Chỉ cần thêm domain vào allowed URIs.

**3. Native flows (lines 99-115, 142-157):** Giữ nguyên dùng `supabase.auth.signInWithOAuth` với `skipBrowserRedirect` — đây là pattern đúng cho native. Chuyển `redirectTo` sang published URL để đảm bảo hoạt động:
```typescript
redirectTo: "https://pickle-hub-pro.lovable.app/auth/callback?native=1"
```

### Hướng dẫn thêm allowed redirect URI trong Lovable Cloud

Bạn cần thực hiện bước này trong giao diện Lovable:

1. Mở **Cloud view** (bạn đang ở đây rồi)
2. Vào **Users** → click icon **gear** (Auth Settings)
3. Trong phần **General settings** → tìm **URI allow list** (hoặc Redirect URLs)
4. Thêm các URL sau:
   - `https://thepicklehub.net`
   - `https://thepicklehub.net/auth/callback`
   - `https://www.thepicklehub.net`
   - `https://www.thepicklehub.net/auth/callback`
5. Đảm bảo **Site URL** được set là `https://thepicklehub.net`

### Tổng kết thay đổi

| File | Thay đổi |
|------|----------|
| `src/pages/Login.tsx` | Google web: chuyển sang `lovable.auth.signInWithOAuth`; Native redirectTo: dùng published URL |
| Lovable Cloud Auth Settings | Thêm `thepicklehub.net` vào allowed redirect URIs |


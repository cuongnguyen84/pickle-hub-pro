

# Kế hoạch cải thiện tốc độ trang

## Tổng quan
7 thay đổi để giảm TTFB cho 76 URL slow page từ báo cáo Ahrefs. Tập trung vào edge functions (gộp queries), cache headers, build optimization, và lazy loading.

---

## Thay đổi chi tiết

### 1. `supabase/functions/og-live/index.ts` — Gộp 3 queries → 1
Hiện tại gọi tuần tự: `public_livestreams` → `organizations` → `tournaments` (3 round-trip). Sẽ dùng `Promise.all()` để chạy song song query org + tournament sau khi có livestream data. Tăng cache header lên `s-maxage=600`.

### 2. `supabase/functions/og-video/index.ts` — Gộp queries + 302 redirect
Tương tự og-live: dùng `Promise.all()` cho org + tournament queries. Thêm 302 redirect cho non-crawler (hiện dùng meta-refresh). Tăng cache `s-maxage=600`.

### 3. `supabase/functions/og-organization/index.ts` — 302 redirect + cache
Thêm 302 redirect cho non-crawler thay vì meta-refresh + JS redirect. Thêm `Cache-Control: s-maxage=600`.

### 4. `supabase/functions/og-tournament/index.ts` — 302 redirect + cache  
Tương tự og-organization: 302 redirect cho non-crawler, thêm cache headers.

### 5. `vite.config.ts` — Tắt sourcemap production
Đổi `sourcemap: true` → `sourcemap: false`. Giảm build output, tăng tốc build.

### 6. `index.html` — Dọn duplicate meta tags
Xóa duplicate `og:title`, `og:description`, `twitter:title`, `twitter:description` ở dòng 86-89 (đã có ở trên). Giảm ~500 bytes HTML.

### 7. `src/pages/Index.tsx` — Lazy load OpenRegistrationSection & NewsCard
Wrap `OpenRegistrationSection` và `NewsCard` trong `React.lazy()` + `Suspense` vì nằm dưới fold.

---

## Kết quả dự kiến
- Edge function pages (livestream, video): TTFB giảm 30-50% nhờ parallel queries + cache
- Tất cả OG functions: CDN cache 10 phút thay vì 5 phút
- Build size giảm nhờ tắt sourcemap
- HTML initial payload giảm ~500 bytes


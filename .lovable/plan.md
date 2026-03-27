

# Tự động SEO cho ThePickleHub (Google + App Store)

## Phân tích hiện trạng

### Đã có
- `DynamicMeta` trên 27 pages (Index, Live, Tournaments, WatchLive, WatchVideo, Tools, Login, Account...)
- Structured data: `SoftwareApplicationSchema`, `WebApplicationSchema`, `VideoSchema`, `SportsEventSchema`
- `sitemap.xml`, `robots.txt`, canonical URLs, hreflang
- OG tags + Twitter cards
- App Links: `assetlinks.json` (Android), `apple-app-site-association` (iOS)

### Thiếu / Cần cải thiện

| Vấn đề | Trang |
|---------|-------|
| Không có `DynamicMeta` | `Videos.tsx`, `News.tsx`, `Search.tsx` |
| Forum meta quá sơ sài | `Forum.tsx` - chỉ "Diễn đàn Pickleball" |
| Thiếu trong sitemap | `/forum`, `/search` |
| Không có `BreadcrumbList` schema | Tất cả các trang |
| Không có `Organization` schema | Trang chủ |
| Thiếu `lastmod` trong sitemap | Tất cả URLs |
| App Store: thiếu Smart App Banner | `index.html` |

## Kế hoạch thực hiện

### 1. Thêm DynamicMeta cho 3 trang thiếu
- **Videos.tsx**: title "Pickleball Videos & Replays", description tiếng Anh + tiếng Việt cho SEO
- **News.tsx**: title "Pickleball News", description phù hợp
- **Search.tsx**: title dynamic theo query, `noindex=true` (search pages không nên index)

### 2. Cải thiện Forum SEO
- Mô tả chi tiết hơn cho Forum page
- Thêm `/forum` vào sitemap

### 3. Tạo `OrganizationSchema` component
Structured data cho Google Knowledge Panel:
```json
{
  "@type": "Organization",
  "name": "ThePickleHub",
  "url": "https://thepicklehub.net",
  "sameAs": ["social links..."]
}
```
Render trên trang chủ (Index.tsx).

### 4. Tạo `BreadcrumbSchema` component
Google hiển thị breadcrumb trong search results. Thêm cho các trang chính: Videos, News, Forum, Tools, Tournaments.

### 5. Cập nhật sitemap.xml
- Thêm `/forum`
- Thêm `lastmod` dates

### 6. App Store SEO (Smart App Banner)
Thêm vào `index.html`:
```html
<meta name="apple-itunes-app" content="app-id=YOUR_APP_ID, app-argument=https://thepicklehub.net">
```
Khi user mở trên iOS Safari → hiển thị banner "Open in App". Cần App Store ID thực tế.

### 7. Android App Links TWA metadata
Thêm `meta` tag cho Google Play:
```html
<meta name="google-play-app" content="app-id=net.thepicklehub.app">
```

## Files thay đổi
1. `src/pages/Videos.tsx` — thêm DynamicMeta
2. `src/pages/News.tsx` — thêm DynamicMeta
3. `src/pages/Search.tsx` — thêm DynamicMeta (noindex)
4. `src/pages/Forum.tsx` — cải thiện description
5. `src/components/seo/OrganizationSchema.tsx` — tạo mới
6. `src/components/seo/BreadcrumbSchema.tsx` — tạo mới
7. `src/components/seo/index.ts` — export mới
8. `src/pages/Index.tsx` — thêm OrganizationSchema
9. `public/sitemap.xml` — thêm /forum, lastmod
10. `index.html` — thêm Smart App Banner + Google Play meta

## Lưu ý
- Smart App Banner cần Apple App Store ID thực tế — sẽ hỏi bạn nếu đã có
- Không thay đổi UI/UX, chỉ thêm meta tags và structured data
- Tuân thủ SEO policy: không ảnh hưởng functional behavior


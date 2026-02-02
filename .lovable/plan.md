
# Kế hoạch triển khai hreflang trong DynamicMeta

## Mục tiêu
Thêm hreflang tags vào component DynamicMeta để giúp Google hiểu rằng website hỗ trợ đa ngôn ngữ (Tiếng Việt và Tiếng Anh), từ đó serve đúng phiên bản ngôn ngữ cho người dùng từ các quốc gia khác nhau.

## Phân tích hiện trạng

### Đã có
- DynamicMeta component quản lý tất cả meta tags động
- i18n system với 2 ngôn ngữ: `vi` (default) và `en`
- Language context lưu trong localStorage và cập nhật `document.documentElement.lang`

### Cần thêm
- hreflang link tags cho mỗi ngôn ngữ
- x-default hreflang cho ngôn ngữ mặc định
- Cập nhật og:locale dựa trên ngôn ngữ hiện tại

## Cách hoạt động của hreflang

```text
┌─────────────────────────────────────────────────────────────┐
│                    Google Crawler                            │
│                         │                                    │
│     ┌───────────────────▼───────────────────┐               │
│     │  Đọc hreflang tags trên trang          │               │
│     └───────────────────┬───────────────────┘               │
│                         │                                    │
│     ┌───────────────────▼───────────────────┐               │
│     │  Hiểu: Trang này có 2 phiên bản ngôn ngữ              │
│     │  - Vietnamese: hreflang="vi"                          │
│     │  - English: hreflang="en"                             │
│     │  - Default: hreflang="x-default"                      │
│     └───────────────────┬───────────────────┘               │
│                         │                                    │
│     ┌───────────────────▼───────────────────┐               │
│     │  Serve đúng phiên bản cho user         │               │
│     │  User từ US → Show English result      │               │
│     │  User từ VN → Show Vietnamese result   │               │
│     └───────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

---

## Chi tiết kỹ thuật

### File cần sửa: `src/components/seo/DynamicMeta.tsx`

### Thay đổi 1: Thêm prop mới
```typescript
interface DynamicMetaProps {
  title: string;
  description?: string;
  image?: string;
  type?: "website" | "video.other" | "article";
  url?: string;
  noindex?: boolean;
  creator?: string;
  publishedTime?: string;
  // Mới
  enableHreflang?: boolean;
}
```

### Thay đổi 2: Import useI18n hook
```typescript
import { useI18n } from "@/i18n";
```

### Thay đổi 3: Logic tạo hreflang tags
Trong useEffect, thêm logic:

```typescript
// Hreflang tags cho SEO đa ngôn ngữ
if (enableHreflang) {
  const baseUrl = "https://thepicklehub.net";
  const pathname = new URL(currentUrl).pathname;
  
  const updateHreflang = (hreflang: string, href: string) => {
    let link = document.querySelector(
      `link[rel="alternate"][hreflang="${hreflang}"]`
    ) as HTMLLinkElement;
    
    if (!link) {
      link = document.createElement("link");
      link.rel = "alternate";
      link.hreflang = hreflang;
      document.head.appendChild(link);
    }
    link.href = href;
  };

  // Vietnamese version
  updateHreflang("vi", `${baseUrl}${pathname}`);
  // English version  
  updateHreflang("en", `${baseUrl}${pathname}`);
  // Default fallback
  updateHreflang("x-default", `${baseUrl}${pathname}`);
}
```

### Thay đổi 4: Cập nhật og:locale dựa trên ngôn ngữ
```typescript
const { language } = useI18n();

// Trong useEffect
updateMeta("og:locale", language === "en" ? "en_US" : "vi_VN");
```

### Thay đổi 5: Cleanup hreflang khi unmount
```typescript
return () => {
  document.title = "ThePickleHub – Pickleball Tournaments, Livestream & Community";
  
  // Cleanup hreflang tags
  if (enableHreflang) {
    const hreflangLinks = document.querySelectorAll('link[rel="alternate"][hreflang]');
    hreflangLinks.forEach(link => link.remove());
  }
};
```

---

## Cách sử dụng

### Các trang cần bật hreflang (SEO pages)
```tsx
// FlexTournamentList.tsx
<DynamicMeta 
  title={t.tools.flexTournament.title}
  description={t.tools.flexTournament.description}
  url="https://thepicklehub.net/tools/flex-tournament"
  enableHreflang={true}  // Bật cho các trang tools SEO
/>
```

### Các trang KHÔNG cần hreflang
- `/login`, `/account` - Trang cá nhân
- `/tools/flex-tournament/:shareId` - Tournament cụ thể (dùng og edge function)
- Admin pages

---

## Kết quả HTML sau khi triển khai

```html
<head>
  <!-- Existing meta tags -->
  <title>Flex Tournament | ThePickleHub</title>
  <meta property="og:locale" content="vi_VN" />
  
  <!-- NEW: hreflang tags -->
  <link rel="alternate" hreflang="vi" href="https://thepicklehub.net/tools/flex-tournament" />
  <link rel="alternate" hreflang="en" href="https://thepicklehub.net/tools/flex-tournament" />
  <link rel="alternate" hreflang="x-default" href="https://thepicklehub.net/tools/flex-tournament" />
</head>
```

---

## Files cần sửa

| File | Thay đổi |
|------|----------|
| `src/components/seo/DynamicMeta.tsx` | Thêm logic hreflang + enableHreflang prop |
| `src/pages/FlexTournamentList.tsx` | Thêm `enableHreflang={true}` |
| `src/pages/DoublesEliminationList.tsx` | Thêm `enableHreflang={true}` |
| `src/pages/Tools.tsx` | Thêm DynamicMeta với `enableHreflang={true}` |
| `src/pages/QuickTables.tsx` | Thêm `enableHreflang={true}` |
| `src/pages/TeamMatchList.tsx` | Thêm `enableHreflang={true}` |

---

## Lợi ích SEO

1. **Tránh duplicate content**: Google hiểu VI và EN là cùng một nội dung, không phải spam
2. **Tăng CTR quốc tế**: User thấy kết quả đúng ngôn ngữ trong search results
3. **Cải thiện ranking**: Google ưu tiên serve đúng phiên bản cho từng thị trường
4. **Sẵn sàng mở rộng**: Dễ dàng thêm ngôn ngữ mới (Thai, Japanese, etc.)



# Fix OG Tags - Facebook dang doc sai metadata

## Nguyen nhan

Facebook Sharing Debugger cho thay:
- Facebook truy cap edge function URL -> nhan HTML voi OG tags (200 OK)
- Nhung `og:url` trong edge function tro den `thepicklehub.net/live/:id` (SPA)
- Facebook **re-fetch URL trong og:url** de lay OG tags "chinh thuc"
- SPA tra ve `index.html` voi OG tags chung (generic title, generic image)
- Ket qua: Facebook hien thi thong tin chung thay vi thong tin livestream

## Giai phap

Doi `og:url` trong edge functions tu canonical SPA URL sang **chinh URL share** (edge function URL). Khi do Facebook se khong re-fetch URL khac ma doc OG tags truc tiep tu edge function.

## Chi tiet thay doi

### 1. `supabase/functions/og-live/index.ts`

- Doi `og:url` tu `thepicklehub.net/live/{id}` sang URL cua chinh edge function
- Giu nguyen `meta http-equiv="refresh"` de redirect nguoi dung ve SPA
- Giu nguyen `twitter:url` tro den SPA (Twitter khong re-fetch)

Thay doi cu the:
```
// Truoc:
og:url = "https://thepicklehub.net/live/{id}"

// Sau:
og:url = "https://nijiwypubmkvmjuafmgp.supabase.co/functions/v1/og-live?id={id}"
```

### 2. `supabase/functions/og-video/index.ts`

- Tuong tu, doi `og:url` sang URL edge function

## Tong ket

| File | Thay doi |
|------|----------|
| `supabase/functions/og-live/index.ts` | Doi `og:url` sang edge function URL |
| `supabase/functions/og-video/index.ts` | Doi `og:url` sang edge function URL |

- Chi thay doi 1 dong trong moi file
- Khong anh huong redirect (nguoi dung van duoc chuyen ve trang chinh)
- Facebook se doc dung title, description, thumbnail tu edge function
- Can deploy lai edge functions sau khi sua


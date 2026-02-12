

# Fix OG Preview - Deploy Edge Functions va them default OG image

## Nguyen nhan

1. **Edge function `og-live` CHUA DUOC DEPLOY** - Khi Facebook crawler follow redirect tu `/share/live/:id`, no nhan 404 tu edge function -> fallback ve `index.html` voi meta tags chung
2. **Edge function `og-video` cung co the chua deploy** - Cung van de tuong tu
3. **File `og-image.png` khong ton tai** trong thu muc `public/` - Neu livestream khong co thumbnail, se bi broken image

## Du lieu livestream da co

Livestream `e5c61e50...` co day du data:
- Title: "Alix, Jonathan Truong, Ben Johns, ALW | PPATour Cape Coral 2026"
- Thumbnail: URL Google Drive (co the bi block boi Facebook - can kiem tra)
- Status: scheduled

## Ke hoach xu ly

### Buoc 1: Deploy edge functions
Deploy lai cac edge functions `og-live` va `og-video` de chung hoat dong.

### Buoc 2: Them default OG image
Tao mot file `public/og-image.png` (hoac dung URL co san) lam fallback khi livestream khong co thumbnail.

### Buoc 3: Fix potential Google Drive thumbnail issue
Thumbnail hien tai la URL Google Drive (`lh3.googleusercontent.com`). Facebook crawler co the khong load duoc image tu Google Drive. Can kiem tra va co fallback phu hop.

### Buoc 4: Test
- Goi truc tiep edge function de xac nhan tra ve HTML voi OG tags dung
- Test URL share tren Facebook Sharing Debugger

## Files thay doi

| File | Thay doi |
|------|----------|
| `supabase/functions/og-live/index.ts` | Khong thay doi code, chi deploy |
| `supabase/functions/og-video/index.ts` | Khong thay doi code, chi deploy |

Thao tac chinh: **Deploy edge functions** - khong can sua code.


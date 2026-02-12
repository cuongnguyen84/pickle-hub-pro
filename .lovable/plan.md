

# Fix Share URL - Dung domain thepicklehub.net thay vi supabase.co

## Van de hien tai

Link share hien tai:
```
https://nijiwypubmkvmjuafmgp.supabase.co/functions/v1/og-live?id=xxx
```
Nhin khong chuyen nghiep va khong an toan voi nguoi dung.

## Giai phap: Dung `_redirects` file

Lovable hosting ho tro file `_redirects` (tuong tu Netlify). Ta se tao redirect tu URL dep sang edge function:

```
https://thepicklehub.net/share/live/xxx  ->  edge function og-live
https://thepicklehub.net/share/video/xxx ->  edge function og-video
```

Facebook crawler se follow redirect 302 va doc OG tags tu edge function. Nguoi dung thay URL dep `thepicklehub.net/share/live/...`.

## Chi tiet thay doi

### 1. Tao `public/_redirects`

```text
/share/live/:id  https://nijiwypubmkvmjuafmgp.supabase.co/functions/v1/og-live?id=:id  302
/share/video/:id  https://nijiwypubmkvmjuafmgp.supabase.co/functions/v1/og-video?id=:id  302
```

### 2. Cap nhat `ShareDialog.tsx`

Doi URL share tu:
```
https://nijiwypubmkvmjuafmgp.supabase.co/functions/v1/og-live?id=xxx
```
Thanh:
```
https://thepicklehub.net/share/live/xxx
https://thepicklehub.net/share/video/xxx
```

### 3. Cap nhat OG edge functions (`og-live`, `og-video`)

Sua `canonicalUrl` trong edge function de dam bao redirect dung ve trang xem thuc (`/live/xxx`, `/video/xxx`) khi nguoi dung click vao link.

Khong can thay doi gi them vi logic hien tai da dung.

## Tong ket

| File | Thay doi |
|------|----------|
| `public/_redirects` | Tao moi - redirect `/share/*` sang edge functions |
| `src/components/share/ShareDialog.tsx` | Doi URL share sang `thepicklehub.net/share/...` |

- Khong thay doi routing React
- Khong tao page moi
- Khong anh huong UI/UX hien tai
- Facebook se doc duoc OG tags qua redirect


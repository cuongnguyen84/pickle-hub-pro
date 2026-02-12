
# Fix Share Link: 404 + OG Preview

## Nguyen nhan goc

File `public/_redirects` **KHONG DUOC HO TRO** boi Lovable hosting. Do do:
- Khi nguoi dung click link `/share/live/:id` -> SPA khong co route -> 404
- Khi Facebook crawler truy cap -> nhan `index.html` chung -> OG generic

Edge function `og-live` **DA HOAT DONG TOT** - tra ve day du title, description, thumbnail.

## Giai phap

### Buoc 1: Them React routes cho `/share/*` (Fix 404)

Tao component `ShareRedirect` xu ly redirect:
- `/share/live/:id` -> redirect sang `/live/:id`  
- `/share/video/:id` -> redirect sang `/video/:id`

Them 2 routes moi trong `App.tsx`. Nguoi dung click link se duoc chuyen den dung trang.

### Buoc 2: Doi URL share ve edge function truc tiep (Fix OG)

Vi `_redirects` khong hoat dong, cach duy nhat de Facebook doc OG tags la URL phai tro thang den edge function. Tuy nhien, de URL nhin dep hon cho nguoi dung:

- **Hien thi trong UI**: `thepicklehub.net/share/live/{id}` (URL dep)
- **Clipboard thuc te**: edge function URL (de Facebook doc OG)
- **Khi click**: Edge function redirect ve `/live/{id}` (da co trong code)

**Cach tiep can:** Trong ShareDialog, copy edge function URL vao clipboard nhung hien thi URL dep trong giao dien. Them note nho: "Link nay se hien thi hinh anh va tieu de khi chia se tren mang xa hoi"

### Buoc 3: Xoa file `_redirects` (Clean up)

Xoa file `public/_redirects` vi khong hoat dong tren Lovable hosting.

## Chi tiet ky thuat

### Files thay doi

| File | Thay doi |
|------|----------|
| `src/pages/ShareRedirect.tsx` | **Tao moi** - Component redirect tu `/share/*` sang trang chinh |
| `src/App.tsx` | Them 2 routes: `/share/live/:id` va `/share/video/:id` |
| `src/components/share/ShareDialog.tsx` | Doi lai thanh edge function URL cho clipboard (de OG hoat dong) |
| `public/_redirects` | **Xoa** - Khong hoat dong tren Lovable hosting |

### Logic ShareRedirect component

```text
URL: /share/live/{id}
  -> useEffect: navigate("/live/{id}", { replace: true })
  -> Hien loading spinner trong luc redirect

URL: /share/video/{id}  
  -> useEffect: navigate("/video/{id}", { replace: true })
```

### Logic ShareDialog (cap nhat)

```text
Copy to clipboard: edge function URL (Facebook doc duoc OG)
Hien thi trong UI: thepicklehub.net/share/... (URL dep)
Tooltip: "Link se hien thi hinh anh khi chia se tren Facebook/Zalo"
```

## Ket qua

- **Click link tren Facebook**: Khong con 404, redirect ve trang chinh
- **OG Preview tren Facebook**: Hien thi title, description, thumbnail day du
- **UX**: Nguoi dung thay URL dep trong giao dien, tooltip giai thich

## Luu y

Day la gioi han cua SPA (Vite/React) khi khong co SSR. Giai phap nay la toi uu nhat trong kien truc hien tai.

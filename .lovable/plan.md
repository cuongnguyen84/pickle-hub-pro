

# Han che IP tu Hoa Ky xem Livestream va Video

## Tong quan
Chan nguoi dung tu Hoa Ky (US) truy cap xem livestream va video. Su dung edge function de kiem tra vi tri dia ly (geolocation) dua tren IP, ket hop voi cau hinh linh hoat trong `system_settings` de admin co the bat/tat tinh nang nay.

## Cach tiep can

### Phuong an: Edge Function kiem tra IP + Client-side gate

Tao mot edge function nhan IP cua nguoi dung, tra ve quoc gia. Client goi function nay khi vao trang xem, neu la US thi hien thong bao chan va khong cho xem.

## Chi tiet ky thuat

### 1. Edge Function `geo-check` (file moi)

File: `supabase/functions/geo-check/index.ts`

- Lay IP tu request header (`x-forwarded-for`, `cf-connecting-ip`, hoac `x-real-ip`)
- Goi API mien phi de tra cuu quoc gia (su dung header co san tu Supabase/Deno Deploy, hoac fallback sang ip-api.com)
- Tra ve JSON: `{ country: "US", blocked: true }` hoac `{ country: "VN", blocked: false }`
- Doc danh sach quoc gia bi chan tu `system_settings` (key: `blocked_countries`)

```text
Request -> Edge Function
  |
  v
Doc IP tu headers
  |
  v
Tra cuu quoc gia (Deno Deploy co san header geo)
  |
  v
So sanh voi danh sach blocked_countries trong system_settings
  |
  v
Tra ve { country, blocked, message }
```

### 2. Hook moi: `useGeoBlock`

File: `src/hooks/useGeoBlock.ts`

- Goi edge function `geo-check` mot lan duy nhat (cache ket qua trong sessionStorage)
- Tra ve: `{ isBlocked, isLoading, country }`
- Neu bi chan, cac trang WatchLive va WatchVideo se hien overlay thong bao

### 3. Component: `GeoBlockOverlay`

File: `src/components/video/GeoBlockOverlay.tsx`

- Hien thi khi `isBlocked = true`
- Thong bao: "Noi dung nay khong kha dung tai khu vuc cua ban / This content is not available in your region"
- Che toan bo video player, khong cho xem

### 4. Tich hop vao cac trang xem

**`src/pages/WatchLive.tsx`**
- Goi `useGeoBlock()` 
- Neu `isBlocked` -> render `GeoBlockOverlay` thay vi video player

**`src/pages/WatchVideo.tsx`**
- Tuong tu WatchLive

**`src/pages/embed/EmbedLive.tsx`** va **`src/pages/embed/EmbedVideo.tsx`**
- Tuong tu, chan ca embed player

### 5. Cau hinh admin (system_settings)

Them key moi vao bang `system_settings`:
- `blocked_countries`: gia tri `["US"]` (mang JSON cac ma quoc gia)
- `geo_block_enabled`: `true/false` (bat/tat tinh nang)

Cap nhat trang `AdminOverview.tsx` them section quan ly:
- Toggle bat/tat geo block
- Input danh sach quoc gia bi chan (mac dinh: US)

### 6. i18n

Them cac key dich cho thong bao chan.

## Thu tu trien khai

1. Them `blocked_countries` va `geo_block_enabled` vao `system_settings` (migration)
2. Tao edge function `geo-check`
3. Tao hook `useGeoBlock`
4. Tao component `GeoBlockOverlay`
5. Tich hop vao WatchLive, WatchVideo, EmbedLive, EmbedVideo
6. Them UI quan ly trong AdminOverview
7. i18n updates

## Luu y
- Edge function su dung header `x-forwarded-for` de lay IP - day la cach chuan tren Deno Deploy
- Ket qua geo check duoc cache trong `sessionStorage` de khong goi lai moi lan chuyen trang
- Nguoi dung co the dung VPN de vuot qua - day la han che cua moi giai phap geo-blocking phia client
- Neu can chan chat che hon, co the chan o tang Mux (streaming CDN) nhung can cau hinh rieng tren Mux dashboard


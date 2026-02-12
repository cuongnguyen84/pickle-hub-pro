
# Fix OG Type cho Edge Functions og-live va og-video

## Van de
Cac Edge Function `og-live` va `og-video` dang su dung `og:type = "video.other"` nhung khong cung cap day du cac the `og:video` bat buoc. Facebook se tu choi scrape trang khi gap `video.other` ma khong co video object hop le.

## Giai phap

### 1. Sua `og-live/index.ts`

**Thay doi 1**: Them `mux_playback_id` vao query database (dong 38-49)
- Them field `mux_playback_id` vao SELECT de kiem tra co video URL hay khong

**Thay doi 2**: Xay dung logic og:type thong minh (truoc khi generate HTML)
- Neu livestream co `mux_playback_id` hop le → tao video URL dang `https://stream.mux.com/{playback_id}.m3u8`
- Neu khong co → mac dinh `og:type = "article"`

**Thay doi 3**: Thay doi phan OG tags trong HTML template (dong 166-167)
- Thay the dong `<meta property="og:type" content="video.other" />` co dinh
- Bang logic dieu kien:
  - Co video URL:
    ```
    og:type = "video.other"
    og:video = "{video_url}"
    og:video:type = "text/html"  
    og:video:width = "1280"
    og:video:height = "720"
    ```
  - Khong co video URL:
    ```
    og:type = "article"
    ```

### 2. Sua `og-video/index.ts`

**Thay doi tuong tu**:

**Thay doi 1**: Them `mux_playback_id` vao query (dong 37-49)

**Thay doi 2**: Xay dung logic video URL
- Neu video co `mux_playback_id` → tao URL `https://stream.mux.com/{playback_id}.m3u8`

**Thay doi 3**: Thay doi OG tags trong HTML (dong 142)
- Logic dieu kien giong og-live:
  - Co `mux_playback_id` → dung `video.other` + day du og:video tags
  - Khong co → dung `article`

**Thay doi 4**: Loai bo dong `video:duration` rieng le (dong 156) vi no se duoc gop vao block og:video khi co video URL

### 3. Tong ket cac the giu nguyen (khong thay doi)
- `og:title`, `og:description`, `og:image`, `og:url`, `og:site_name`, `og:locale`
- Twitter Card tags
- Crawler detection logic
- Redirect logic cho browser vs crawler
- Response headers (`Content-Type: text/html; charset=utf-8`)
- Cache headers

## Ket qua mong doi
- Tat ca link share scrape thanh cong tren Facebook va Zalo
- Khong con Response code 0 do thieu video object
- Tuong thich mo rong: khi co video thuc su (Mux playback) se tu dong hien thi dung og:type video

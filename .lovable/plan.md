

# Ke hoach tich hop Ant Media Server (Enterprise Edition) thay the Red5

## Tong quan

Thay the Red5 bang Ant Media Server Enterprise (tren AWS) lam provider live streaming chinh. Mux van duoc giu lai cho VOD/replay. Database da co san cac cot `streaming_provider`, `hls_url` nen chi can cap nhat gia tri, khong can them cot moi.

## Buoc 1: Luu tru API credentials

Can luu 2 secret:
- **ANT_MEDIA_SERVER_URL** - URL cua Ant Media Server (vi du: `https://your-domain.com:5443`)
- **ANT_MEDIA_APP_NAME** - Ten ung dung tren Ant Media (mac dinh thuong la `LiveApp` hoac `WebRTCAppEE`)

## Buoc 2: Tao Edge Function `ant-media-create-livestream`

Edge function moi se:
1. Xac thuc user (creator/admin)
2. Goi Ant Media REST API `POST /rest/v2/broadcasts` de tao stream moi
3. Tra ve `streamId`, RTMP URL (`rtmp://{server}/{app}/{streamId}`), va HLS URL (`https://{server}/{app}/streams/{streamId}.m3u8`)

```text
Client --> Edge Function --> Ant Media REST API
                |
                v
          Tra ve: streamId, RTMP URL, HLS URL
```

## Buoc 3: Tao component `HlsPlayer`

Component moi su dung `hls.js` (da co san trong node_modules qua `@mux/playback-core`) de phat HLS stream. Component nay se:
- Nhan prop `hlsUrl` thay vi `playbackId`
- Co giao dien tuong tu MuxPlayer (tap-to-play overlay, error handling, auto-reconnect cho live)
- Ho tro ca live va replay

File: `src/components/video/HlsPlayer.tsx`

## Buoc 4: Cap nhat trang xem live (`WatchLive.tsx`)

Logic hien tai chi dung MuxPlayer. Can them:
- Kiem tra `livestream.streaming_provider`:
  - Neu `antmedia` hoac `red5` --> render `HlsPlayer` voi `livestream.hls_url`
  - Neu `mux` hoac khong co --> render `MuxPlayer` nhu cu (tuong thich nguoc)
- Ap dung cho ca mobile va desktop player

## Buoc 5: Cap nhat form tao livestream (`CreatorLivestreamForm.tsx`)

Them tuy chon chon provider khi tao livestream:
- Dropdown chon "Ant Media" hoac "Mux"
- Khi chon **Ant Media**: nut "Create Ant Media Stream" goi edge function moi, hien thi RTMP URL + Stream Key cho OBS
- Khi chon **Mux**: giu nguyen logic hien tai
- Luu `streaming_provider = 'antmedia'` va `hls_url` vao database

## Buoc 6: Cap nhat form data va submit

Them cac truong moi vao form state:
- `streaming_provider`: `'antmedia'` | `'mux'`
- `hls_url`: URL HLS tu Ant Media
- `ant_media_stream_id`: Stream ID tren Ant Media (luu vao `red5_stream_name` de tai su dung cot co san)

Khi submit, gui tat ca du lieu bao gom provider va HLS URL len database.

## Buoc 7: Cap nhat Embed page

File `src/pages/embed/EmbedLive.tsx` cung can logic tuong tu WatchLive de chon dung player dua tren `streaming_provider`.

---

## Chi tiet ky thuat

### Ant Media REST API (Enterprise)

Tao broadcast:
```text
POST https://{server}:5443/{app}/rest/v2/broadcasts
Content-Type: application/json

{
  "name": "Tieu de stream",
  "type": "liveStream"
}

Response: { "streamId": "abc123", "status": "created", ... }
```

RTMP ingest: `rtmp://{server}/{app}/{streamId}`
HLS playback: `https://{server}:5443/{app}/streams/{streamId}.m3u8`

### Cac file can tao/sua

| File | Hanh dong |
|------|-----------|
| `supabase/functions/ant-media-create-livestream/index.ts` | Tao moi |
| `src/components/video/HlsPlayer.tsx` | Tao moi |
| `src/components/video/index.ts` | Them export HlsPlayer |
| `src/pages/WatchLive.tsx` | Them logic chon player theo provider |
| `src/pages/creator/CreatorLivestreamForm.tsx` | Them dropdown provider + logic Ant Media |
| `src/pages/embed/EmbedLive.tsx` | Them logic chon player theo provider |
| `supabase/config.toml` | Them config cho edge function moi |

### Khong can migration database

Database da co san cac cot can thiet:
- `streaming_provider` (text, default 'red5') --> se dung gia tri 'antmedia'
- `hls_url` (text) --> luu HLS URL tu Ant Media
- `red5_stream_name` (text) --> tai su dung de luu Ant Media stream ID
- `red5_server_url` (text) --> tai su dung de luu Ant Media server URL

View `public_livestreams` da expose `streaming_provider` va `hls_url` nen frontend doc duoc ngay.


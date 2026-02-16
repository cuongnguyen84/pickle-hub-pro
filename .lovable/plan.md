

# Tich hop Red5 Cloud cho Livestream

## Tong quan
Tich hop Red5 Cloud lam dich vu RTMP livestream mac dinh cho cac livestream moi. Livestream cu van giu nguyen Mux de phat lai (replay). Nguoi xem se xem qua HLS - tuong thich moi trinh duyet.

## Thong tin can luu bao mat (Secrets)
Sau khi duyet plan, ban can cung cap 3 gia tri:
- **RED5_SM_HOST**: `userId-2209-28772279df.cloud.red5.net` (da biet)
- **RED5_SM_USER**: Username API cua Stream Manager
- **RED5_SM_PASSWORD**: Password API cua Stream Manager
- **RED5_NODE_GROUP**: `default` (da biet)

## Kien truc tong the

```text
Creator (OBS/Streamlabs)
    |
    | RTMP publish
    v
Red5 Cloud (Origin Node)
    |
    | HLS transcoding
    v
Red5 Cloud (Edge/NFS)
    |
    | .m3u8 playback
    v
Viewer (Browser - hls.js)
```

Luong tao livestream:

```text
1. Creator nhan "Tao livestream" tren web
2. Edge Function goi Red5 SM API:
   a. PUT /as/v1/auth/login (Basic Auth) -> JWT token
   b. POST /as/v1/streams/provision/{nodeGroup} -> Provision stream
   c. GET /as/v1/streams/stream/{nodeGroup}/live/{streamName}?action=broadcast -> Origin server
3. Luu vao DB: RTMP URL, HLS URL, stream name
4. Creator copy RTMP URL vao OBS va bat dau stream
5. Viewer truy cap trang xem -> hls.js load m3u8 URL
```

## Chi tiet ky thuat

### 1. Database Migration

Them cac cot moi vao bang `livestreams`:

- `streaming_provider TEXT DEFAULT 'red5'` - Gia tri: `mux` hoac `red5`. Mac dinh `red5` cho livestream moi
- `red5_stream_name TEXT` - Ten stream tren Red5 (duy nhat, tu dong tao)
- `red5_server_url TEXT` - RTMP publish URL day du
- `hls_url TEXT` - URL HLS playback (.m3u8)

Cap nhat view `public_livestreams`:
- Them `streaming_provider`, `hls_url` (public)
- KHONG expose `red5_stream_name`, `red5_server_url` (nhay cam, chi creator thay)

Cap nhat livestream cu: `UPDATE livestreams SET streaming_provider = 'mux' WHERE streaming_provider IS NULL`

### 2. Edge Function: `red5-create-livestream`

File: `supabase/functions/red5-create-livestream/index.ts`

Chuc nang:
- Xac thuc JWT - chi creator/admin
- Tao stream name duy nhat (vd: `pkh_{livestreamId_8ky_tu}`)
- Goi Red5 SM 2.0 API:
  1. **Auth**: `PUT https://{user}:{pass}@{SM_HOST}/as/v1/auth/login` -> JWT
  2. **Provision**: `POST https://{SM_HOST}/as/v1/streams/provision/{nodeGroup}` voi body provision stream trong scope `live`
  3. **Get Origin**: `GET https://{SM_HOST}/as/v1/streams/stream/{nodeGroup}/live/{streamName}?action=broadcast` -> Dia chi Origin server
- Tra ve:
  - `rtmp_url`: `rtmp://{origin_address}:1935/live`
  - `stream_name`: ten stream
  - `hls_url`: `https://{SM_HOST}/{nodeGroup}/live/{streamName}.m3u8`

Config trong `supabase/config.toml`:
```text
[functions.red5-create-livestream]
verify_jwt = false
```
(Xac thuc bang tay trong code)

### 3. Component: `HlsPlayer.tsx`

File: `src/components/video/HlsPlayer.tsx`

- Su dung thu vien `hls.js` (can them dependency)
- Dependency moi: `hls.js` - thu vien HLS player pho bien, tuong thich moi browser
- Props: `hlsUrl`, `autoPlay`, `muted`, `poster`
- Tu dong reconnect khi mat ket noi (retry 3 lan)
- Hien thi loading spinner khi dang buffer
- Fallback: Neu browser ho tro native HLS (Safari), dung truc tiep the `<video>`
- Giu style giong MuxPlayer hien tai

### 4. Cap nhat Creator Livestream Form

File: `src/pages/creator/CreatorLivestreamForm.tsx`

- Livestream moi mac dinh `streaming_provider = 'red5'`
- Sau khi tao livestream trong DB, goi edge function `red5-create-livestream`
- Hien thi thong tin OBS:
  - RTMP Server URL
  - Stream Name (Key)
- Luu `red5_stream_name`, `red5_server_url`, `hls_url` vao DB
- Giu nguyen cac field khac (title, thumbnail, schedule, etc.)

### 5. Cap nhat trang xem

**`src/pages/WatchLive.tsx`**:
- Doc `streaming_provider` tu livestream data
- Neu `red5`: render `HlsPlayer` voi `hls_url`
- Neu `mux`: render `MuxPlayer` nhu hien tai
- Tat ca tinh nang khac (chat, gate, geo-block) giu nguyen

**`src/pages/embed/EmbedLive.tsx`**:
- Tuong tu WatchLive - chon player theo provider

### 6. Cap nhat hooks va types

**`src/hooks/useSupabaseData.ts`**:
- Cap nhat type Livestream them cac field moi

**`src/components/video/index.ts`**:
- Export `HlsPlayer`

### 7. i18n

Them cac key:
- `streamingProvider`: "Dich vu phat" / "Streaming Provider"
- `rtmpUrl`: "RTMP Server" / "RTMP Server"
- `streamKey`: "Stream Key" / "Stream Key"
- `copyStreamInfo`: "Sao chep thong tin stream" / "Copy stream info"

## Pham vi thay doi

| File | Hanh dong | Mo ta |
|------|-----------|-------|
| Migration SQL | Tao moi | Them cot vao `livestreams`, cap nhat view |
| `supabase/functions/red5-create-livestream/index.ts` | Tao moi | Goi Red5 SM API |
| `supabase/config.toml` | Cap nhat | Them config function moi |
| `src/components/video/HlsPlayer.tsx` | Tao moi | HLS player dung hls.js |
| `src/components/video/index.ts` | Cap nhat | Export HlsPlayer |
| `src/pages/creator/CreatorLivestreamForm.tsx` | Cap nhat | Dung Red5 mac dinh |
| `src/pages/WatchLive.tsx` | Cap nhat | Chon player theo provider |
| `src/pages/embed/EmbedLive.tsx` | Cap nhat | Chon player theo provider |
| `src/hooks/useSupabaseData.ts` | Cap nhat | Them type fields moi |
| `src/i18n/vi.ts`, `src/i18n/en.ts` | Cap nhat | Them key moi |
| `package.json` | Cap nhat | Them `hls.js` dependency |

## Khong thay doi

- Mux webhook, mux-sync-assets: van hoat dong cho livestream cu
- Replay/VOD: van phat qua Mux (livestream cu co `streaming_provider = 'mux'`)
- Chat, geo-block, login gate: giu nguyen, hoat dong voi ca 2 provider
- Video on demand (upload video): van dung Mux

## Thu tu trien khai

1. Yeu cau nhap secrets (RED5_SM_USER, RED5_SM_PASSWORD)
2. Chay migration them cot moi
3. Tao edge function `red5-create-livestream`
4. Them dependency `hls.js` va tao `HlsPlayer` component
5. Cap nhat `CreatorLivestreamForm` dung Red5 mac dinh
6. Cap nhat `WatchLive` va `EmbedLive` chon player theo provider
7. Cap nhat i18n

## Luu y

- **Trial license**: Ban dang dung goi Trial cua Red5 Cloud. Can kiem tra gioi han (so stream dong thoi, thoi gian, etc.)
- **HLS latency**: HLS co do tre 5-15 giay, tuong tu Mux hien tai. Neu sau nay can do tre thap hon (<1s), co the nang cap len WebRTC
- **VPN bypass**: Geo-block van hoat dong binh thuong voi Red5 (xu ly phia client)
- **OBS setup**: Creator can nhap RTMP URL va Stream Key vao OBS giong nhu voi Mux


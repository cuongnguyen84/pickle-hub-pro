## Confirm: Option B — Proceed với plan đã approve

### Kết quả verify

Login wall hiện tại là **Option B (useEffect-based)**:

- `useLivestreamGate` hook: countdown chỉ chạy client-side khi video đang play
- `LivestreamGateOverlay`: render conditional dựa trên `isGated` state (mặc định `false`)
- Video player luôn render trong DOM, overlay chỉ phủ lên trên bằng CSS absolute
- **Prerender/Googlebot sẽ thấy clean content** — không có login wall

→ Không cần refactor. Sẽ implement đúng plan đã approve:

### Files cần sửa

**1. `supabase/functions/prerender/index.ts` — `renderLive()**`

- Thêm robots meta: `max-video-preview:-1, max-image-preview:large, max-snippet:-1`
- Upgrade schema: `@graph` array với `VideoObject` (isAccessibleForFree: false, hasPart Clip 30s) + `BroadcastEvent`
- Mở rộng body content: H1, match info, description, CTA text, related links
- Select thêm `started_at` cho duration calculation

**2. `src/pages/WatchLive.tsx**`

- Fix canonical URL: `/livestream/${id}` → `/live/${id}`
- Thêm `.paywall` class wrapper quanh video player area
  Confirmed Option B. Proceed với plan đã approve. Code đi. Sau khi deploy, tôi sẽ verify với 6 tests: 1. Canonical tag server-side (không phải comment placeholder) 2. VideoObject schema đầy đủ trong @graph 3. BroadcastEvent schema đầy đủ trong @graph 4. Robots meta có max-video-preview:-1 5. Body content có H1 + match info + description visible 6. Google Rich Results Test pass cho cả Video và Event
# Risk audit — livestream-gate-hardening (round 1)

Auditor: risk-auditor (độc lập, không đọc output agent khác). Ngày 2026-07-20.
Classifier: `risk-tier.mjs` → **AMBER** (`user-facing route`). Giữ nguyên AMBER — xem "Verdict".

## Verdict: 🟡 AMBER
Cái hỏng tệ nhất thực tế: một fix "re-pause liên tục" hoặc "chỉ đếm khi playing" viết ẩu sẽ (a) tạm khoá/tạm dừng live của **user đã đăng nhập** trong cửa sổ auth-restore chậm ở đúng tối thứ 7, hoặc (b) đưa `gated` vào deps của `useLivePresence` và tái diễn sự cố channel-collision 2026-07-08 (concurrent count kẹt ở 1) — cả hai đều degrade chứ không sập trang, và **git revert + redeploy Cloudflare khôi phục hoàn toàn** (không migration, không native, không push, không worker). Vì rollback sạch nên KHÔNG nâng RED.

Classifier said: AMBER · Không nâng, không hạ — không có migration/native/worker/push nào để đẩy lên RED; nhưng có 2 dòng "Cao" hard-gate merge bên dưới.

## Rủi ro cụ thể
| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| 1 | **Cao** | `useIntervalViewCounter` (shared) đổi sang "chỉ đếm khi playing" nhưng caller video (`WatchVideo.tsx`, `EmbedVideo.tsx`) không truyền/không cập nhật cờ playing → mặc định false | View của **video thường** rớt về 0 sau deploy — trông như mất traffic | Cập nhật + test cả 5 caller (WatchLive, HomeLivePlayer, EmbedLive, WatchVideo, EmbedVideo) trong CÙNG PR; giữ default = hành vi hiện tại nếu không truyền cờ |
| 2 | **Cao** | Đưa `gated` vào deps effect subscribe của `useLivePresence` (deps hiện tại `[livestreamId, enabled]`, :201) → `release()`/`acquire()` churn → đúng path collision đã ghi ở comment :50-66 | Số "đang xem" trên /live kẹt ở 1 vào tối thứ 7; admin viewer list câm | Cập nhật payload qua `channel.track({...current, gated})` SAU subscribe; KHÔNG cho `gated` vào dependency array |
| 3 | **Cao/TB** | "Re-pause liên tục" nếu gate theo `shouldGate = isEnabled && !isAuthenticated` (`!!user`, chưa chờ `useAuth().loading`). Settings về trước, session restore chậm → user đã login bị phân loại anonymous → effect pause phát | Live của user **đã đăng nhập** bị dừng (có thể chớp overlay login) rồi phải bấm play lại | Gate chỉ khi `!loading` (useAuth :12/84 có `loading`). Truyền `isAuthenticated: !loading && !!user`, và chỉ pause khi `isGated` (đã latch), không pause theo `shouldGate` thô |
| 4 | **TB** | Persist start-time bằng `Date.now()` biến preview từ "thời gian XEM" → "thời gian tường". Hook hiện chỉ tick khi `isPlaying` (:65) | User mở stream, xem 2s, rời tab 1 phút, quay lại → bị gate ngay dù mới xem 2s | Persist **elapsed watched seconds**, không phải wall-clock start. Validate/clamp timestamp (NaN, tương lai, clock lùi); wrap try/catch (private mode) |
| 5 | **TB** | `HomeLivePlayer` + `WatchLive` dùng chung `livestreamId` → chung key `pkl_preview_seen_<id>` (STORAGE_KEY :3). Hero tiêu preview trước | Để trang chủ mở 15s rồi mở /live → không còn preview, gate ngay | Chấp nhận có chủ đích (hero là live-only) HOẶC tách namespace key theo surface. Ghi rõ vào proposal |
| 6 | **TB** | EmbedLive thêm gate nhưng chép thiếu logic `applies_to` của WatchLive (:59-65) → gate mọi trạng thái | Replay (ended) bị khoá login dù config `applies_to=live` | Nhân bản đúng `gateEnabled` gồm nhánh live/replay/all; test replay qua /embed/live |
| 7 | **TB** | Embed trong iframe bên thứ 3: Safari ITP partition storage. User login ở tab mới (top-level) → session KHÔNG thấy được trong iframe partitioned | Login xong quay lại iframe vẫn bị gate vĩnh viễn (kể cả reload) | Overlay embed phải `target="_blank"` + copy hướng dẫn "xem tiếp ở tab mới"; không dựa vào storage event xuyên partition. localStorage trong iframe có thể throw SecurityError → wrap try/catch |
| 8 | **TB** | Đổi metric: sau deploy tab paused/gated/background không còn đếm mỗi 30s | View livestream tụt mạnh ngay sau deploy — dễ tưởng là mất traffic/sập player | Cuong annotate mốc deploy trong GA/dashboard; ghi baseline trước |
| 9 | **Thấp** | 2 player cùng mount (mobile ẩn CSS + desktop) share `onPlayStateChange` → last-writer-wins `isVideoPlaying` | Player hiện đang phát nhưng `isPlaying=false` → view ngừng đếm / presence sai / re-pause trượt player | Lấy state từ đúng player hiển thị (hoặc chỉ mount 1); đừng suy `isPlaying` từ 2 callback |
| 10 | **Thấp** | Presence version skew: tab cũ gửi payload thiếu `gated`; refcount 1 key/1 channel không biểu diễn được 2 gate-state khác nhau (hero ungated + watch gated cùng browser) | Admin list lật cùng 1 viewer giữa gated/watching; tab cũ có thể bị lọc sai | `presence?.gated` optional-chain (useLiveViewerList đã dùng, :125-130); coi thiếu field = legacy ungated, đừng lọc `=== false` |

## SLO bị đe doạ
- **SLO 6 (Latency, không trực tiếp)** & trải nghiệm live-night: item #2/#3 degrade đúng lúc traffic đỉnh; không phải outage nhưng là "silent 1-viewer" / live bị pause.
- **Không đụng SLO 1-5,7** trực tiếp: không migration (data integrity an toàn), không auth surface edge-function (`batch-view-events` giữ `verify_jwt=false`, config.toml :21-22 không đổi), không cron, không push.
- Lưu ý: đây là fix về ĐO ĐẠC — không có SLO chính thức cho "view count accuracy", nên #1/#8 là rủi ro tin cậy-số-liệu, không phải error-budget SLO.

## Ngân sách hiệu năng
- Bundle: gate/overlay/useAuth/useSystemSettings đã có sẵn trong bundle (WatchLive dùng rồi). EmbedLive thêm các import này vào chunk embed → +vài KB, ước < 5 KB gz. Trong 20 KB headroom. **Pass** — nhưng verify bằng `check-bundle-size.mjs` vì embed vốn được giữ nhẹ để nhúng iframe.
- Vietnam p75: không thêm render nặng trên /feed hay waterfall mới. Presence/gate là client, không thêm request đồng bộ. Ảnh hưởng p75 ~0.

## SEO
- Routes SSR bị ảnh hưởng: **none**. Gate 100% client-side React. Prerender path `functions/_lib/render/live-video.ts` không có tham chiếu auth/gate/require_login (đã grep) — bot vẫn nhận 200 + meta đầy đủ bất kể gate.
- Cần bump `pr:v30`? **No** — SSR output không đổi.
- Verify: `curl -A "Googlebot" https://www.thepicklehub.net/live/<id>` → expect 200 + title + og:image + hreflang (không đổi so với hiện tại).

## Kế hoạch rollback
- Cơ chế: **git revert + Cloudflare Pages redeploy**. Toàn bộ thay đổi là React/TS client + i18n. Không migration, không edge function, không native (apple/ ngoài scope), không push.
- Thời gian khôi phục: 1 build + deploy Cloudflare (~3-5 phút).
- Không revert được: **none**. Đây là lý do giữ AMBER thay vì RED.
- Lưu ý: item #4 ghi localStorage `pkl_preview_seen_<id>` cho user thật — revert code KHÔNG xoá key đã ghi. Không nguy hiểm (key cũ chỉ khiến gate hiện cho anon đã xem), nhưng nếu schema key đổi thì user anon có thể thấy hành vi lệch tới khi key hết đời. Cân nhắc chỉ ghi elapsed-seconds có TTL.

## Phải verify trước khi merge
- [ ] Test cả 5 caller `useIntervalViewCounter` (grep `useIntervalViewCounter(` = 4 file: WatchLive, HomeLivePlayer, EmbedLive, WatchVideo/EmbedVideo) — video thường vẫn đếm view (dòng #1).
- [ ] Đọc diff `useLivePresence.ts`: `gated` KHÔNG có trong deps effect (:182-201); payload đổi qua `channel.track()` (dòng #2).
- [ ] Đọc diff WatchLive/HomeLivePlayer: gate chờ `useAuth().loading===false` trước khi enforce/persist; pause chỉ theo `isGated` đã latch (dòng #3).
- [ ] Đọc diff `useLivestreamGate.ts`: persist là watched-elapsed, wrap try/catch, clamp NaN/future/backward clock (dòng #4).
- [ ] EmbedLive gate nhân bản đúng `applies_to`; overlay embed `target="_blank"` (dòng #6/#7).
- [ ] Chạy `node scripts/check-bundle-size.mjs` sau build — chunk embed không vượt budget.
- [ ] Test tay tối thứ 7 mô phỏng: login-restore chậm (throttle) + tap play → live KHÔNG bị pause.
- [ ] Ghi baseline view-count livestream + video trước deploy để so bước nhảy (dòng #8).

## Phản biện độc lập (GPT-5.6)
Chạy đủ (OPENAI_API_KEY set), nguyên văn: `docs/proposals/livestream-gate-hardening/external/risk-auditor-gpt56.md`.

- **Đã xác minh trong repo (giữ lại):**
  - Two-player shared `isPlaying` last-writer-wins — verify WatchLive :261/:310 cùng handler (→ #9).
  - authResolved race: `useAuth` có `loading` (:12/84), WatchLive chưa dùng, gate theo `!!user` thô (→ #3).
  - Shared view-counter zero plain video nếu thiếu caller (→ #1); interval reset khi re-key theo isPlaying làm segment <30s không đếm (verify hook dùng 1 setInterval on-mount :53).
  - `gated` không được là subscribe-dep = đúng class 2026-07-08 (verify deps :201 + comment collision :50-66) (→ #2).
  - Wall-clock vs watched-time; hero + watch chung STORAGE_KEY (verify :3 + HomeLivePlayer dùng chung useLivestreamGate) (→ #4/#5).
  - applies_to trên replay qua embed (verify WatchLive :59-65) (→ #6).
  - Safari ITP third-party-storage partition trên embed (→ #7); step-change annotate (→ #8).
  - Refcount 1-key/1-gated ambiguity + version skew optional-chain (verify useLiveViewerList :125-130) (→ #10).

- **Bác bỏ:**
  - GPT item 4: "nếu homepage hero implemented using `EmbedLive` thì gate luôn hero" — **SAI cho repo này**. Hero dùng `HomeLivePlayer` (MuxPlayer trực tiếp), KHÔNG phải EmbedLive (verify HomeLivePlayer.tsx). Mối lo chung-key là thật nhưng đi qua HomeLivePlayer, không phải EmbedLive → giữ ở #5 với cơ chế đúng.
  - GPT item 6 version-skew: hướng lọc mô tả ngược (`=== false` GIỮ undefined chứ không loại) — mitigation "coi missing = legacy ungated" vẫn đúng nên giữ, sửa lại cơ chế ở #10.

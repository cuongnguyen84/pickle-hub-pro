# solution-architect — livestream-gate-hardening (2026-07-20)

> Scope chốt: intake §"Scope chốt". Signed playback (tầng 3) NGOÀI scope.
> Verified against source: `WatchLive.tsx`, `HomeLivePlayer.tsx`, `EmbedLive.tsx`,
> `MuxPlayer.tsx`, `useLivestreamGate.ts`, `useIntervalViewCounter.ts`,
> `useLivePresence.ts`, `useLiveViewerList.ts`, `useAuth.tsx`, `journeys.ts`, `ga.ts`.

## Tóm tắt kiến trúc

Ba bug UI (dual-ref pause nhầm, pause một-lần, reload-reset) đều là triệu chứng của
**gate sống ở consumer chứ không ở player**: mỗi trang tự giữ `playerRef` + effect
pause `[isGated]` một-shot (`WatchLive.tsx:76-80`, `HomeLivePlayer.tsx:55-57`), nên
share-ref sai (`WatchLive.tsx:254` + `:303` cùng một ref) và resume qua fullscreen/PiP
lọt lưới. Lời giải gốc: đẩy trạng thái gated **vào `MuxPlayer`** — mỗi instance tự
pause chính nó và re-pause trên mọi `onPlay`, một guard che cả 3 call-site lẫn ca
resume-bằng-nút-native. Đo đạc (`useIntervalViewCounter` chỉ đếm khi `active`, presence
thêm cờ `gated`) và conversion (`journeys.ts` kind mới, hoàn tất tại điểm `sign_up`
đã có sẵn `useAuth.tsx:56`) bám vào pattern có sẵn — **0 KB bundle mới, 0 migration,
không phải RED-tier** (không đụng auth/payments/`config.toml`).

## Bối cảnh RED/SSR/bundle (áp cho mọi option)

- **Không RED-tier.** Không sửa `supabase/config.toml`, không đụng auth flow (chỉ *đọc*
  điểm `sign_up` có sẵn), không payments. `batch-view-events` giữ nguyên `verify_jwt=false`
  (config.toml:21-22) — ta chỉ *ngừng gửi* event khi gated, không đổi payload schema.
- **SSR: không đổi.** Gate là hành vi client-runtime; prerender (`renderLive`) vẫn trả
  full HTML cho Googlebot — đúng ý đồ SEO (bot thấy nội dung, không thấy overlay).
  Không route public mới (`/embed/live/:id` và `/live/:id` đã tồn tại), hreflang không đổi.
- **Bundle: 0 KB mới.** Không thêm dependency. `journeys.ts`, `trackEvent`, `MuxPlayer`
  đều đã trong bundle. `EmbedLive` thêm import `useAuth`/`useSystemSettings`/`useLivestreamGate`/
  overlay — đều đã lazy trong route chunk của embed, không đụng INITIAL budget.

---

## Option A — Gate sống trong MuxPlayer (root-cause consolidation)  ⟵ khuyến nghị

Effort: **4.0 half-days** (3.0 code + 1.0 test) · Data: none (realtime payload only)
Files:
- `src/components/video/MuxPlayer.tsx` — thêm prop `gated?: boolean`; self-pause + re-pause
- `src/pages/WatchLive.tsx` — xóa effect pause (:76-80), truyền `gated={isGated}` cho cả 2 player, `active` cho view counter
- `src/components/home/HomeLivePlayer.tsx` — xóa effect pause (:55-57), truyền `gated`, `active`
- `src/pages/embed/EmbedLive.tsx` — wire `useAuth`+`useSystemSettings`+`useLivestreamGate`+overlay, `active`
- `src/hooks/useLivestreamGate.ts` — persist *elapsed watch-seconds* (chống reload-reset)
- `src/hooks/useIntervalViewCounter.ts` — thêm `active?: boolean` (default `true`)
- `src/components/video/LivestreamGateOverlay.tsx` — prop `openInNewTab?: boolean` cho embed
- `src/hooks/useLivePresence.ts` + `useLiveViewerList.ts` — thêm cờ `gated` vào track payload
- `src/lib/journeys.ts` — thêm `JourneyKind = "livestream_gate"`
- `src/hooks/useAuth.tsx:56` — `completeJourney("livestream_gate", ...)` cạnh `sign_up`
- `src/i18n/*` — copy embed-gate VI+EN (namespace `t.live.*`)
- tests: `useLivestreamGate.test.ts`, `LivestreamGateOverlay.test.tsx`, `useIntervalViewCounter.test.ts`

**How it works**

1. *Dual-ref + one-shot + native-resume, một chỗ.* `MuxPlayer` nhận `gated`. Trong
   `handlePlay` (`MuxPlayer.tsx:204`): nếu `gatedRef.current` → gọi `playerRef.current.pause()`
   và `return` ngay (không set playing). Thêm `useEffect([gated])` pause khi cờ bật. Vì mỗi
   instance tự pause **chính nó**, share-ref (`WatchLive.tsx:254/:303`) không còn liên quan —
   xóa luôn effect pause + không cần `playerRef` cho mục đích gate. Resume qua fullscreen/PiP/
   media-key phát ra `onPlay` → bị re-pause tức thì. Che cả 3 call-site + native-resume bằng
   1 guard (đúng "fix once where all callers route through").
2. *Reload-reset.* `useLivestreamGate` hiện chỉ `markPreviewSeen` lúc hết giờ (`:77`). Đổi:
   mỗi tick ghi `pkl_preview_elapsed_<id>` = số giây đã xem; lúc mount seed
   `secondsRemaining = previewSeconds - elapsed`. Giữ nguyên semantic "chỉ đếm khi playing"
   (khác wall-clock timestamp — không phạt người mở tab rồi pause), nhưng reload giây 14 ⇒
   còn 1s, không reset. `hasSeenPreview` vẫn là chốt cuối khi elapsed ≥ preview.
3. *View counter.* `useIntervalViewCounter` thêm `active?: boolean` default `true`. Tick chỉ
   push event khi `active` (`:53-57`). Livestream call-site truyền `active={isPlaying && !isGated}`.
   Video (`WatchVideo`/`EmbedVideo`) không truyền ⇒ default `true` ⇒ **video 0 thay đổi hành vi**
   (quyết định "livestream-only" mà không đóng cửa áp cho video sau — chỉ cần truyền prop).
4. *Embed gate.* `EmbedLive` copy đúng khối gate của WatchLive nhưng overlay dùng
   `openInNewTab` ⇒ link `target="_blank" rel="noopener"` tới `/login` (iframe không điều hướng
   được — Cuong chọn mở tab mới). Redirect-after-login vô nghĩa trong iframe nên bỏ `?redirect`,
   trỏ thẳng `/login?tab=signup`.
5. *Presence gated.* `useLivePresence(id, enabled, gated?)`: khi `gated` đổi, gọi lại
   `entry.channel.track({...gated})`. `useLiveViewerList` đọc `presence.gated` → cột "Đang xem /
   Kẹt cổng" cho admin. `countViewers` (public count) **giữ nguyên** — không đổi số công khai
   trong đợt này (product call), chỉ thêm dữ liệu chẩn đoán.
6. *Conversion (metric = signup).* CTA click trong overlay → `startJourney("livestream_gate")`
   (mint journey_id vào sessionStorage, sống qua điều hướng /login) + `trackJourneyStep` với
   `action: "login"|"signup"`. journey_id sống sót tới lúc account tạo xong; tại `useAuth.tsx:56`
   (điểm `sign_up` **đã tồn tại**) thêm `completeJourney("livestream_gate", "livestream_gate_signup", { method })`
   — no-op nếu không có journey active. Đây là attribution *thật*: gate → signup, không chỉ click.

**Wins** · Một guard sửa 3 bug + ca native-resume; embed/home/watch hành vi đồng nhất mãi mãi;
đo được đúng metric Cuong cần (signup, không phải click); 0 KB, 0 migration, không RED.
**Loses** · Đụng `useLivePresence` (đã hardened, prior channel-collision bug) — re-`track()`
là API an toàn nhưng cần test; nhiều file hơn B.
**Forecloses** · Gần như không — MuxPlayer-owns-gate là nền cho tầng 3 (signed playback chỉ
cần đổi cách lấy playbackId, không đụng lớp gate này).

## Option B — Fix tại chỗ, bỏ chẩn đoán (the cheap one)

Effort: **2.0 half-days** (1.5 code + 0.5 test) · Data: none
Files: `WatchLive.tsx`, `HomeLivePlayer.tsx`, `EmbedLive.tsx`, `useLivestreamGate.ts`,
`useIntervalViewCounter.ts`, `LivestreamGateOverlay.tsx`, `i18n`.

**How it works** · Không đụng `MuxPlayer`. Trong `WatchLive` cho mobile/desktop **hai ref
riêng** (`mobileRef`/`desktopRef`), effect pause cả hai; đổi deps sang re-pause bằng cách
theo `isVideoPlaying` (`[isGated, isVideoPlaying]`) để bắt lại resume. Persist-elapsed +
`active` param + embed gate + overlay `openInNewTab` giống A. Conversion = **một-off**
`trackEvent("livestream_gate_cta_click", { action })` ngay trong overlay. **Bỏ** presence-gated,
**bỏ** journeys attribution.

**Wins** · Nhỏ, nhanh, không đụng presence đã hardened. **Loses** · Re-pause phụ thuộc effect
deps ở *mỗi* caller — dễ tái phát khi thêm call-site thứ 4 (native-resume vẫn có thể lọt nếu
player không phát `onPause` giữa hai `onPlay`); đo được click-intent nhưng **không đo được
signup** — chính là metric thành công. **Forecloses** · Không; A vẫn làm chồng lên được sau.

## Option C — MuxPlayer-owns-gate + đo đạc tối giản (middle)

Effort: **2.5 half-days** · Data: none
Files: như A **trừ** `useLivePresence.ts`/`useLiveViewerList.ts` (bỏ presence-gated) và
`journeys.ts`/`useAuth.tsx` (conversion = click trackEvent như B).

**How it works** · Lấy phần UI robust của A (gate trong `MuxPlayer`, persist-elapsed, embed,
`active` counter) nhưng đo đạc chỉ tới mức click-intent; hoãn presence-gated + signup-attribution.

**Wins** · Sửa gốc 3 bug + native-resume (như A) với chi phí gần B; không đụng presence.
**Loses** · Vẫn chưa đo signup — phải quay lại wire `journeys.ts` sau. **Forecloses** · Không.

---

## Khuyến nghị

**Option A.** Lý do B thua: metric thành công Cuong chốt là **signup**, mà B chỉ đo được
*click* trên overlay — không trả lời được "gate có đẻ ra tài khoản không", tức là build cái
phễu mà không đo được đáy phễu. Điểm hoàn tất signup **đã có sẵn** ở `useAuth.tsx:56`, thêm
một dòng `completeJourney` là xong attribution thật — bỏ qua nó là tiết kiệm nhầm chỗ. Lý do
B còn thua về độ bền: re-pause nằm ở effect-deps của *từng* caller sẽ mục dần đúng kiểu bug
đang sửa; A khóa nó trong `MuxPlayer.handlePlay` một lần.

C là phương án lùi hợp lý **nếu** Cuong muốn khóa cổng robust trong một tối và để attribution
sang đợt sau — nhưng vì phần journey chỉ tốn ~0.5 half-day và bám điểm sign_up có sẵn, làm
luôn (A) rẻ hơn là quay lại lần hai. Chỉ chọn C khi presence-gated bị coi là rủi ro không đáng
lúc này (xem "Điều em không chắc").

## Increments

1. **MuxPlayer `gated` + xóa effect pause ở WatchLive/HomeLivePlayer** — verify: prod viewport
   390×844, hết preview ⇒ mobile player `paused: true`, currentTime dừng; thử fullscreen resume ⇒
   bị pause lại trong <1s. (Đóng dual-ref + one-shot + native-resume.)
2. **`useLivestreamGate` persist-elapsed** — verify: play tới giây 14, reload ⇒ overlay hiện
   ~1s sau (không được 15s mới). Unit test cho hàm elapsed.
3. **`active` param + gate view counter** — verify: mở /live gated không play trong 90s ⇒ 0 row
   `view_events`; video (`WatchVideo`) vẫn đếm như cũ (regression check).
4. **Embed gate + overlay new-tab** — verify: nhúng iframe test, hết 15s ⇒ overlay, bấm login ⇒
   mở tab mới `/login`. Component test overlay `openInNewTab`.
5. **Conversion: journeys.ts kind + completeJourney tại sign_up** — verify: GA4 DebugView thấy
   `livestream_gate` step (click) rồi `livestream_gate_signup` với cùng `journey_id` sau khi tạo
   account từ overlay. **Stop-and-look tự nhiên ở đây** — nếu Cuong muốn cắt scope, dừng sau #5.
6. **(defer-able) Presence gated field** — verify: admin viewer list phân biệt "đang xem" vs
   "kẹt cổng"; đặt CUỐI vì đụng `useLivePresence` đã hardened, tách PR riêng để rollback dễ.

## Điều em không chắc

- **Re-`track()` trên channel refcount dùng chung.** `useLivePresence` share 1 channel/1 presence
  key cho mọi consumer cùng stream (`useLivePresence.ts:69-77`). Nếu hai component cùng trang có
  `gated` khác nhau, `track()` sau ghi đè trước (last-write-wins trên một key). Trên /live thực tế
  chỉ một consumer track cho stream đó, nhưng chưa verify runtime ca home-hero + watch cùng lúc.
  Đây là lý do increment 6 tách PR + đặt cuối. Nếu rủi ro > giá trị (admin-only nicety) → cắt, chọn
  C thực dụng.
- **Semantic preview: watch-seconds vs wall-clock.** Em chọn persist *watch-seconds* để giữ đúng
  hành vi hiện tại (chỉ đếm khi playing). Nếu Cuong muốn "15s là 15s đồng hồ kể từ lần play đầu"
  (chặt hơn, chống mở nhiều tab), đó là timestamp-based — đổi 3 dòng nhưng là product decision, chưa
  hỏi.
- **`sign_up` age heuristic.** `useAuth.tsx:52` chỉ fire `sign_up` khi account < 120s tuổi.
  `completeJourney` bám cùng nhánh nên thừa hưởng đúng ràng buộc đó — email-verify chậm >2 phút
  sẽ miss cả `sign_up` lẫn attribution. Đây là hạn chế có sẵn của instrument, không phải do đợt này,
  nhưng nêu để không tưởng attribution là 100%.
- **Chưa mở** `docs/north-star-journeys.md` để xác nhận contract cho phép thêm kind
  `livestream_gate` (event names/props allow-list). Trước khi code increment 5 phải đọc file đó —
  `journeys.ts:2` nói contract là nguồn chân lý, thêm kind có thể cần cập nhật doc kèm PR.

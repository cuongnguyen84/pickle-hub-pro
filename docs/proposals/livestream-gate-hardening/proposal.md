# Vá gate "đăng nhập để xem livestream" + đo đạc thật

> Slug: `livestream-gate-hardening` · Ngày: `2026-07-20` · Trạng thái: `approved`
> **Quyết định của Cuong (2026-07-20):** duyệt theo đề xuất orchestrator mục 0 —
> D2 = tách key preview theo bề mặt (`_home_`/`_watch_`) + vẫn log `secondsWatchedBeforeGate`;
> D3 = duyệt điều kiện panel (presence-gated PR riêng cuối, cấm vào subscribe deps, merge-gate = runtime re-track test, không sạch thì cắt);
> D5 = exit fullscreen/PiP trước khi hiện overlay; D6 = always-exit (không phân nhánh wrapper).
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`. Model ngoài chính xác: xem `external/*.meta.json`.
> Model thiếu key trong lần chạy này: `none`
>
> **Raw audit trail** (đọc để kiểm tra bản tổng hợp này có trung thực không):
> `round1/*.md` — output độc lập vòng 1 · `round2/*.json` — đối chất
> `external/*.md` — prompt gửi đi + reply GPT-5.6 (+ `.meta.json` pin model ID) · `debate.json` — ledger

---

## 0. 🔶 Cần anh quyết

4 bất đồng còn mở sau vòng đối chất, nhưng chúng KHÔNG ngang nhau. D2 là quyết định product thật. D3 panel đã hội tụ về cùng điều kiện — anh chỉ cần duyệt. D5+D6 thực chất là một câu hỏi (chiến lược fullscreen).

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| D2 | Ngân sách preview 15s: chung mọi bề mặt hay tách homepage/watch? | `pre-mortem` (+`solution-architect` đã đảo theo ở vòng 2): **tách key theo bề mặt** — hero đốt preview thì trang xem vẫn còn 15s; đánh đổi: user lì được tối đa 2×15s | `risk-auditor`: nếu giữ chung thì **bắt buộc** ship kèm log `secondsWatchedBeforeGate` để pathology gate-giây-0 quan sát được | Chọn chung mà không đo → đêm live user từ trang chủ bấm vào bị chặn giây-0, phễu signup sập vô hình (pre-mortem sự cố 3, P1) |
| D3 | Presence-gated (admin phân biệt "Đang xem" vs "Chờ đăng nhập") có ship đợt này? | Cả 4 agent hội tụ: ship ở **PR riêng, cuối cùng**, với 3 điều kiện cứng: (1) re-track qua effect riêng gọi `channel.track()`, (2) TUYỆT ĐỐI không đưa `gated` vào subscribe deps (tái diễn collision 2026-07-08), (3) merge-gate = runtime test khẳng định `track()` được gọi LẠI khi `isGated→true` | — (không còn phía đối) | Ship thiếu test → no-op giả: field `gated` chết cứng `false`, bug thật bị đóng dưới vỏ "đã fix" (pre-mortem sự cố 2, P0/P1) |
| D5 | Re-pause câm có đủ không? | `ui-ux-critic` (Blocker, GPT-5.6 đồng thuận độc lập): **phải thoát native fullscreen/PiP trước khi hiện overlay** — không thì user kẹt màn đen tự dừng không lý do | `solution-architect` vòng 2 đã REFINE theo (thêm `exitFullscreen()`/`exitPip()` vào `MuxPlayerHandle`) — còn lại chỉ là D6 | Bỏ qua → gate hoạt động nhưng cảm giác "app hỏng" trên iOS fullscreen, đúng 95% audience mobile |
| D6 | Chiến lược fullscreen: luôn exit-rồi-overlay, hay phân nhánh giữ wrapper-fullscreen? | `solution-architect`: **always-exit** — ít code, robust cho solo-maintainer | `ui-ux-critic`: phân nhánh — wrapper-fullscreen thì overlay ngay trong wrapper (đỡ giật), chỉ native fullscreen mới exit | Always-exit hơi cộc (thoát fullscreen cả khi không cần) nhưng không hỏng; phân nhánh mượt hơn nhưng thêm 1 nhánh detect phải test trên nhiều device |

**Đề xuất của orchestrator để anh duyệt nhanh:** D2 = tách key (2 phía đã hội tụ, chỉ auditor giữ phương án dự phòng — và vẫn nên log `secondsWatchedBeforeGate` dù tách, rẻ); D3 = duyệt điều kiện panel; D5 = làm theo critic (architect đã theo); D6 = always-exit (ponytail: nhánh detect thêm khi có phàn nàn thật).

---

## 1. Ý tưởng gốc

"Vá gate 'yêu cầu đăng nhập để xem livestream' đang bị thủng — điều tra đã xong (Claude + Codex đồng thuận), cần proposal cho fix 3 tầng: (1) Tầng UI: dual-ref pause nhầm player, pause 1 lần, reload-reset 15s, /embed/live/:id không gate. (2) Tầng đo đạc: view counter đếm cả khi gated, presence tính người kẹt gate là đang xem. (3) Tầng triệt để: Mux playback public — cân nhắc signed playback."

**Làm rõ ở bước 0:**

| Hỏi | Trả lời |
|---|---|
| Ai dùng | Khán giả xem live (95% VI, mobile) + admin đọc viewer list |
| Đau ở đâu | Người ẩn danh xem quá 15s bằng nhiều đường; số view/presence thổi phồng |
| Thành công = | **Tăng đăng ký tài khoản** (gate là phễu chuyển đổi) |
| Ràng buộc | Tầng 3 (signed playback) TÁCH proposal riêng; không sửa native /apple đợt này |

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🟡 AMBER |
| **Khuyến nghị** | Option A (gate sống trong MuxPlayer) + 5 refinement vòng 2 |
| **Công sức** | 5 nửa ngày (4 code+test ban đầu + 1 cho các blocker UX vòng 2) |
| **Rủi ro lớn nhất** | Đụng nhầm hook dùng chung: view counter (video thường ngừng đếm) hoặc presence (tái diễn channel-collision 2026-07-08) |
| **Auto-merge** | Được sau khi qua gate (AMBER) — riêng PR presence-gated có merge-gate test bắt buộc |

Điểm đáng chú ý cho phần điều tra gốc: panel phát hiện thêm **một bug đang sống ngoài scope điều tra** — nút "Tạo tài khoản" trên overlay gate hiện tại trỏ `&tab=signup` nhưng `Login.tsx:32` đọc `?mode=signup` → CTA đăng ký (đúng cái nút gánh metric) đang mở nhầm tab Đăng nhập ngay hôm nay.

---

## 3. Đã có sẵn gì (recon)

Đầy đủ: `round1/idea-recon.md`. Không có gì trong scope đã được làm sẵn — gate/overlay/counter/presence đều tồn tại nhưng đều mang đúng các lỗi đã điều tra.

**Prior art:** `useLivestreamGate.ts` (countdown + localStorage), `LivestreamGateOverlay.tsx` (CTA, chưa tracking), `journeys.ts` (pattern conversion-tracking có sẵn, dùng cho 3 journey khác), `useLivePresence.ts` (đã hardened sau prod bug 2026-07-08 — lý do phải đụng cẩn thận).

**Sẽ đụng vào:** `WatchLive.tsx`, `HomeLivePlayer.tsx`, `EmbedLive.tsx`, `MuxPlayer.tsx`, `useLivestreamGate.ts`, `useIntervalViewCounter.ts` (⚠️ dùng chung với `WatchVideo`/`EmbedVideo`), `useLivePresence.ts` + `useLiveViewerList.ts` (PR riêng), `LivestreamGateOverlay.tsx`, `PreviewCountdown.tsx`, `journeys.ts`, `useAuth.tsx` (1 dòng completeJourney), `i18n`.

**Ràng buộc đã ghi trong repo:** không đổi `verify_jwt` của `batch-view-events`; không sửa `.legacy.tsx`; presence channel-collision lesson 2026-07-08; native `/apple` **hoàn toàn không có gate** (ghi nhận — proposal riêng cùng đợt signed playback). Test coverage hiện tại cho toàn cụm: **zero**; visual baseline chỉ phủ `/live` hub.

---

## 4. Phương án (solution-architect)

Đầy đủ 3 option: `round1/solution-architect.md`. Tóm tắt:

### Option A — Gate sống trong MuxPlayer (root-cause) ⟵ khuyến nghị

Effort: 4 nửa ngày (trước refinement) · Data: none (0 migration, 0 KB bundle mới, không RED-tier)

MuxPlayer nhận prop `gated` — mỗi instance tự pause chính nó trong `handlePlay` khi gated. Một guard che cả 3 call-site (WatchLive ×2, HomeLivePlayer, EmbedLive) lẫn mọi ca resume (fullscreen/PiP/phím media) → dual-ref, pause-một-lần, share-ref hết liên quan, xoá được 2 effect pause cũ. Persist *watch-seconds đã xem* (không phải wall-clock) chống reload-reset. `useIntervalViewCounter` thêm param `active`. Embed wire đúng khối gate của WatchLive (kể cả nhánh `applies_to`) với CTA mở tab mới. Conversion đo bằng `journeys.ts` kind mới `livestream_gate`, hoàn tất tại điểm `sign_up` có sẵn (`useAuth.tsx:56`) → attribution **signup thật**, không chỉ click.

### Option B — Fix tại chỗ (2 nửa ngày)

Hai ref riêng + effect re-pause theo deps ở từng caller; tracking = trackEvent click một-off; bỏ presence, bỏ journey. **Thua vì:** không đo được signup (đúng metric anh chốt), và re-pause nằm ở effect-deps từng caller sẽ mục dần đúng kiểu bug đang sửa.

### Option C — A nhưng đo tối giản (2.5 nửa ngày)

UI robust của A, tracking chỉ click, bỏ presence. Là đường lùi nếu anh cắt D3 — nhưng phần journey chỉ tốn ~0.5 nửa ngày trên điểm sign_up có sẵn, làm luôn rẻ hơn quay lại lần hai.

### Khuyến nghị

**A + refinement vòng 2**, cụ thể các thay đổi so với bản vòng 1 của A:

1. `active` là param **required** (không default) — TS đỏ ở cả 5 caller buộc khai báo tường minh (D1 resolved).
2. **Tách key preview theo bề mặt** `_home_`/`_watch_` (D2 — chờ anh duyệt) + log `secondsWatchedBeforeGate`.
3. CTA embed và overlay: `mode=signup` (KHÔNG phải `tab=`), embed có `redirect=/live/:id&source=embed_live_gate`, `target="_blank"` (D4 resolved).
4. `MuxPlayerHandle` thêm `exitFullscreen()`/`exitPip()`, thoát trước khi hiện overlay (D5/D6 — chờ anh chốt chiến lược).
5. Presence-gated tách PR riêng cuối cùng, merge-gate = runtime re-track test, không đạt thì cắt (D3).

### Increments

1. MuxPlayer `gated` + exit fullscreen/PiP + xoá effect pause cũ — verify: viewport 390×844 prod-preview, hết preview ⇒ player mobile `paused:true`; resume fullscreen ⇒ bị chặn kèm overlay hiện.
2. `useLivestreamGate` persist-elapsed + tách key surface — verify: play tới giây 14, reload ⇒ overlay sau ~1s; xem 15s ở hero ⇒ /live/:id vẫn còn preview (nếu D2 = tách).
3. `active` required + guard view counter — verify: trang gated không play 90s ⇒ 0 row `view_events`; **`WatchVideo` vẫn đếm** (test regression bắt buộc).
4. Overlay: sửa `mode=signup`, đảo CTA hierarchy, countdown badge chữ, a11y dialog, bỏ backdrop-blur — verify: component test + axe.
5. Embed gate (đúng nhánh `applies_to`) — verify: iframe test, replay qua embed với `applies_to=live` KHÔNG bị khoá.
6. Journeys `livestream_gate` + completeJourney tại sign_up — verify: GA4 DebugView thấy chuỗi gate→signup cùng `journey_id`. *(Điểm dừng tự nhiên nếu cắt scope.)*
7. **(PR riêng, cuối)** Presence-gated + admin badge — merge-gate: test re-track. Không sạch → cắt, không ảnh hưởng 1-6.

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

Đầy đủ 11 vấn đề + copy VI/EN sẵn dán: `round1/ui-ux-critic.md`. Các blocker:

| # | Mức | Vấn đề | Sửa |
|---|-----|--------|-----|
| 1 | Blocker | Nút "Tạo tài khoản" trỏ `&tab=signup` — dead param, `Login.tsx:32` đọc `mode` → mở nhầm tab Đăng nhập (**bug đang sống trên prod**) | `&mode=signup` + test khẳng định link |
| 2 | Blocker | CTA hierarchy ngược metric: solid = Đăng nhập, outline = Tạo tài khoản | Đảo: primary full-width "Tạo tài khoản miễn phí", login hạ xuống link chữ (Claude+GPT-5.6 đồng thuận độc lập) |
| 3 | Blocker | Re-pause câm trong native fullscreen/PiP = màn đen không lý do | Exit fullscreen/PiP rồi hiện overlay (D5/D6) |
| 4 | Blocker | Embed không thể tự mở khoá iframe sau login (storage partitioning) | CTA first-party mở tab mới, iframe ở lại gated; copy nói rõ "xem tiếp trên ThePickleHub" |

Nên sửa cùng đợt (rẻ, cùng file): countdown hiện là thanh 1px không số (`secondsRemaining` là prop chết) → badge chữ "Xem thử miễn phí · Còn {n} giây"; a11y overlay (`role="dialog"`, focus trap, `aria-live`); bỏ `backdrop-blur` (GPU Android tầm trung) → `bg-black/[0.92]`; copy VI/EN mới đã soạn sẵn trong file round1 §Copy.

**Panel đa model:** GPT-5.6 và Claude đồng thuận độc lập 6 điểm (CTA hierarchy, exit-fullscreen, embed first-party, countdown badge, tách đang-xem/kẹt-gate, tracking ngay đợt này) — tín hiệu mạnh vì hai vendor khác nhau. GPT không thấy repo nên miss #1 (`tab` vs `mode`) — bug chỉ lộ khi đọc code thật. Critic CONCEDE GPT đúng 1 điểm: đích embed phải qua `/login` trước để tránh double-gate.

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🟡 AMBER

Classifier đường dẫn nói: `AMBER` (user-facing route) · Auditor giữ nguyên — toàn bộ client React/TS, revert = git revert + redeploy (~3-5 phút), không migration/native/worker/push.

Top rủi ro (đầy đủ 10 dòng: `round1/risk-auditor.md`; 3 postmortem chi tiết: `round1/pre-mortem.md`):

| # | Mức | Cơ chế hỏng | User thấy gì | Giảm thiểu |
|---|-----|-------------|--------------|------------|
| 1 | Cao | Hook view counter dùng chung — sửa sai làm video thường ngừng đếm **im lặng** (pre-mortem P0: mất 3 tuần data không lấy lại được) | Không ai — đó chính là vấn đề | Param required + test "video vẫn đếm" trong cùng PR (D1 resolved) |
| 2 | Cao | `gated` lọt vào subscribe deps của `useLivePresence` → tái diễn channel-collision 2026-07-08 | Số "đang xem" kẹt ở 1 đúng tối thứ 7 | Re-track qua effect riêng; cấm vào deps; PR riêng + merge-gate test (D3) |
| 3 | Cao/TB | Gate theo `!!user` chưa chờ `useAuth().loading` → user ĐÃ đăng nhập bị pause live trong cửa sổ session-restore chậm | Live tự dừng + chớp overlay login đêm live | `isAuthenticated: !loading && !!user`; chỉ pause theo `isGated` đã latch |
| 4 | TB | Persist wall-clock thay vì watch-seconds → phạt người pause/rời tab | Xem 2s, quay lại sau 1 phút bị gate ngay | Persist elapsed watched-seconds, clamp NaN/clock-lùi, try/catch private mode |
| 5 | TB | View giảm đột ngột sau deploy (đo thật thay vì đo mở-trang) | Cuong tưởng mất traffic | Ghi baseline trước deploy + annotate mốc trong GA |

### SLO bị đe doạ
Không SLO chính thức nào bị đụng trực tiếp (không migration, không auth surface, không cron/push). Rủi ro tập trung ở **độ tin cậy số liệu** và trải nghiệm đêm live (traffic đỉnh).

### Perf
- Bundle: +<5 KB gz vào chunk embed (import gate vào EmbedLive) — trong headroom, verify `check-bundle-size.mjs`.
- Vietnam p75: ~0 (client-only, không request đồng bộ mới); bỏ backdrop-blur còn *giảm* tải GPU lúc overlay hiện.

### SEO
- Route SSR bị đụng: **không** — gate 100% client-side, `renderLive` không tham chiếu auth (đã grep).
- Bump `pr:v30`? **Không** — SSR output không đổi.
- Verify: `curl -A "Googlebot" https://www.thepicklehub.net/live/<id>` → 200 + title + og:image + hreflang như hiện tại.

### Rollback
- Cơ chế: git revert + Cloudflare Pages redeploy, ~3-5 phút. Presence-gated là PR riêng → revert độc lập.
- **Không revert được:** none (lý do AMBER không phải RED). Lưu ý nhỏ: localStorage key preview đã ghi trên máy user không xoá được bằng revert — vô hại, dùng key mới là thoát.

### Phản biện độc lập (GPT-5.6 — vendor khác, không thấy repo)
- Đã xác minh trong repo: shared-hook zero-count, authResolved race, presence-deps collision class, wall-clock vs watched-time, `applies_to` trên replay qua embed, Safari ITP partition, view step-change cần annotate.
- Bác bỏ: "homepage hero dùng EmbedLive" — sai, hero dùng `HomeLivePlayer`; một mô tả hướng-lọc version-skew ngược (mitigation vẫn đúng, cơ chế đã sửa lại).

---

## 7. Tranh luận trong panel

> Vòng 1 độc lập → vòng 2 đối chất (một vòng). **Đồng thuận không phải mục tiêu.**
> Luật: chỉ đổi lập trường khi trích được file/dòng chưa thấy ở vòng 1.
> Cưỡng chế bởi `debate-ledger.mjs` — chạy `--strict` PASS, 0 vi phạm.

## Bảng bất đồng — livestream-gate-hardening

| # | Chủ đề | Các phía | Vòng 2 | Trạng thái | Kết luận |
|---|--------|----------|--------|------------|----------|
| D1 | Chữ ký param mới của useIntervalViewCounter: optional default-true hay required | **solution-architect**: Thêm `active?: boolean` default `true` — video callers không đổi = 0 thay đổi hành vi, không đụng file ngoài s<br>**risk-auditor**: Giữ default = hành vi hiện tại nếu không truyền cờ, nhưng cập nhật + test cả 5 caller trong cùng PR.<br>**pre-mortem**: Param phải REQUIRED (không default) — TS đỏ ở mọi caller buộc quyết định tường minh; optional-default là đúng | **solution-architect**: REFINE<br>**risk-auditor**: REFINE<br>**pre-mortem**: CONCEDE (`src/hooks/useIntervalViewCounter.ts:53-55 — tick hiện push e`) | ✅ RESOLVED_EVIDENCE | Kịch bản P0 mất-data-im-lặng chết bằng bằng chứng (hook hiện đếm vô điều kiện; default-true giữ nguyên hành vi video). Chữ ký chốt: REQUIRED param theo architect round-2 (thoả luôn merge-gate của auditor); bắt buộc kèm test 'video vẫn đếm' trong cùng PR. |
| D2 | Ngân sách preview 15s dùng chung giữa homepage hero và trang xem (localStorage key chỉ theo livestreamId) | **solution-architect**: Persist elapsed theo key `pkl_preview_elapsed_<id>` — một ngân sách chung cho mọi bề mặt<br>**pre-mortem**: Key chung + gate homepage arm thật = user đốt 15s ở ô nhỏ trang chủ rồi vào /live/:id bị chặn giây-0 đêm live<br>**risk-auditor**: Trung lập: chấp nhận có chủ đích HOẶC tách namespace — nhưng phải ghi rõ quyết định vào proposal. | **solution-architect**: REFINE<br>**pre-mortem**: HOLD<br>**risk-auditor**: REFINE | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |
| D3 | Presence-gated có ship trong đợt này không, và làm sao để nó không thành no-op giả | **solution-architect**: Ship, defer PR cuối; re-track qua channel.track(); cắt nếu rủi ro > giá trị<br>**ui-ux-critic**: Cần cho admin — giữ trong scope, mức hẹp: 1 field + 1 badge.<br>**pre-mortem**: Rủi ro cao nhất là fake-fix: track() chỉ chạy 1 lần lúc SUBSCRIBED | **solution-architect**: REFINE<br>**ui-ux-critic**: REFINE<br>**risk-auditor**: HOLD<br>**pre-mortem**: HOLD | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |
| D4 | CTA của embed gate: có redirect về /live/:id sau auth không + tên param signup | **solution-architect**: Bỏ ?redirect (vô nghĩa trong iframe), trỏ thẳng /login?tab=signup.<br>**ui-ux-critic**: Redirect KHÔNG vô nghĩa: tab mới là top-level — phải là /login?mode=signup&redirect=/live/:id&source=embed_live_gate | **solution-architect**: CONCEDE (`src/pages/Login.tsx:32 — searchParams.get("mode") !== "signu`)<br>**ui-ux-critic**: HOLD | ✅ RESOLVED_EVIDENCE | CTA embed = /login?mode=signup&redirect=/live/:id&source=embed_live_gate (target=_blank). Đồng thời sửa luôn bug đang sống: nút 'Tạo tài khoản' của overlay hiện tại trỏ &tab=signup — dead param, mở nhầm tab Đăng nhập. |
| D5 | Re-pause khi gated: tự pause trong MuxPlayer là đủ, hay bắt buộc thoát native fullscreen/PiP trước khi hiện overlay | **solution-architect**: self re-pause trên mọi onPlay — đủ.<br>**ui-ux-critic**: Blocker: re-pause câm = màn đen không lý do; handle phải thêm exitFullscreen()/exitPip() | **solution-architect**: REFINE<br>**ui-ux-critic**: HOLD | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |
| D6 | Chiến lược thoát fullscreen (mới, phát sinh vòng 2) | **solution-architect**: Always-exit-then-overlay — ít code, robust.<br>**ui-ux-critic**: Phân nhánh wrapper-fullscreen giữ nguyên + overlay trong wrapper; chỉ native fullscreen mới exit | — | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |

### Bất đồng bị giết ở vòng 2 (ảo — do thiếu thông tin)

- **D1**: pre-mortem CONCEDE khi thấy đề xuất thật là default `true` (kịch bản P0 của nó giả định default `false`) — evidence `useIntervalViewCounter.ts:53-55`. Architect đồng thời tự nâng lên required. Kết quả cuối mạnh hơn cả hai lập trường vòng 1.
- **D4**: architect CONCEDE với 2 dữ kiện tự mở verify (`Login.tsx:32` đọc `mode` không phải `tab`; `Login.tsx:51,62-64` redirect có tác dụng trong tab top-level). Bonus: lộ ra bug `tab=signup` đang sống trên prod.

### Bất đồng sống sót (thật — cùng dữ kiện, khác đánh giá)

D2 (mức độ nghiêm trọng của shared preview budget với phễu signup), D5/D6 (mức đầu tư cho UX fullscreen). Đã lên mục 0. Lưu ý trung thực từ orchestrator: ở D2, architect đảo sang tách-key vì *cân lại theo success-metric* chứ không vì file mới — ledger không tính đó là bằng chứng, nên bất đồng vẫn ghi OPEN dù các phía đã gần nhau.

### Nhượng bộ bị LOẠI

Không có — ledger `--strict` pass 0 vi phạm. Cả 2 CONCEDE đều kèm file:line tự verify.

**Về trọng lượng đồng thuận:** risk-auditor và pre-mortem (cùng là Claude, cùng phe tìm-cái-hỏng) đồng ý nhau ở nhiều điểm — điều đó KHÔNG tự nó là xác nhận. Đồng thuận có nghĩa trong panel này là các điểm GPT-5.6 (vendor khác) hội tụ độc lập: CTA hierarchy, exit-fullscreen, embed first-party, shared-hook risk, presence-deps risk, authResolved race.

---

## 8. Kế hoạch verify

**Tự động:**

- [ ] `npx eslint <changed>` + `node scripts/check-theline.mjs <changed tsx>`
- [ ] `npx tsc -b --noEmit` (phải ĐỎ ở 5 caller trước khi sửa xong — bằng chứng required param hoạt động)
- [ ] `npm run test` — test mới: gate elapsed, overlay link `mode=signup`, **video-vẫn-đếm**, re-track presence (PR 7)
- [ ] `npm run build` + `check-bundle-size.mjs` (chunk embed)
- [ ] `npm run e2e:smoke` trên preview
- [ ] Googlebot curl `/live/<id>` → 200 + meta không đổi (SSR không đụng)
- [ ] Post-deploy smoke: `/`, `/feed`, `/live`

**Cuong phải tự làm (agent không làm được):**

- [ ] iPhone thật (Safari + Zalo webview): play → 15s → overlay hiện, fullscreen resume bị chặn KÈM overlay/exit, user đã login KHÔNG bị pause (throttle mạng để ép session-restore chậm)
- [ ] Ghi baseline view count livestream + video **trước** deploy; annotate mốc deploy trong GA4 để bước tụt view không bị tưởng là mất traffic
- [ ] Sau 1 đêm live: soi GA4 chuỗi `livestream_gate` → `livestream_gate_signup` và phân bố `secondsWatchedBeforeGate` (phát hiện gate-giây-0)

---

## 9. Sau khi ship

- SHA: · PR: · Ngày:
- Khác kế hoạch:
- Học được (→ append `.claude/memory/lessons-learned.md`):

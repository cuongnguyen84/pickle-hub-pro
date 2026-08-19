# So sánh 2 cách tính số người xem live (Presence vs "3 bước: ô nóng — đếm người — ai rời đi")

> Slug: `live-viewer-count-comparison` · Ngày: `2026-08-06` · Trạng thái: `shipped` (Option A′ — PR #555 → main `4353d6fc`, 2026-08-06. Option B′ snapshot + Q2 native vẫn HOÃN sau STOP & LOOK, RED chưa duyệt)
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (⚠️ GPT-5.6 FAIL — Codex hết hạn mức tới 08/08 12:00, prompt đã lưu để chạy lại) · `risk-auditor` (+GPT-5.6 `gpt-5.6-sol` qua OpenAI API trực tiếp — thành công) · `pre-mortem`.
> ⚠️ `scripts/agents/debate-ledger.mjs` KHÔNG tồn tại — luật vòng 2 cưỡng chế THỦ CÔNG bởi orchestrator (chi tiết trong `debate.json` khoá `ledger_enforcement`). Cùng lý do, bảng mục 7 là bảng tay, không phải output script.
>
> **Raw audit trail:** `round1/*.md` · `round2/*.json` · `external/*.md` · `debate.json` · `00-intake.md`

---

## 0. 🔶 Cần anh quyết

Panel KHÔNG có bất đồng sống sót về câu hỏi chính — cả 4 agent Claude + GPT-5.6 (vendor khác, độc lập) cùng kết luận **giữ Cách A**. Còn đúng 2 quyết định thuộc về anh:

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| Q1 | Có ship **gói vá GREEN** (mục 4, Option A′) ngay không? Đây là bug thật trên prod: 3 bề mặt in **"0 đang xem" trên trận ĐANG PHÁT** | Cả panel: ship ngay, ~1 nửa ngày, 0 migration | — (không ai phản đối) | Mỗi ngày để nguyên là mất click thật trên card live |
| Q2 (N5, chỉ khi sau này làm snapshot) | Native đọc snapshot mà không tham gia đếm → viewer native **vô hình** trong con số | architect: chấp nhận, ngữ nghĩa "người xem trên web" (0,5 nửa ngày) | ui-ux-critic: phải là quyết định có ý thức; muốn đếm native phải cho native join Presence (2-3 nửa ngày) | Ship im lặng = con số sai có cấu trúc kiểu ngược dấu với bug hero vừa bị giết ở D1 |

---

## 1. Ý tưởng gốc

> em tìm hiểu cách tính số người xem live hiện tại và so sánh với cách tính sau. Chỉ cần tính đủ đúng và đủ nhanh. 3 bước: 1 - ô nóng, 2- đếm người, 3 - ai rời đi. Đưa ra đánh giá so sánh 2 cách tính. Cách nào thuận tiện hơn và ít tốn tài nguyên database hơn

Không hỏi thêm: tiêu chí đã rõ trong đề bài, hiện trạng đọc repo là ra (xem `00-intake.md`).

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🟢 GREEN (báo cáo này + gói vá A′) · 🔴 RED nếu thực thi Cách B hoặc snapshot (migration không revert được) |
| **Trả lời câu hỏi của anh** | **Cách A (hiện tại) thắng CẢ HAI vế, không sát nút** — chi tiết mục 4 |
| **Khuyến nghị** | Giữ Cách A + ship gói vá GREEN; snapshot lịch sử hoãn sau điểm ĐO-V-THẬT |
| **Công sức** | Gói GREEN ~1 nửa ngày; snapshot (nếu làm) +2 nửa ngày, RED |
| **Rủi ro lớn nhất** | Nếu làm Cách B thuần: tái diễn outage PGRST002 02/08 đúng đêm đông viewer (pre-mortem #1) |
| **Auto-merge** | Gói GREEN: được sau gate · Snapshot/Cách B: **Chặn — cần anh duyệt** |

### Phát hiện quan trọng nhất của cả phiên

**Cách A hiện tại ĐÃ LÀ "3 bước" của anh** — chỉ là nó chạy ở tầng Supabase Realtime (RAM), không phải Postgres:

| Bước anh đề xuất | Cách A đang làm ở đâu | Chi phí DB |
|---|---|---|
| 1. Ô nóng | Channel `livestream_presence:<id>` — state sống trong RAM node Realtime | 0 |
| 2. Đếm người | `countViewers()` — `useLivePresence.ts:41` | 0 |
| 3. Ai rời đi | Phoenix Presence tự xoá key khi socket đóng/timeout — app không viết dòng code nào | 0 |

Nên "Cách B" không phải cách tính mới — nó là **cùng thuật toán, chuyển từ RAM xuống Postgres**, và phải tự trả tiền cho thứ Realtime đang làm miễn phí.

## 3. Đã có sẵn gì (recon + vòng 2 sửa lại)

- **Consumer Presence sống duy nhất:** `src/pages/WatchLive.tsx:75`. Trang này đã mở WebSocket cho chat → viewer count cộng **0 connection**. (Recon vòng 1 nói 3 consumer — SAI: `LiveBroadcastHero.tsx` bị gỡ khỏi trang chủ từ #251, `LiveCardWithPresence.tsx` chỉ còn trong barrel không ai lấy. Cả ui-ux-critic lẫn risk-auditor tự kiểm chứng và CONCEDE ở vòng 2.)
- **Hệ thống dễ nhầm:** `view_events`/`view_counts` + `useIntervalViewCounter` + `batch-view-events` là **tổng lượt xem cộng dồn** (kiểu YouTube), không phải concurrent. Không tái dùng làm heartbeat được: `maxEventsPerSession=20` → sau ~10 phút client ngừng gửi (người xem lâu biến mất); dedup theo IP gộp CGNAT Viettel/VNPT.
- **Mux Data:** chưa tích hợp ở bất kỳ đâu (0 hit `mux-embed`/`env_key`) — muốn dùng metric concurrent của Mux là một dự án riêng, không phải công tắc.
- **Native (`apple/`):** chưa hiển thị viewer count nào; đã có poll REST 20s ở tab Live (`LiveView.swift:106-115`).
- Ràng buộc repo: compute Micro + tiền sử outage PGRST002 02/08 (22h-24h VN, không tự hồi, chỉ anh restart được); deploy-guard đỏ kinh niên; bài học GRANT-trước-RLS ×3 lần.

## 4. So sánh (solution-architect, đã hiệu chỉnh theo vòng 2)

### Bảng theo đúng 4 tiêu chí anh đặt

| Tiêu chí | Cách A — Presence (hiện tại) | Cách B — bảng ô nóng + heartbeat |
|---|---|---|
| **Đủ đúng** | Overcount tab ẩn; double-count tạm khi reconnect <50s. Con số hiện tại **trung thực** (không bị thổi — hero là dead code) | Overcount tab ẩn y hệt, CỘNG: undercount CGNAT (95% khán giả 4G VN sau NAT) hoặc mất khách anon; forge bằng vòng lặp `fetch` rẻ hơn nhiều so với mở N WebSocket; iOS đình chỉ `setInterval` khi khoá màn hình → người đang nghe bị đánh "đã rời" |
| **Đủ nhanh — vào** | Tức thì | 0-25s |
| **Đủ nhanh — rời đi** | Tức thì (điều hướng SPA/desktop); **25-50s** trên mobile (khoá màn hình/chuyển app — ca chi phối) | **60-85s** luôn luôn |
| **Thuận tiện** | **Đã chạy trên prod, có test.** 0 job, 0 bảng, 0 vacuum, 0 cron | +1 migration (RED) + RPC + edge function + pg_cron cleanup (vào roster SLO 5) + RLS/GRANT + chống forge bề mặt ghi anon + viết lại `useLiveViewerList` (admin mất danh sách "ai đang xem" — Cách B chỉ cho CON SỐ, không cho DANH SÁCH) |
| **Tài nguyên DB** | **0 write, 0 read, 0 WAL** cho đường đếm | 2,4V write/phút + 4V read/phút: V=500 → ~53 stmt/s (ổn); V=5.000 → ~533 stmt/s + 12k WAL record/phút trên Micro (căng, và WAL làm chậm chính Realtime chat) |

**Luận điểm đầu bảng (chốt ở vòng 2, thay cho "rời đi tức thì"):** đường đếm của Cách A **không chạm Postgres** — trong sự cố kiểu PGRST002 02/08 (REST 503, Auth 504), Cách A vẫn đếm đúng; mọi bộ đếm dựa DB sẽ hiện **0 đúng lúc site sập giữa stream**. Đây là lợi thế bất đối xứng GPT-5.6 và risk-auditor cùng xác nhận độc lập.

**Ngưỡng giao cắt:** Cách B chỉ bắt đầu thắng khi V ≈ 800-1.000 đồng thời/stream (trần payload `presence_state`; xoá `user_agent` không ai đọc khỏi payload là gấp đôi trần này). Nền tảng hiện ~2.000 user **đăng ký tổng**, nên đây là kịch bản xa. ⚠️ 2 số CHƯA đo được trong phiên: quota Realtime thật của project (phải mở dashboard Billing/Usage) và V đỉnh thật của prod.

### Chi phí DB duy nhất của Cách A hôm nay là một bug vá được

`useLiveViewerList.ts:119-140` (panel admin): mỗi `presence:sync` chạy 2 query không debounce → V=500 ≈ 100k dòng/phút kéo từ Micro khi admin mở panel. Vá bằng debounce 2s + cache ~15 dòng. **Cách B không xoá được chi phí này** (danh sách vẫn cần identity).

### Option A′ — gói vá GREEN, ship ngay (khuyến nghị, ~1 nửa ngày)

1. **Bỏ 3 chỗ `viewerCount={0}`** (`TournamentDetail.tsx:166`, `OrganizationDetail.tsx:236`, `WatchLive.tsx:564`) + gác ngưỡng ở `LiveCard.tsx:107` (`viewerCount >= 3` mới render — fix gốc, mọi caller được bảo vệ). Đây là lời nói dối duy nhất còn sống trên prod: badge **"0 đang xem" trên trận đang phát** = social proof đảo dấu, mất click thật.
2. Debounce + cache `enrichViewers` (`useLiveViewerList.ts:119-140`).
3. Bỏ `user_agent` khỏi payload `track()` (`useLivePresence.ts:105`) — 0 consumer, chiếm ~45% payload, xoá = gấp đôi trần V.
4. Sửa tooltip a11y (WCAG 2.1.1 — trigger `<div>` không focus trong `<Link>`) + `aria-label` "{count} người đang xem trực tiếp"; loại key `gated` khỏi số công khai (3 dòng).
5. Xoá 2 component chết (`LiveBroadcastHero.tsx`, `LiveCardWithPresence.tsx` + export barrel).

Quy tắc render đi kèm mọi phương án: **không bao giờ in `0` hay `—`**; n<3 → ẩn; mất kết nối → giữ số cuối làm mờ; đổi số ≤1 lần/10s; KHÔNG thêm `aria-live`.

### Option B′ — Presence + snapshot server-side (nếu cần lịch sử/peak + số cho trang list/native; RED, hoãn sau STOP & LOOK)

Hình dạng đã hội tụ ở vòng 2 (D2 + N3): bảng `live_viewer_snapshots (livestream_id, minute, count)`; **server-side observer** (edge function cron 60s, join presence bằng key `admin_watcher_*` — được `countViewers()` lọc sẵn nên tự loại khỏi số đếm) — KHÔNG client leader election, KHÔNG bảng heartbeat, viewer không bao giờ ghi DB. **1 INSERT/phút/stream, độc lập với V.** Mua được cả 2 thứ Cách B thắng thật (lịch sử + đường native 0,5 nửa ngày) với ~1/1000 chi phí DB.

Điều kiện bắt buộc (risk-auditor + ui-ux-critic, không mặc cả): `ON CONFLICT DO UPDATE ... GREATEST` (không DO NOTHING — first-write-wins khoá số sai vĩnh viễn); GRANT block đầy đủ + verify `role_table_grants` sau áp; query đọc có rào độ tươi (loại row >2 phút → ẩn badge, tránh "12 đang xem" vĩnh viễn khi phòng rỗng); snapshot lưu số THÔ (ngưỡng 3/optimistic +1 chỉ ở tầng render, có test); probe forge; áp migration ngoài 22h-24h VN; cron vào roster `ops_cron_monitors`; quyết định Q2 (native) có ý thức.

### Option C — Cách B thuần (thay hẳn Presence): KHÔNG khuyến nghị

Tối ưu cho V=5.000 chưa tồn tại, chậm hơn ở đúng tiêu chí anh nêu, đắt hơn ở mọi trục (5-6 nửa ngày + cron + bảng + bề mặt ghi anon canh vĩnh viễn), mất danh sách viewer của admin, và đảo ngược lợi thế sống-sót-outage. Chỉ mở lại nếu đo được V đỉnh thật >800.

## 5. UI/UX (ui-ux-critic — ⚠️ không có xác nhận chéo GPT-5.6)

- Độ trễ 30-60s **không phải** vấn đề với người xem VN — trừ chính mình vừa vào (vá bằng optimistic +1 tầng render). **Flicker mới là thứ nhìn thấy**: số nhảy 7→6→8 khi reconnect 4G đọc như "app đếm bậy".
- Trang list (`/live`, trang giải, tổ chức) hiện **không có số nào** hoặc in `0` cứng — đây là chỗ số có giá trị kinh tế nhất (quyết định bấm vào). Presence per-card không làm được trên 4G (6 card = 6 socket — `LiveCardWithPresence` là bằng chứng chết); nếu muốn số ở list thì cần snapshot (Option B′).
- Copy VI giữ `"đang xem"`; rút gọn tooltip thành "Số người đang xem lúc này"; chuỗi mới `watchingAria`/`watchingStale` (đã soạn sẵn trong `round1/ui-ux-critic.md`). Sửa `toLocaleString("en-US")` hardcode → theo locale.
- Đo tương phản 2 cặp (`.tl-lh-viewers-lbl`, badge trên thumbnail) trước khi ship — gate axe đang TẮT color-contrast, CI không bắt hộ.

## 6. Rủi ro (risk-auditor + pre-mortem)

**Verdict:** báo cáo (a) 🟢 GREEN (classifier đồng ý) · thực thi Cách B/snapshot (b) 🔴 RED — auditor nâng cả cụm theo blast-radius, không chỉ file migration. Cách A giữ nguyên: 🟡 AMBER, tựa trên A1 (quota Realtime chưa đo) + A3 (enrichViewers) — cả hai đo được/vá được.

Pre-mortem (giả định Cách B đã thay Presence) — 3 sự cố, xếp theo độ nguy hiểm:
1. **P1 — Đếm sai âm thầm 21 ngày** (CGNAT gộp cả pool Viettel thành 1 người + 429 bị `catch{console.error}` nuốt + sai số ngược dấu triệt tiêu thành "con số hợp lý"): giao số sai cho ban tổ chức/nhà tài trợ, KHÔNG có ground truth tính lại — gỡ Presence là gỡ nguồn đối chiếu duy nhất (Mux Data chưa tích hợp).
2. **P2 — Cron dọn chưa từng chạy 34 ngày** dưới deploy-guard đỏ kinh niên (gate đỏ vĩnh viễn = gate tắt); DELETE chữa cháy giữa giờ stream tự gây outage. Lặp đúng bẫy index đã vá một lần ở `20260715210000`.
3. **P3 — Đêm chung kết**: 260 write/s đập cùng tuple ô nóng → lock convoy cạn pool → PGRST002 loop; restart không cứu vì 2.600 tab không reload; không kill switch.

Thuốc rẻ nếu có ngày làm Cách B: shadow mode 2 tuần log lệch Presence-vs-B, kill switch trong `system_settings` (bảng + hook có sẵn), không nuốt lỗi flush (báo về `log-client-event`).

**GPT-5.6 (vendor khác, không thấy repo):** kết luận trùng — giữ A, không đưa heartbeat vào Postgres. Auditor đã **bác 2 claim** của nó bằng đo thật: vách `.in()` URL ở ~1600-2400 UUID chứ không phải 500; Presence fail hiện `—`/ẩn badge chứ không hiện 0 và không chặn playback. (Chi tiết + nguyên văn: `external/risk-auditor-gpt56.md`.)

**Rollback:** gói GREEN = `git revert`, 0 phút. Snapshot/Cách B = revert code KHÔNG dừng tải/không un-run migration — REVOKE tay + unschedule giữa đêm, và PGRST002 loop chỉ anh restart được. Đó là định nghĩa của RED.

**SEO:** không đụng route SSR nào, không bump `pr:v34`.

## 7. Tranh luận trong panel

> ⚠️ `debate-ledger.mjs` không tồn tại — bảng dưới do orchestrator lập tay theo đúng luật `docs/agent-round2-rules.md`; JSON gốc từng agent trong `round2/`, kiểm tra được.

| ID | Bất đồng | architect | ui-ux-critic | risk-auditor | Kết cục |
|---|---|---|---|---|---|
| D1 | Hero/card Presence là dead code hay bề mặt sống? | HOLD (evidence: Index.tsx:7, #251 gỡ hero) | **CONCEDE** (Index.tsx:599, hero.tsx:146 = occurrence duy nhất) | **CONCEDE** (tự grep, A2 hạ thành mìn chưa nổ) | Giết bằng bằng chứng — dead code |
| D2 | Ai ghi snapshot: client leader vs server-side | **CONCEDE** (20260804090000 — đúng lớp lỗ client-tự-khai vừa đóng 04/08) | **CONCEDE** (types.ts:2866-2887 không có cột; sàn cron 1 phút) | (bổ sung N3: GREATEST, leader trúng `admin_watcher_*`) | Hội tụ chéo: server-side observer 60s |
| D3 | "Rời đi tức thì" của A có thật trên mobile? | **REFINE** (tức thì chỉ SPA nav; đầu bảng mới = sống sót PGRST002) | HOLD (0 handler pagehide; khung công bằng 25-50s vs 60-85s) | — | Hội tụ về cùng khung số |

- **Bất đồng bị giết (ảo):** D1 — cả hai phía phản đối tự mở file, thấy sự thật, CONCEDE đúng luật. Vòng 2 làm đúng việc của nó.
- **Bất đồng sống sót:** không có D nào; N5 (native vô hình) là quyết định giá trị → mục 0/Q2.
- **Nhượng bộ bị loại:** không có — mọi CONCEDE đều kèm file:line tự kiểm chứng.
- **Đồng thuận có nghĩa:** GPT-5.6 (OpenAI, không thấy repo) + risk-auditor + architect độc lập cùng ra "giữ A" — đây là đồng thuận chéo vendor, khác với việc 2 Claude gật nhau. Riêng nhánh UX không có xác nhận chéo (Codex hết hạn mức) — phần phán đoán cảm nhận (ngưỡng 3, flicker-vs-stale) là phần yếu bằng chứng nhất, đã đánh dấu trong `round1/ui-ux-critic.md`.

## 8. Kế hoạch verify (cho gói GREEN nếu anh duyệt Q1)

**Tự động:** eslint changed · `check-theline.mjs` · `tsc -b --noEmit` · `npm run test` (2 test useLivePresence phải xanh) · build + bundle (kỳ vọng GIẢM — xoá 2 component) · e2e:smoke.

**Anh tự làm:** mở `/tournaments/<slug đang live>` trên điện thoại — card live KHÔNG còn "0 đang xem"; mở `/admin/livestream-viewers` khi có stream — danh sách vẫn đủ tên, Network tab ≤1 query/2s; **đọc dashboard Supabase Billing → Realtime usage** (peak connections + messages) — con số này quyết định mọi kết luận về trần của Cách A và chưa ai trong panel thấy được.

## 9. Sau khi ship

- SHA: `4353d6fc` · PR: #555 · Ngày: 2026-08-06
- Verify thực tế: CI PR 6/6 xanh (quality/visual/smoke/codeql/npm-audit/Pages); post-deploy smoke `/` `/feed` Googlebot-`/live` = 200×3; console prod `/` + `/live` sạch; soak 30' **giảm cấp** (uptime poll 3 route ×10 tick, sạch — soak-watch.mjs chuẩn KHÔNG chạy được vì agent không đọc được SUPABASE_ACCESS_TOKEN).
- Khác kế hoạch: (a) release-pilot dừng đúng luật vì bot PAT bị classifier chặn → Cuong tự tạo PR + merge bằng lệnh `!`; (b) tier thật là AMBER (risk-tier xếp i18n en/vi.ts vào content), không phải GREEN như orchestrator ước lượng ban đầu; (c) thêm test `LiveCard.test.tsx` pin ngưỡng render (ui-ux-verifier chỉ ra ngưỡng 3 là quy tắc render duy nhất không có lưới); (d) deploy-guard đỏ trên merge commit = drift kinh niên 04/08, không do PR này (0 migration).
- Học được: (1) recon đếm consumer bằng grep tên file mà không truy barrel → sai 3-thành-1, vòng 2 phải sửa; (2) `debate-ledger.mjs` vẫn thiếu — lần /idea thứ 2 liên tiếp phải cưỡng chế tay; (3) `useChatMessages.ts:128` đặt suffix vào topic chat — pattern từng gây sự cố 2026-07-08, đáng một /idea riêng (architect ghi nhận, chưa khẳng định là bug).
- CHƯA chứng minh (chờ Cuong nhìn tận mắt khi có stream live thật): card không còn "0 đang xem"; <3 viewer → badge ẨN (đúng thiết kế); panel admin ≤1 query/2s.
- **Quota Realtime ĐÃ VERIFY 06/08 tối** (org ThePickleHub → Usage, chu kỳ 03/08-03/09): **peak concurrent connections 43/500 (9%)** · **messages 25/5.000.000 (<1%)**. Khớp đúng con số [unverified] của architect (Pro = 500 conn + 5M msg). Kết luận STOP & LOOK coi như có sẵn: V thật đang ở hàng CHỤC (43 connection gồm cả chat), cách ngưỡng giao cắt ~800-1.000 hơn một bậc độ lớn → Option B′/C hoãn vô thời hạn là đúng; mở lại khi peak connections tiến gần 300-400.
- Finding phụ từ dashboard: cảnh báo "Projects exceeding quota" — project `phub-restore-drill` provisioned 12GB disk (>8GB free) trong khi Spend Cap đang BẬT → Supabase báo có thể bị hạn chế; nên giảm disk hoặc pause/xoá project drill (restore drill đã PASS từ 22/07).

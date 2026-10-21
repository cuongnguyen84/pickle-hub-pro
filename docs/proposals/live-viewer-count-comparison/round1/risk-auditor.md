# Risk audit — live-viewer-count-comparison (vòng 1, độc lập)

**Ngày:** 2026-08-06 · **Agent:** risk-auditor · **Vòng:** 1 (chưa đọc output của
solution-architect / ui-ux-critic / pre-mortem)

---

## Verdict

Đề bài có HAI kịch bản, nên có hai verdict. Đừng gộp.

### (a) Chỉ viết báo cáo so sánh, không đổi code — 🟢 GREEN

Classifier: GREEN (`docs/…/risk-auditor.md` → *"not shipped to users"*). Em giữ nguyên
GREEN. `git revert` là đủ; không có bề mặt người dùng nào bị đụng.

### (b) Nếu sau này thực thi Cách B (heartbeat/bucket trong Postgres) — 🔴 RED

> **Kết cục xấu nhất có thật:** 22h-24h VN đêm livestream, 500-2000 viewer ẩn danh
> heartbeat vào Postgres cùng lúc mọi viewer poll `COUNT(DISTINCT)` — đúng instance
> Micro và đúng khung giờ đã sập trọn 90 phút hôm 02/08 vì PGRST002 loop. REST 503 +
> Auth 504: không ai login được, không ai đăng ký giải được, và ô "ĐANG XEM" hiện 0
> giữa lúc stream vẫn chạy. Không `git revert` được (bảng + grant + cron đã nằm trên
> prod), và người duy nhất restart được project là Cuong, lúc 23h.

Classifier nói gì: `supabase/migrations/<...>_live_viewer_heartbeats.sql` → **RED**
(*"applied migration — reverting the file does not un-run the SQL"*). Các file client
(`src/hooks/useLivePresence.ts`, `useLiveViewerList.ts`, `LiveBroadcastHero.tsx`) →
GREEN.

**Em nâng TOÀN BỘ cụm (b) lên RED, không chỉ riêng file migration**, vì blast-radius chứ
không chỉ reversibility — đúng bài học `lessons-learned.md` mục champion-on-event-card:
*"Tier by BLAST-RADIUS, không chỉ reversibility"*. Lý do cụ thể: bảng heartbeat phải cho
`anon` ghi (xem người xem không cần đăng nhập), tải ghi/đọc rơi đúng giờ cao điểm của
một instance đã có tiền sử sập, và cơ chế sập đó **không tự hồi** — phải restart tay.

**Cách A (giữ nguyên Presence) — 🟡 AMBER**, không phải GREEN: nó đang chạy tốt nhưng có
2 vách chưa ai đo (quota Realtime) và 1 chi phí DB thật đang bị gọi nhầm là "0 ghi DB"
(mục #3 dưới).

---

## Rủi ro cụ thể

### Cách A — giữ nguyên Supabase Realtime Presence

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| A1 | **Cao** | Phoenix Presence fan-out: mỗi join/leave phát `presence_diff` tới **mọi** subscriber trong topic. Một đợt vào phòng từ 0→N tốn ~N(N−1)/2 message; steady-state ≈ r·N. N=500, thời gian xem TB 10' → ~1,67 transition/s × 500 ≈ **833 message/s**. N=2000 → ~13k message/s. Vách thật là **quota Realtime của project (peak connections + messages/tháng)** — CHƯA AI ĐO. | Không phải trang trắng. `src/pages/WatchLive.tsx:410` render `isConnected ? count : "—"` → hiện dấu gạch; `src/components/home/LiveBroadcastHero.tsx:222` render có điều kiện `concurrentViewers > 0` → badge **biến mất im lặng** khỏi trang chủ. Video Mux vẫn chạy (đã verify: không có coupling). | Đọc quota trên dashboard TRƯỚC mùa giải (lệnh ở §"Phải verify"). Bỏ `user_agent` khỏi payload track (`useLivePresence.ts:105`) để giảm kích thước state snapshot. |
| A2 | **Cao** | `src/components/home/LiveBroadcastHero.tsx:151` mở channel cho **mọi khách vào trang chủ** khi có stream live, không chỉ người bấm vào xem. Số connection = lưu lượng trang chủ, không phải số người xem. | Con số hiển thị **sai lệch có hệ thống theo hướng thổi phồng** — nó là "số tab đang mở trang có stream", không phải "số người đang xem". Và vách connection ở A1 tới sớm hơn nhiều so với dự đoán dựa trên lượng người xem. | Đây là TODO đang mở của chính repo: `.claude/memory/lessons-learned.md:247-260` ("Live presence channel scaling concern"), ngưỡng revisit ghi là ~500 đồng thời. Cách rẻ nhất: hero chỉ join sau khi player thật sự play, hoặc hero đọc count qua một kênh broadcast-only. |
| A3 | **Cao** | **Đây mới là chi phí DB thật của Cách A, và recon gọi nhầm là "0 ghi DB".** `src/hooks/useLiveViewerList.ts:122-142` chạy `enrichViewers` trong **mọi** `presence:sync`, không debounce, không diff → 1 GET `profiles` (`.in("id", userIds)`) + 1 RPC `admin_get_profile_emails` mỗi lần sync. N=500, residence 10' → ~1,7 sync/s → ~3,3 query/s, mỗi query trả tới ~500 dòng ≈ **~100k dòng/phút** kéo từ Micro instance, đúng giờ cao điểm. | Admin mở `/admin/livestream-viewers`: bảng nháy liên tục, chậm dần theo số người xem. Đúng lúc DB đang căng thì nó bồi thêm tải. | Diff `joined`/`left` từ `presenceState()`, chỉ fetch id MỚI, cache profile trong client, debounce ~2-5s. **Cách B KHÔNG xoá được rủi ro này** — danh sách vẫn cần identity. |
| A4 | TB | Trễ phát hiện "ai rời đi": realtime-js 2.110.7 mặc định `HEARTBEAT_INTERVAL: 25000`, `DEFAULT_TIMEOUT: 10000` (`node_modules/@supabase/realtime-js/dist/main/RealtimeClient.js:12`, `lib/constants.js:10`); app KHÔNG set option realtime nào (`src/integrations/supabase/client.ts` chỉ set `auth`). Khoá màn hình / gập laptop → socket chưa đóng ngay. | Số người xem **cao hơn thực tế ~25-60s** sau khi một nhóm rời đi. Với tiêu chí "đủ đúng" của Cuong thì chấp nhận được. | Không cần sửa. Ghi vào proposal là sai số đã biết. |
| A5 | Thấp (tiềm ẩn, chưa sống) | Đụng topic: `useLivePresence.ts:57-64` **gỡ bất kỳ channel nào** có topic `realtime:livestream_presence:<id>` trước khi tạo mới — đúng topic mà `useLiveViewerList.ts:89` dùng. Nếu hai hook cùng mount, hook này giết channel của hook kia; `useLiveViewerList.ts:106-109` khi đó chỉ `return` im lặng, **không retry, không báo lỗi**. | Admin thấy danh sách người xem RỖNG vĩnh viễn trong khi stream có hàng trăm người. Không có thông báo lỗi nào. | Hôm nay CHƯA sống: không trang nào mount cả hai (`LiveCardWithPresence.tsx` **không có importer nào** — đã grep toàn `src/`, chỉ còn vết trong `src/graphify-out/`). Nhưng bất kỳ thay đổi nào kiểu "hiện luôn số người xem trên trang admin" sẽ kích hoạt nó. Ghi vào proposal như một mìn đã cài. |

### Cách B — chuyển sang bảng heartbeat/bucket trong Postgres

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| B1 | **Cao** | **Migration không revert được bằng `git revert`.** Quy trình repo là áp migration lên prod TRƯỚC khi merge (`docs/ops-runbook.md` §1). Revert code xong thì bảng, RLS policy, GRANT `anon`, RPC và cron cleanup vẫn sống trên prod — và client cũ trong tab đang mở vẫn tiếp tục bắn heartbeat cho tới khi người dùng refresh. Đúng lớp lỗi đã ghi: *"`git revert` merge squash xoá luôn file migration khỏi ledger trong khi prod vẫn giữ schema đã áp → drift ngay lập tức"*. | Trong lúc sự cố: gỡ tính năng KHÔNG làm ngừng tải. Cuong phải `REVOKE` tay + `cron.unschedule` tay lúc 23h. | Không có cách giảm thiểu nào biến việc này thành GREEN. Đây là lý do verdict là RED. |
| B2 | **Cao** | **Bảng heartbeat phải cho `anon` ghi** — xem live không cần đăng nhập. Đó đúng hình dạng lỗ đã bịt hôm 04/08 (`event_registrations` INSERT hole, forge-paid). Ai cũng `curl` được endpoint với `viewer_id` bịa. | Trang chủ hiện "12.500 ĐANG XEM" hoàn toàn bịa — social proof thành thứ ai cũng giả được. Nặng hơn: kẻ tấn công bơm hàng triệu dòng + WAL vào Micro instance → outage toàn site, chứ không chỉ con số sai. Với Cách A, bot muốn thổi số phải mở từng WebSocket thật và chỉ đụng quota Realtime, không đụng Postgres. | Rate-limit RPC kiểu `consume_view_event_rate_limit` (đã có tiền lệ ở `20260715160000_view_event_rate_limits.sql`) — nhưng IP-based rate limit rất yếu sau NAT di động VN. Chi phí này phải tính vào "thuận tiện hơn". |
| B3 | **Cao** | Write amplification đúng khung giờ đã sập. Heartbeat 30s: **V=500 → 1.000 write/phút (~17/s); V=2000 → 4.000 write/phút (~67/s)**, mỗi write kèm WAL + index + dead tuple. Cộng đọc: nếu mỗi viewer poll count mỗi 10s thì V=500 → 50 req/s, V=2000 → 200 req/s `COUNT(DISTINCT viewer_id)`. Đối chiếu: tải bị nghi góp phần vào outage 02/08 chỉ là **1 dashboard poll 60s + 1 cron/phút + 1 cron/5 phút**. Cách B lớn hơn 1-3 bậc độ lớn. | Lặp lại 02/08: REST 503, Auth 504, login fail, site không vào được — 22h-23h30 VN, giữa livestream. Loop PGRST002 **không tự hồi**, phải restart project bằng tay. | Poll count qua 1 endpoint cache ở edge thay vì mỗi client query DB (cắt phần đọc). Phần ghi thì không cắt được — nó là bản chất của Cách B. |
| B4 | **Cao** | **Cleanup GC lặp y hệt một bug đã có trong repo.** `supabase/migrations/20260715210000_view_event_rate_limits_window_index.sql` phải sinh ra chỉ để vá: PK là `(identity_hash, window_start)`, nên `DELETE ... WHERE window_start < cutoff` không dùng được PK → **seq scan trên hot path**. PK `(livestream_id, viewer_id, bucket)` của Cách B có đúng hình dạng đó. | Cleanup chậm dần theo kích thước bảng, ăn CPU đúng lúc stream đang chạy. | Index riêng trên cột hết hạn + DELETE theo lô có giới hạn, ngay từ migration đầu tiên. Đây là điều kiện bắt buộc, không phải tối ưu để dành. |
| B5 | TB | **Thiếu GRANT block** — recurring bug #1 của repo, đã xảy ra 3 lần (`lessons-learned.md:8-54`). Postgres kiểm GRANT TRƯỚC RLS; test bằng SQL Editor (super-user) luôn xanh. | `42501 permission denied for table …` → heartbeat fail im lặng → số người xem đứng **0** suốt buổi live. Giống hệt `push_tokens` hỏng câm 4 tháng. | Migration phải kết bằng đúng block GRANT trong `lessons-learned.md:21-39`, và verify bằng `information_schema.role_table_grants` sau khi áp. |
| B6 | TB | Bloat / autovacuum: UPSERT mỗi heartbeat = 1 dead tuple mỗi heartbeat. V=2000 × 2/phút × 120 phút = **~480k dead tuple cho một buổi live**, trên instance ~1GB. Autovacuum kích hoạt GIỮA buổi phát. | Latency DB tăng dần về cuối buổi live — đúng lúc đông nhất. | `fillfactor` thấp + autovacuum tuning per-table. Thêm việc vận hành cho một người. |
| B7 | TB | **Cách B KHÔNG chính xác hơn.** Trình duyệt throttle timer ở tab nền; iOS Safari và Capacitor WebView đình chỉ hẳn `setInterval` khi app xuống nền/khoá màn hình. Heartbeat là timer JS; WebSocket của Presence sống dai hơn timer. | Đếm **thiếu** người đang thật sự xem (điện thoại khoá màn hình mà vẫn nghe tiếng). Nới cửa sổ freshness để bù thì lại đếm thừa người đã rời — đổi một sai số lấy sai số khác. | Không có. Đây là lập luận trực tiếp chống lại tiền đề "Cách B đúng hơn". |
| B8 | TB | **Cách B cho CON SỐ, không cho DANH SÁCH.** `useLiveViewerList` cần `viewerId`, `user_id`, `joined_at`, `gated` (`useLiveViewerList.ts:6-22`) và cờ `gated` được cập nhật qua `channel.track()` trên presence meta (`useLivePresence.ts:164-174`). Cách B không tái tạo được thứ đó nếu không ghi thêm PII vào bảng. | Nếu bỏ Presence: admin mất trang "ai đang xem". Nếu giữ Presence: chạy **hai** hệ thống song song. | Trả lời thẳng câu hỏi "thuận tiện hơn" của Cuong: Cách B không thay thế được Cách A, nó **cộng thêm** vào. |
| B9 | Thấp | Cron cleanup mới = một lịch mới phải đăng ký. `docs/cron-schedules.md` có mục "How to update this file" và OPS-00 monitored schedules; quên thì SLO 5 mù thêm một job. | Bảng heartbeat phình vô hạn, không ai được báo. | Thêm dòng vào `docs/cron-schedules.md` + roster monitor trong cùng PR. |

### Rủi ro của việc CHUYỂN ĐỔI

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| C1 | TB | Test hiện chỉ phủ Presence: `src/hooks/__tests__/useLivePresence.core.test.ts` + `useLivePresence.gated.test.ts` (sync/count, CHANNEL_ERROR retry, gated re-track). **Không có test nào cho `useLiveViewerList.ts`.** Thay cơ chế đếm = vứt bộ test duy nhất đang bảo vệ nó. | Regression kiểu 2026-07-08 (mỗi người một phòng, ai cũng thấy 1 viewer) quay lại mà không gate nào bắt. | Nếu làm Cách B: giữ Presence chạy song song ở chế độ shadow, so hai con số, rồi mới cắt. |
| C2 | TB | Cờ `gated` (`src/pages/WatchLive.tsx:75` → `useLivePresence.ts:164-174`) là presence-meta, và comment trong code ghi rõ **tuyệt đối không đưa `gated` vào deps của effect subscribe** (nguyên nhân sự cố collision 2026-07-08). Cách B phải cài lại logic này bằng cột DB. | Người kẹt ở cổng login bị đếm nhầm thành người đang xem, hoặc ngược lại. | Nếu chuyển: port `gated` trước, có test, rồi mới đụng phần đếm. |
| C3 | Thấp | Native: `apple/` (SwiftUI) không có Presence (recon grep `Presence` → 0 hit). App Capacitor tải URL remote nên chạy cùng bundle web → dính B7. | Không có regression native ở kịch bản (a). Ở kịch bản (b), heartbeat trong WebView bị đình chỉ khi app xuống nền. | Không đụng native trong vòng này. |

---

## SLO bị đe doạ

Kịch bản (a): **không SLO nào.**

Kịch bản (b):

- **SLO 1 (Web availability, 99,5% / 30 ngày)** — B3 tái tạo đúng cơ chế outage 02/08.
  Ngân sách 30 ngày = 43.200 phút × 0,5% = **216 phút**. Một lần lặp lại sự cố 90 phút
  ăn **~42% ngân sách tháng** trong một đêm.
- **SLO 2 (Auth, 99% attempts)** — trong outage 02/08, Auth trả 504 và login fail hoàn
  toàn. B3 làm tăng xác suất lặp lại, đúng giờ có nhiều người đăng nhập nhất.
- **SLO 3 (Registration OTP → insert, 99%)** — cùng lý do; luồng đăng ký đi qua REST +
  edge function, chết theo instance.
- **SLO 5 (Cron 100% monitored-healthy)** — B9: cron cleanup mới không vào roster.
- **SLO 6 (Latency VN p75)** — mỗi viewer thêm 1 waterfall heartbeat + 1 poll count.
- **SLO 4 (Scoring)** — KHÔNG bị đe doạ. Không đường nào từ viewer count chạm bracket.
- **SLO 7 (Push)** — không liên quan.

---

## Ngân sách hiệu năng

- **Bundle:** Cách A đã ship → **+0 KB**. Cách B ≈ **+1-2 KB gz** (một hook + client
  RPC) → CODE ~1455→~1457 / 1800 KB, tổng ~1822→~1824 / **1970 KB**. Ngân sách bundle
  **không phải** ràng buộc quyết định ở đây — đừng dùng nó để biện minh cho Cách B.
- **Vietnam p75 (SLO 6):** Cách A hiện không thêm request HTTP nào (WebSocket đã mở sẵn,
  refcount dùng chung — `useLivePresence.ts:133-154`). Cách B thêm **2 request/phút/viewer**
  (1 heartbeat + poll count) trên mạng di động VN, cộng vào INP của trang watch. Không
  vượt ngân sách, nhưng là hồi quy có thật theo hướng xấu.

---

## SEO

- **Routes SSR bị ảnh hưởng:** **none.** Không đụng `functions/_middleware.ts`, không
  đụng `functions/_lib/render/`. `renderLive` có tồn tại nhưng không SSR số người xem.
- **Cần bump `pr:v34`?** **Không** — output SSR không đổi. (Lưu ý: cache key hiện tại là
  `pr:v34` theo `CLAUDE.md`, không phải `v26` như template agent ghi.)
- **Verify (chỉ để chứng minh không hồi quy):**
  `curl -A "Googlebot" "https://www.thepicklehub.net/live/<id>?nocache=1"` → expect 200 +
  title + og:image + hreflang en/vi/x-default.

---

## Kế hoạch rollback

**Kịch bản (a) — chỉ viết doc:**
- Cơ chế: `git revert`. Thời gian khôi phục: **0** (không có gì trên prod).
- Không revert được: không có gì.

**Kịch bản (b) — thực thi Cách B:**
- Cơ chế: `git revert` **KHÔNG đủ**. Cần: (1) revert code + redeploy Pages, (2) `REVOKE`
  quyền ghi của `anon` trên bảng heartbeat, (3) `cron.unschedule` job cleanup,
  (4) `DROP TABLE` (hoặc để lại và chịu drift ledger).
- Thời gian khôi phục: revert code ~5-8' (build Pages) **nhưng tải DB không ngừng cho
  tới khi REVOKE chạy** — tab đang mở vẫn bắn heartbeat. REVOKE là thao tác SQL tay qua
  Management API, giữa đêm.
- **Không revert được:**
  - Migration đã áp prod (bảng, policy, GRANT, RPC, cron) — `git revert` không un-run SQL.
  - Dead tuple/bloat đã sinh ra — cần VACUUM, không cần thiết ngay nhưng không tự biến mất.
  - Nếu outage đã xảy ra: PGRST002 loop **không tự hồi**, phải restart project, và
    **classifier chặn agent gọi POST /restart** — chỉ Cuong làm được.
  - **Đây chính là thứ làm nó RED.**

---

## Phải verify trước khi merge

**Cho kịch bản (a) — báo cáo so sánh. Không có cái nào là tuỳ chọn:**

- [ ] Đọc quota Realtime thật của project trên dashboard (Settings → Usage/Realtime):
      **peak concurrent connections** và **messages/tháng**, cùng mức đang dùng. Cả em
      lẫn GPT-5.6 đều KHÔNG xác minh được con số này. Báo cáo mà thiếu nó là báo cáo
      đoán mò về chính vách quan trọng nhất của Cách A.
- [ ] `node scripts/agents/risk-tier.mjs --base origin/main` trên diff thật (KHÔNG dùng
      `--files "a,b,c"` — gộp comma thành 1 path, ra tier sai; `lessons-learned.md:490`).
- [ ] Báo cáo phải nói rõ với Cuong: recon ghi Cách A "0 ghi DB" là **đúng cho phần
      đếm nhưng sai cho hệ thống** — `useLiveViewerList.ts:122-142` đang query DB mỗi
      lần sync (mục A3). Đừng để Cuong quyết trên tiền đề "Cách A = 0 DB".

**Nếu sau này làm Cách B, thêm:**

- [ ] `SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name='<bảng heartbeat>';`
      → phải có dòng cho `authenticated`/`anon` đúng như thiết kế (B5).
- [ ] Migration phải có index trên cột hết hạn + DELETE theo lô, verify bằng
      `EXPLAIN ANALYZE` trên câu DELETE của cleanup → **không được xuất hiện Seq Scan** (B4).
- [ ] Probe forge: `curl` endpoint heartbeat với `viewer_id` bịa từ máy không đăng nhập
      → phải bị rate-limit/từ chối, không được làm tăng count (B2).
- [ ] Load test ramp + churn + reconnect storm, KHÔNG chỉ N socket đứng yên.
- [ ] Chạy migration **ngoài khung 22h-24h VN** (`ops-runbook`/memory: cấm `NOTIFY pgrst`
      giờ livestream).
- [ ] Thêm dòng vào `docs/cron-schedules.md` + roster OPS-00 trong cùng PR (B9).
- [ ] `npm run test -- useLivePresence` vẫn xanh + có test mới cho đường Cách B.

---

## Phản biện độc lập (GPT-5.6)

Nguyên văn prompt + reply: `docs/proposals/live-viewer-count-comparison/external/risk-auditor-gpt56.md`.

**Ghi chú quy trình (trung thực):** `scripts/agents/ask-model.mjs` **không tồn tại** trong
repo — `scripts/agents/` chỉ có `risk-tier.mjs`, `soak-watch.mjs` và test của chúng. Đây
đúng lớp lỗi đã ghi ở `lessons-learned.md` mục 2026-08-04 (*"agent doc mô tả một lệnh
không có thật thì agent sẽ ứng biến im lặng"*). Em không ứng biến im lặng: đã gọi thẳng
OpenAI API bằng `curl` với `OPENAI_API_KEY` có sẵn trong env. Model trả lời:
`gpt-5.6-sol`. **Panel KHÔNG chạy one-model-down.**

Kết luận của GPT-5.6 trùng em: **giữ Cách A, không đưa heartbeat vào Postgres.**

### Đã xác minh trong repo → giữ lại

- **Fan-out Presence là bậc hai trên đoạn ramp** (~N(N−1)/2), tuyến tính r·N ở steady
  state. Đúng bản chất Phoenix Presence; khớp code `useLivePresence.ts:86-93`. → A1.
- **Presence sống sót qua outage PostgREST.** Channel là public (đã grep: không chỗ nào
  set `private: true`), không đọc/ghi Postgres, Realtime là service riêng. Khớp bản ghi
  02/08: REST 503 + Auth 504 nhưng đó là PostgREST/Auth. Đây là **lợi thế bất đối xứng
  quan trọng nhất của Cách A** và Cách B đảo ngược nó: 02/08 thì Cách A vẫn đếm đúng,
  Cách B sẽ hiện 0.
- **Cách B không rollback được bằng git revert.** Khớp verdict RED của `risk-tier.mjs`
  trên file migration. → B1.
- **Cleanup cần index riêng, nếu không lặp lại lỗi cũ.** Đã đối chiếu file thật:
  `20260715210000_view_event_rate_limits_window_index.sql` sinh ra đúng vì lý do đó. → B4.
- **Hook admin cần diff/debounce.** Đã đọc `useLiveViewerList.ts:122-142`: đúng, mỗi
  `sync` chạy 2 query, không debounce, không diff. → A3.
- **Rủi ro forge của bảng anon-writable.** Khớp lỗ `event_registrations` đã bịt 04/08. → B2.

### Bác bỏ / sửa lại

- ❌ **"`.in()` với 500 UUID (~18-20 KB URL) có thể fail vì giới hạn request-URI/header;
  với 5000 id thì không gửi được."** **Sai ở ngưỡng.** Em đo thật trên endpoint prod
  (`curl -G .../rest/v1/profiles --data-urlencode "id=in.(<N uuid>)"`, apikey rác nên
  401 = request ĐÃ được nhận):
  `N=100/200/400/800/1600` → **HTTP 401** (tới ~62 KB URL vẫn qua);
  `N=2400/3200/5000` → connection reset (curl exit 55). Vách nằm giữa **1600 và 2400 id
  (~64 KB)**. Nghĩa là ở 500 người xem **không có vấn đề gì về độ dài URL** — nó chỉ cắn
  trên ~1600 viewer có `user_id`. GPT đúng hướng, sai ngưỡng hơn 3 lần. Giữ A3 vì lý do
  **tần suất query**, không phải vì độ dài URL.
- ❌ **"Video có thể chết / hiện 0 nếu Presence fail."** Code nói ngược:
  `WatchLive.tsx:410` là `isConnected ? concurrentViewers.toLocaleString() : "—"` và
  `LiveBroadcastHero.tsx:222` là `isLive && concurrentViewers > 0 &&`. Presence chết →
  **dấu gạch hoặc badge biến mất**, không bao giờ hiện 0, và **không hề chặn playback**
  (không có coupling nào giữa `isConnected` và player). Triệu chứng thật nhẹ hơn GPT mô tả.
- ⚠️ **"Query `profiles` fail → mất enrichment (tên/email)."** Nói quá.
  `admin_get_profile_emails` (`20260706120000_profiles_pii_column_lockdown.sql:133-142`)
  trả `RETURNS TABLE (id, email, display_name)` và `useLiveViewerList.ts:61` có nhánh
  fallback dựng entry từ RPC. Mất query `profiles` → **chỉ mất avatar**, tên vẫn còn.
- ⚠️ **"Dùng metric real-time concurrency của Mux Data — rẻ hơn cả hai."** Không phải
  công tắc bật/tắt. Repo **hoàn toàn không có instrumentation Mux Data**: đã grep
  `mux-embed` / `env_key` / `data.mux.com` trong `src/`, `supabase/functions/`,
  `package.json` → **0 hit**. Muốn dùng phải: thêm SDK beacon vào player, có entitlement
  Mux Data, dựng một poller cache ở edge. Đó là dự án thứ ba, không phải lựa chọn rẻ.
  Đáng đưa vào proposal như **hướng tương lai có ghi rõ chi phí tích hợp**, không phải
  khuyến nghị ngay.
- ⚠️ **"Giới hạm ~500 concurrent Realtime connection."** GPT tự nói là không suy ra được
  và phải tra dashboard. Em cũng KHÔNG xác minh được. Ghi vào mục "Phải verify", **không
  đưa vào báo cáo như dữ kiện**.
- ⚠️ Các con số "2-3 triệu row-visit/s" ở phần Cách B là số học trên giả định do chính
  GPT đặt ra, không phải đo đạc. Em thay bằng con số write/s tự tính lại ở B3 và neo vào
  tải thật đã gây outage 02/08 — số nhỏ hơn nhưng có thể kiểm chứng.

---

## Trả lời trực tiếp câu hỏi của Cuong

> "Cách nào thuận tiện hơn và ít tốn tài nguyên database hơn?"

**Cách A, cả hai vế, và không sát nút.**

- *Ít tốn DB hơn:* Cách A tốn **0 ghi và 0 đọc Postgres** cho phép đếm — mẫu số bằng 0,
  nên không có "hệ số" nào cả. Cách B thêm ~1.000 write/phút ở 500 viewer, ~4.000
  write/phút ở 2.000 viewer, cộng WAL, dead tuple, autovacuum và một cron cleanup —
  vào đúng instance Micro đã sập 90 phút hôm 02/08, vào đúng khung giờ đó.
- *Thuận tiện hơn:* Cách A đã chạy, đã có test, và bước 3 của Cuong ("ai rời đi") được
  Realtime lo **miễn phí ở tầng server** — app không viết một dòng nào cho nó
  (`useLivePresence.ts:41-43` chỉ đọc lại state). Cách B bắt Cuong tự nuôi bước 3: cửa
  sổ freshness, cleanup, index, bloat, rate-limit chống forge — và vẫn **không** cho
  danh sách người xem, nên phải chạy song song cả hai.
- *Điểm cần sửa nằm ở chỗ khác:* tiền thật của Cách A không nằm ở phép đếm mà ở hai chỗ
  A2 (trang chủ mở channel cho mọi khách) và A3 (hook admin query DB mỗi sync). Sửa hai
  chỗ đó rẻ hơn nhiều so với xây Cách B, và giải quyết đúng mối lo "tốn tài nguyên".

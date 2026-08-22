# Recon — cycle1-residual (verify against main post-29PR, 2026-07-17)

**Kết luận nhanh:** 3/5 item ĐÃ FIX (đều trong commit `c5dc0206` "fix: close perf cors and client ip review findings", 2026-07-15, xác nhận lại bởi `docs/roadmap-8.5-9.md`). Chỉ còn **2 item mở thật**: DUPR fingerprint entropy chưa xác nhận, và gen-types investigation chưa làm.

## 1. PERF-06 — ĐÃ FIX

- `src/lib/i18n-standalone.ts:1-39` — không còn import tĩnh vi+en. Đọc bundle đang active qua `getActiveTranslationBundle()` (`src/i18n/loader.ts:49`), loader dùng `import("./vi")`/`import("./en")` động (`loader.ts:16-22`).
- 9 file dùng `i18n-standalone`: `useDoublesEliminationReferees.ts`, `useFlexTournamentReferees.ts`, `usePairRequest.ts`, `useParentTournament.ts`, `useQuickTable.ts`, `useQuickTableMutations.ts`, `useRefereeManagement.ts`, `useRegistration.ts`, `useTeamMatchRefereeManagement.ts`, `useTeamRegistration.ts` — tất cả giờ chỉ kéo 1 ngôn ngữ qua provider, không kéo cả 2.
- `vite.config.ts:104-160` — `globPatterns` là whitelist (PERF-03), `globIgnores: ["**/locale-*", ...]` loại locale khỏi precache (dòng 131), NHƯNG có `runtimeCaching` riêng cho `locale-dictionaries` (regex `/^\/assets\/locale-(?:en|vi)-[^/]+\.js$/`, dòng 149-152) — không còn "regression offline PWA" như intake lo.
- `docs/roadmap-8.5-9.md:231` = `PERF-06 | done`; dòng 384 xác nhận production state (`/` chỉ load EN, `/vi` chỉ load VI, cả hai return 200, bundle 1,949.3/1,950 KB).
- Nguồn: commit `b8ca5688` (lazy-load) + `99755138` + `c5dc0206` (active-bundle lookup follow-up).

## 2. cf-connecting-ip spoof — ĐÃ FIX

- `supabase/functions/_shared/view-events.ts:116-125` và `_shared/client-errors.ts:190-199` — cùng logic: ưu tiên `cf-connecting-ip` (Cloudflare set, client không spoof được), fallback `x-forwarded-for.split(",").at(-1)` (lấy **hop cuối** = phần tử Cloudflare tự append, không phải phần tử đầu do client control), cuối cùng `x-real-ip`. Có validate format (`/^[0-9a-f:.]+$/i`, max 64 ký tự).
- Test: `src/lib/__tests__/view-events.test.ts:94-109` và `client-errors.test.ts:134-148` — cả hai đều assert case multi-hop XFF trả về hop cuối (203.0.113.x cf-header ưu tiên, fallback 198.51.100.2 = phần tử cuối).
- `docs/roadmap-8.5-9.md:368` liệt kê rõ: "last-hop XFF fallback" nằm trong danh sách đã fix ở `c5dc0206`.

## 3. CORS sót (BE-01) — ĐÃ FIX

- `supabase/functions/zalo-token-refresh/index.ts:11` — `import { zaloCronCorsHeaders as corsHeaders } from "../_shared/cors.ts"`, không còn inline object.
- `supabase/functions/pro-tour-ingest/index.ts:28` — `import { proTourIngestCorsHeaders as corsHeaders } from "../_shared/cors.ts"`.
- `src/lib/__tests__/edge-cors-serve.test.ts:113-114` — map `zaloCronCorsHeaders: ["zalo-token-refresh"]`, `proTourIngestCorsHeaders: ["pro-tour-ingest"]`, test giờ xác minh qua tên preset thật (không phải grep literal `Access-Control-Allow-Origin: *`).
- `docs/roadmap-8.5-9.md:139` = `BE-01 | done` (76/76 handler dùng `Deno.serve`, 72 handler import 1 trong 13 preset từ `_shared/cors.ts`, 0 inline CORS còn lại). Dòng 364 có chi tiết deploy + preflight verify prod (72/72 endpoint đúng header).

## 4. DUPR fingerprint — CÒN MỞ

- `supabase/functions/dupr-webhook/index.ts:1-23` — comment xác nhận `clientId` DUPR gửi = **giá trị PUBLIC** `VITE_DUPR_CLIENT_KEY` (đã lộ trong JS bundle), payload rating KHÔNG được lưu — hệ thống pull rating thật qua partner API riêng (Bearer-authenticated). Đây là lý do thiết kế coi `clientId` không phải secret.
- `supabase/functions/dupr-webhook/handler.ts:113-123` — `clientFingerprint = sha256(incomingClientId).slice(0, 16)` (64-bit hex), lưu vào `dupr_webhook_events.client_id` dạng `sha256:<fp>` (`index.ts:41`) — dùng để dedupe/observability, KHÔNG dùng để xác thực (auth thật là `secretsMatch` so constant-time với `deps.expectedClientKey`, `handler.ts:118`).
- `docs/roadmap-8.5-9.md:370` — nguyên văn: *"Still open from that list: confirm the production `DUPR_CLIENT_KEY` format/entropy without printing it (fingerprint scheme unchanged until then)."* → xác nhận rõ ràng item này CHƯA đóng, chỉ mới có review kết luận thiết kế (SEC-04, dòng 323/345) rằng rủi ro chấp nhận được (fail-closed shared secret), nhưng chưa có ai xác nhận entropy thật của key prod.
- Không có script/test nào brute-force hoặc đo entropy `VITE_DUPR_CLIENT_KEY` trong repo.

## 5. Gen types investigation — CÒN MỞ (chưa bắt đầu)

- `src/integrations/supabase/types.ts` hiện tại: **8,318 dòng**, ~119 bảng cấp cao (đếm bằng regex `^      [a-z_0-9]*: {$` trong block `Tables: {`; con số 124 trong memory có thể đếm cả `Views`/khác — không lệch lớn). File có `Views:` (dòng 6757), `Functions:` (6958), 2 khối `Enums:` (8086, 8262) — đây là bản tay/tích luỹ qua nhiều migration, KHÔNG phải output CLI gần nhất.
- `npx supabase --version` tại máy: **2.109.1**.
- `supabase/config.toml` — grep `schema|db_types|extra_search_path|max_rows` không ra dòng nào; không có block `[api]` với `schemas = [...]` giới hạn schema expose. → chưa tìm thấy flag cấu hình nào giải thích chênh lệch 49 vs 124 bảng.
- Không có script/doc nào trong `docs/` hay `scripts/` ghi lại lệnh đã chạy — chỉ có ghi chú trong memory (`session-2026-07-17-shipped.md`, dòng ~"Regen supabase types: ĐÃ THỬ VÀ ABORT"): lệnh `supabase gen types --project-id ajvlcamxemgbxduhiqrl` (không rõ có `--schema public` hay không) sinh 49 bảng/2.483 dòng, thiếu 60% so với 124 bảng/8.318 dòng hiện có (con số dòng hiện tại KHỚP CHÍNH XÁC 8.318 — xác nhận file hiện tại chính là baseline đối chiếu, chưa có gì thay đổi từ hôm đó).
- CLI hiện tại KHÔNG login (`npx supabase projects list` → `LegacyPlatformAuthRequiredError`); theo memory `supabase-prod-sql-workflow`, session trước dùng PAT qua Management API, không phải `supabase login` trong phiên.
- Vị trí dùng workaround: `TODO.md:156-159` (kế hoạch regen sau khi fix `CreatorLivestreamForm.tsx:158-159`), `docs/security-audit-2026-07-06.md:35-37` (khuyến nghị "nên đồng bộ lại" nhưng không gấp).

## Bảng tổng

| Item | Trạng thái | Bằng chứng | Effort ước |
|---|---|---|---|
| PERF-06 (i18n static import) | **ĐÃ FIX** | `src/lib/i18n-standalone.ts:7`, `vite.config.ts:104-160`, roadmap:231/384 | — |
| cf-connecting-ip spoof | **ĐÃ FIX** | `_shared/view-events.ts:116-125`, `_shared/client-errors.ts:190-199`, test `view-events.test.ts:94-109`, roadmap:368 | — |
| CORS sót (BE-01) | **ĐÃ FIX** | `zalo-token-refresh/index.ts:11`, `pro-tour-ingest/index.ts:28`, `edge-cors-serve.test.ts:113-114`, roadmap:139/364 | — |
| DUPR fingerprint entropy | **CÒN MỞ** | `dupr-webhook/handler.ts:113-123`, roadmap:370 ("still open... without printing it") | S (chỉ cần xác nhận độ dài/entropy `VITE_DUPR_CLIENT_KEY` prod, không có code path để đo tự động) |
| Gen types 49 vs 124 bảng | **CÒN MỞ, chưa điều tra** | `types.ts` 8.318 dòng hiện tại, CLI `2.109.1`, `config.toml` không có schema flag, memory session-2026-07-17 "ĐÃ THỬ VÀ ABORT" | M (cần login CLI/PAT + thử lại với cờ schema khác nhau, so sánh output) |

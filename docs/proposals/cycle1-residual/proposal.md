# Cycle 1 residual — 3/5 đã fix, 2 task điều tra còn lại

> Slug: `cycle1-residual` · Ngày: `2026-07-17` · Trạng thái: `draft`
> Sinh bởi `/idea` — **DỪNG SAU RECON** theo luật bước 2: phần lớn việc đã tồn tại.
> Panel 4 agent KHÔNG chạy — 2 item còn lại là task điều tra (không phải thiết kế), panel không thêm giá trị.
> Raw: `round1/idea-recon.md` · `00-intake.md`

## Kết luận recon (xác minh trên main sau 29 PR ngày 17/07)

| Item | Trạng thái | Bằng chứng |
|---|---|---|
| PERF-06 i18n static import | ✅ **ĐÃ FIX** | `src/lib/i18n-standalone.ts:7` đọc active bundle qua `getActiveTranslationBundle()`; `vite.config.ts:104-160` có runtime cache `locale-dictionaries`; roadmap:231 done |
| cf-connecting-ip spoof | ✅ **ĐÃ FIX** | `_shared/view-events.ts:116-125` + `_shared/client-errors.ts:190-199` ưu tiên `cf-connecting-ip`, fallback XFF lấy hop CUỐI; test `view-events.test.ts:94-109` |
| 2 CORS sót (BE-01) | ✅ **ĐÃ FIX** | `zalo-token-refresh/index.ts:11`, `pro-tour-ingest/index.ts:28` import preset `_shared/cors.ts`; 72/72 preflight verify prod; roadmap:139 done |
| DUPR fingerprint entropy | 🔶 **CÒN MỞ** (S) | `dupr-webhook/handler.ts:113-123` — `sha256(clientId).slice(0,16)` chỉ dùng dedupe, không phải auth; roadmap:370 "confirm production DUPR_CLIENT_KEY format/entropy without printing it" |
| Gen types 49 vs 124 bảng | 🔶 **CÒN MỞ** (M) | `types.ts` 8.318 dòng/~119 bảng chưa đổi; CLI local 2.109.1; không có schema flag trong config.toml; lần thử trước không để lại log lệnh |

## 2 task còn lại — kế hoạch thi hành (không cần proposal riêng)

### T1 — DUPR fingerprint entropy check (~15–30 phút, GREEN)

Lấy `DUPR_CLIENT_KEY` từ Supabase secrets qua Management API (PAT theo memory `supabase-prod-sql-workflow`) vào script chỉ in **length + charset classes + ước lượng bit entropy** — TUYỆT ĐỐI không in giá trị. Quyết định theo kết quả:
- Entropy đủ (≥64 bit thực): ghi nhận, đóng item, cập nhật roadmap:370.
- Entropy thấp (VD 10 chữ số ~33 bit): fingerprint brute-force được nếu attacker chiếm DB đọc được cột dedupe → đổi sang HMAC(key, pepper-server-side) hoặc bỏ cột fingerprint (chỉ dùng event_key dedupe). Diff nằm gọn trong `dupr-webhook/handler.ts` — có test sẵn (`_shared/__tests__/dupr-webhook-handler.test.ts`).

### T2 — Điều tra gen types thiếu 60% bảng (~1 nửa ngày, GREEN — điều tra read-only)

Nghi phạm theo thứ tự (từ recon: CLI 2.109.1, không schema flag):
1. Chạy `npx supabase gen types typescript --project-id ajvlcamxemgbxduhiqrl --schema public` (flag `--schema` tường minh) → đếm bảng, so 119.
2. So sánh: gen qua Management API endpoint (`/v1/projects/{ref}/types/typescript`) — loại trừ lỗi CLI version.
3. Đối chiếu danh sách bảng thiếu với `pg_tables` prod (PAT query endpoint) — bảng thiếu có pattern chung không (partition? RLS? created sau mốc nào?).
4. Ghi kết quả + lệnh chuẩn vào docs; chỉ swap types.ts khi bảng đếm khớp 100% và `tsc -b` sạch (CI, không local cache).

**Không có gì trong 2 task này cần Cuong quyết trước** — cả hai read-only cho tới khi có kết quả; nhánh "entropy thấp → sửa handler.ts" sẽ đi PR thường (AMBER edge function, không đụng `_shared/`).

## Việc phát sinh cho memory

Memory `roadmap-cycle1-review-2026-07-15` liệt 5 bug mở — 3 đã đóng từ 15/07 (chính phiên đó fix, memory không được cập nhật). Cần sửa memory để phiên sau không re-review.

# Intake — cycle1-residual

**Ý tưởng gốc:** cụm 3/4 chuỗi "tiếp tục các tác vụ cải tiến" (Cuong chốt 2026-07-17): xử lý tồn đọng sau review Cycle 1 (2026-07-15) + điều tra gen types.

**Danh sách item (từ memory, cần recon xác minh còn mở):**
1. **PERF-06 chưa xong:** `src/lib/i18n-standalone.ts:5-6` import tĩnh cả vi+en → 8 route lớn (QuickTables, TeamMatchView, DoublesEliminationView…) tải ~68KB gz CẢ HAI ngôn ngữ. Kèm: chunk locale-* bị loại precache mà không có runtime cache JS → regression offline PWA.
2. **cf-connecting-ip spoof test (15 phút):** 2 limiter (`_shared/view-events.ts:115`, `_shared/client-errors.ts:190`) lấy phần tử đầu x-forwarded-for (client control được). Phải test gateway Supabase có strip không; nếu forge được → rate limit anonymous vô hiệu.
3. **BE-01 sót 2 inline CORS:** `zalo-token-refresh/index.ts:22`, `pro-tour-ingest/index.ts:57` + fix test `edge-cors-serve.test.ts:182` (grep literal thay vì regex tên biến).
4. **DUPR fingerprint** `sha256(clientId)[:16]` brute-force được nếu key entropy thấp — xác nhận format key prod; nếu yếu → HMAC+pepper hoặc bỏ cột.
5. **Điều tra supabase gen types:** `supabase gen types --project-id` sinh file chỉ 49 bảng/2.483 dòng vs 124 bảng/8.318 dòng hiện tại (thiếu 60%) — tìm nguyên nhân (CLI version? schema flags?) trước khi swap; hiện tạm dùng cast `as never`/`.filter()`.

**Ai dùng:** nội bộ (perf/security/DX). Riêng PERF-06 = user 4G tải nhẹ hơn ~68KB gz trên 8 route lớn.

**Thành công:** từng item hoặc FIX xong hoặc được chứng minh không-phải-bug (spoof test âm tính, key entropy đủ) với bằng chứng ghi lại.

**Ràng buộc:** đổi `_shared/` = redeploy ALL functions; PERF-02 vừa tối ưu chunk — đừng phá; bundle budget 1970 KB.

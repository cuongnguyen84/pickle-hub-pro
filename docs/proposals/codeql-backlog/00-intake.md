# Intake — codeql-backlog

**Ý tưởng gốc:** đọc handoff và memory, tiếp tục các tác vụ cải tiến.

**Quyết định của Cuong (2026-07-17):** tạo task chạy lần lượt các cụm, thứ tự:
1. **CodeQL backlog** (cụm này) — 28 alert mở trên main, trong đó 7 stack-trace-exposure trên edge function public
2. ARCH-05 — collapse /vi/* route mirror trong src/App.tsx
3. Tồn đọng Cycle 1 — PERF-06 i18n (~68KB gz cả 2 ngôn ngữ trên 8 route lớn), cf-connecting-ip spoof test, 2 CORS sót, điều tra supabase gen types (thiếu 60% bảng)
4. ARCH-02/03 — refactor lớn Social Event / Team Match

**Ai dùng:** không phải feature người dùng — đây là task an ninh/chất lượng nội bộ. Beneficiary = mọi user (không bị lộ stack trace / info leak), Cuong (main sạch alert).

**Thành công:** số CodeQL alert mở trên main giảm 28 → 0 (hoặc còn lại chỉ những alert được dismiss có lý do ghi rõ).

**Ràng buộc:** product chạy trơn tru là ưu tiên #1 (nguyên tắc /idea); edge functions đang phục vụ prod — sửa response shape không được phá client.

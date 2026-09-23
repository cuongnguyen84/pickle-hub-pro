# Intake — arch-05-vi-route-mirror

**Ý tưởng gốc:** roadmap ARCH-05 — "Collapse the manual `/vi/*` route mirror in `src/App.tsx` (~45 duplicated entries) into one wrapper route or a route-config array mapped twice" (docs/roadmap-8.5-9.md:203, ước 2d, dependency ARCH-01).

**Bối cảnh:** cụm 2/4 trong chuỗi "tiếp tục các tác vụ cải tiến" Cuong chốt 2026-07-17 (sau codeql-backlog).

**Ai dùng:** nội bộ — giảm nợ bảo trì; mỗi route mới hiện phải thêm 2 chỗ (EN + /vi mirror), quên 1 = user VI 404 hoặc mất bản VI.

**Thành công:** thêm 1 route mới chỉ cần khai báo 1 chỗ; mọi route /vi/* hiện có giữ nguyên hành vi (URL, SEO hreflang, prerender bot).

**Ràng buộc:** SEO là mạch máu — /vi/* URLs đã index, KHÔNG được đổi URL; prerender middleware (functions/_middleware.ts) match theo pathname; nhiều page có .legacy.tsx rollback window; bundle budget 1970 KB.

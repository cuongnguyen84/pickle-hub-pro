# Ý tưởng gốc

User (Cuong, PO) 17/08/2026: **"làm tiếp shop"** — chạy qua `/build-feature`, mọi việc code phải theo lối ponytail (giải pháp lười nhất mà chạy đúng, diff ngắn nhất, sửa tận gốc chứ không vá triệu chứng).

## Diễn giải "làm tiếp shop" (orchestrator chốt từ tài liệu, không đoán)

`docs/proposals/shop-closed-pilot/PHASE-PROGRESS-2026-08-17.md` (chốt 17/08) ghi rõ:

- Phase 0-2 (P1, P2a, P2b) **XONG TRỌN trên production**.
- P3a/P3b/P4 **khoá tường minh** chờ cổng PO (phễu 3 số + ngưỡng + legal) — full-build P3a đã bị chấm RED ngày 16/08.
- Wave 0 nội bộ đang chạy; **Wave 1 bị chặn bởi đúng 2 thứ**: (1) 🔴 bug nút "Đưa lên trang shop" fail trên iOS Safari, (2) PO ký gate (việc của người, không phải việc code).
- Mục "🔴 VIỆC KẾ TIẾP ĐÃ ĐỀ XUẤT" trong chính file đó: **điều tra bug nút "Đưa lên trang shop"**.

=> Việc code duy nhất đang chặn đường ở thời điểm này = **fix bug nút "Đưa lên trang shop" (publish logo/bìa shop) không hoạt động trên iOS Safari**. Mọi thứ khác trong backlog đều không chặn Wave 1.

## Dữ kiện điều tra đã có (17/08, chép từ PHASE-PROGRESS)

Server đã được chứng minh khỏe **từng khúc**:
- RPC `prepare` trả plan đúng dưới danh tính seller (probe qua Management API với `set_config` jwt.claims).
- Source objects đúng path/size trong draft bucket.
- Edge fn prod phản hồi đúng với anon probe (403).
- CORS `*`; `verify_jwt=false`; CSP `connect-src https:` không chặn; schema cache OK.

Chưa kết luận được:
- Click từ iPhone "không thấy tới gateway" — NHƯNG `function_edge_logs` prod ghi thiếu nặng (24h chỉ 1 dòng toàn hệ thống) ⇒ **CẤM suy luận từ absence of logs**.
- Nghi vấn còn lại: `supabase.functions.invoke` từ bundle preview/prod, hoặc lỗi client **trước** khi fetch xảy ra.

Workaround đang dùng: `scripts/publish-shop-profile-media-manually.sh` (logo+bìa shop PO đã live bằng đường này).

## Ràng buộc

- Làm trên worktree `.claude/worktrees/shop-publish-btn`, nhánh `fix/shop-publish-media-button`, base `origin/main` = `8f833e5a`.
  (Checkout gốc `/Users/cm10/pickle-hub-pro` đang đứng ở nhánh cũ `feat/shop-production-phase-1`, thiếu 25 migration shop — CẤM làm shop ở đó.)
- Không tự commit/push nếu user chưa yêu cầu.
- Ponytail: root cause, diff ngắn nhất, không abstraction mới.

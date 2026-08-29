# Vòng 2 — Báo cáo tester (Chrome MCP, dev server local + Supabase local)

## Kết quả: 4/4 (3 case chính PASS + 1 quan sát phụ PASS) · 0 fail · 0 skip

Môi trường: worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-activation-button`, `supabase db reset --local` exit 0, fixture `shop-p2b-fixture.mjs up` OK (run `msvez8cq`), Vite dev cổng 8080. Slug shop kích hoạt: **`shop-ho-so-qa-msvez8cq`**. Admin: `p2b7-admin1-msvez8cq@thepicklehub.test` (enroll TOTP qua secret trên trang; verify xong gặp màn "không có quyền" một nhịp, F5 vào được — đúng ghi chú vòng 1; lưu ý: lần verify đầu bị trôi im lặng và secret bị thay mới khi F5 — verify lại với secret mới thì được).

| # | Case | Kết quả | Bằng chứng |
|---|------|---------|-----------|
| 1 | TC4-nhanh: approve + kích hoạt "Gặp trực tiếp" | ✅ PASS | Approve → banner "Đã ghi nhận quyết định…", section "Kích hoạt shop" hiện GIỮA "Người nộp" và "Chấp thuận quy chế", "Trạng thái shop: Chờ kích hoạt", path text trơn `(sẽ mở khi kích hoạt)`, select mặc định "Gặp trực tiếp" đủ 3 lựa chọn. Bấm Kích hoạt → Kích hoạt: section tự đổi KHÔNG F5 — "Đang hoạt động", "Xác minh: Gặp trực tiếp", "Đã kích hoạt. Shop đang công khai tại Xem trang shop (mở tab mới). Nhớ báo seller qua Zalo — hệ thống không gửi thông báo tự động.", nút biến mất. Console 0 error app |
| 2 | TC-R2-2: nút huỷ label "Huỷ", bấm Huỷ không RPC | ✅ PASS | Chạy TRƯỚC kích hoạt thật. Dialog `Kích hoạt shop "Shop Hồ Sơ QA msvez8cq"?` có 2 nút **"Huỷ"** + "Kích hoạt" — KHÔNG còn "Cancel" (screenshot xác nhận trực tiếp). Bấm Huỷ → dialog đóng; F5 vẫn "Chờ kích hoạt" → không RPC nào chạy |
| 3 | TC-R2-1: copy xác minh trang công khai (logout thật) | ✅ PASS | Sign out xong (header hiện Log in/Sign up) → `/shop/store/shop-ho-so-qa-msvez8cq`: dòng Xác minh = **"ThePickleHub đã xác minh shop này — đối chiếu giấy tờ hoặc gặp trực tiếp người bán."** đúng nguyên văn; KHÔNG còn chữ "đã xem giấy tờ" ở bất kỳ đâu trên trang; sr-badge = "đã được ThePickleHub xác minh" (không claim giấy tờ). `/shop`: 6 ProductCard, card shop verified chỉ ghi "shop đã được ThePickleHub xác minh" — 0 chữ "giấy tờ" trên toàn trang |
| 4 | Quan sát phụ: shop active CHƯA verified | ✅ PASS | Fixture có sẵn "Shop Đối Chứng" (`/shop/store/p2b7-rival-msvez8cq`, active, chưa verified): dòng Xác minh = **"Shop chưa được ThePickleHub xác minh."** đúng nguyên văn (nhánh else mới ShopStore.tsx:107); ProductCard của shop này trên `/shop` không có dòng xác minh |

## Console

0 error/exception từ app trong suốt phiên (duy nhất 1 exception từ chrome-extension content.js — không liên quan).

## Ghi chú vận hành

- TOTP enroll: lần verify đầu (Enter) trôi im lặng, F5 làm GoTrue sinh factor + secret MỚI → phải sinh mã theo secret mới rồi bấm nút "Xác nhận". Sau verify: màn "You don't have permission" 1 nhịp, F5 vào được (session refresh nhận aal2) — giống vòng 1.
- `resize_window` 390×844 không ép được (viewport thực 1229px) — đúng bài học cũ; toàn bộ case vòng 2 là kiểm copy/hành vi, không phụ thuộc viewport.
- `/auth` là 404 — route đăng nhập thật là `/login` (setup doc vòng 1 ghi `/auth`).

## Dọn dẹp (đã xong)

Fixture down (residue applicant-user/rules như vòng 1 vì applicant own shop tạo qua UI) → `supabase db reset --local` chốt exit 0 + xoá state file `/var/folders/.../tph-p2b7-fixture.json`; `.env.local` đã xoá; dev server đã tắt (curl DOWN); tab Chrome đã đóng.

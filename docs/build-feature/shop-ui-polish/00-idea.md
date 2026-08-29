# Ý tưởng gốc (2026-08-16 tối, feedback trực tiếp từ Cuong — Product Owner)

**"Giao diện shop vẫn đang quá xấu. Cần một thiết kế hiện đại, trải nghiệm người dùng tốt nhất."** — vòng UI polish toàn khu Shop, chạy qua /build-feature.

## Bối cảnh

- Shop closed pilot + nút kích hoạt + fix iOS JPEG đã LIVE trên production 16/08 (PR #578, #580, #584). Cuong vừa tự onboard end-to-end trên prod bằng iPhone và chê UI.
- Feedback phát sinh khi nhìn màn thật: `/shop/sell` (landing đăng ký bán hàng — screenshot desktop cho thấy nội dung tốt nhưng trình bày khô, cột hẹp, toàn text box xám), seller center, danh sách sản phẩm (thumbnail chỉ là ô "1 ẢNH"), admin queue.
- Đây là **ấn tượng đầu tiên của 3-5 seller Wave 1** — UI polish chặn trực tiếp trải nghiệm Wave 1, nên làm TRƯỚC khi mời seller ngoài.

## Phạm vi gợi ý (để task-analyst + critics chốt lại)

Các bề mặt khu Shop, thứ tự ưu tiên theo người nhìn thấy nhiều nhất ở Wave 1:
1. Seller-facing: `/shop/sell` (landing), `/seller` (tổng quan), `/seller/products` (danh sách — có yêu cầu thumbnail thật đã ghi backlog), form sản phẩm, `/seller/application`.
2. Buyer/public: `/shop` (chợ), PDP, trang shop công khai `/shop/store/:slug`.
3. Admin: hàng đợi hồ sơ + sản phẩm (chỉ 1 người dùng — ưu tiên thấp hơn).

## Ràng buộc cứng đã biết

- Design system "The Line" (`tl-*`, `src/styles/the-line.css` + `shop.css`) — token AA đã retune (commit `aed296ab`), CẤM hạ contrast.
- **Bundle Total headroom chỉ ~13.6 KB gz** — gate `check-bundle-size.mjs` sẽ chặn nếu phình. UI polish phải gần như trung tính về bundle (ưu tiên sửa CSS/layout/markup có sẵn, không thêm thư viện UI).
- Coverage ≥83%, CI visual job + axe.
- Bilingual/VI-first; khu seller + admin hiện VI-only.
- Repo có skill `hallmark` (anti-AI-slop design, audit/redesign) và `ui-ux-pro-max` — ux-designer nên dùng.
- Không đổi hành vi/luồng nghiệp vụ đã acceptance (đây là polish, không phải redesign flow); backlog item "bulk approve" KHÔNG thuộc vòng này (PO đã nói để sau).

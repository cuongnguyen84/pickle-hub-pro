VERDICT: ĐẠT (có điều kiện — UI chưa kiểm vì login/migration)

Vòng: 2 (coder chạy 2 lần). Code review vòng 2 đạt (xem `round2-code-review.md`); tester không chạy thêm case nào — vẫn chưa login Chrome, cổng shop đóng, diff vòng 2 không đổi flow so với vòng 1 nên test case vòng 1 giữ nguyên.

## Đã xác minh
- B1: `discountPct` trả null khi giảm <1%; SQL `NULLIF(...,0)` trong `shop_public_search`; không đường nào render `-0%`.
- B2: bật ma trận từ sản phẩm đơn giữ giá gốc cho mọi row mới (test xanh).
- B6: nowrap chỉ còn `.tl-shop-price-was` và `.tl-pdp-off` trong `.tl-pdp-price`.
- Gate: vitest / eslint / tsc xanh (tự chạy lại phần shop), bundle theo báo cáo coder.

## Chưa xác minh (điều kiện)
- pgTAP + migration `20260829120000_shop_compare_at_price.sql` chưa chạy trên DB nào (Docker chết). SQL mới chỉ đọc bằng mắt.
- Toàn bộ UI thật: form seller nhập giá gốc, bảng phiên bản cột "Giá gốc", badge card, PDP gạch giá/badge, xuống dòng khoảng giá ở 320px (TC5–TC10 vòng 1).

## Việc Cuong làm
1. Login Chrome (tài khoản seller có shop) → giao `tester` chạy TC5–TC9 (form đơn, ma trận, hint "-x%", lỗi giá gốc ≤ giá bán, PDP).
2. Áp migration lên prod (hoặc `supabase db reset` khi Docker sống) → chạy pgTAP `shop_p2b_public_read` + `shop_phase2a_variants`, rồi tester chạy TC8/TC10 (badge card từ `discount_pct_max`, khoảng giá 320px).
3. Tự nhìn: card 414px+ có gạch giá kèm badge có rối mắt không — cảm quan, máy không đo.

Lưu ý nhỏ, không chặn: card vẫn gạch giá gốc khi giảm <1% (badge đã ẩn), PDP ẩn cả hai — nếu muốn đồng nhất, thêm `off >= 1` vào điều kiện `was` ở `ProductCard.tsx:40`.

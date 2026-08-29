# Tổng kết — Badge giảm giá + Lối vào Kênh người bán (29/08/2026)

**Ý tưởng → chốt:** (1) 20 sp vừa import đang giảm giá, cần badge rõ; seller tự nhập số. (2) Seller không có nút vào `/seller`. Khảo sát: cột `product_variants.compare_at_price_vnd` + CHECK `> price_vnd` đã có từ P2a nhưng không dây nào nối. Chốt: seller nhập **giá gốc** (₫), % = dẫn xuất floor, một migration CREATE OR REPLACE 5 RPC giữ chữ ký; card badge đỏ `-N%` góc phải + giá gạch khi đơn giá (≥414px); PDP theo variant; form đơn + VariantEditor cột "Giá gốc"; lối vào = dropdown avatar ("Kênh người bán" / "Đơn mở shop: đang chờ duyệt") + link "Quản lý shop →" ở topline /shop.

**Phản biện:** critic-user lo anchor pricing (proto F04 + comment ProductCard từng cấm giá gạch) → đề nghị badge không đỏ, nhãn "Giá cũ", 3 điểm vào; critic-feasibility: đỏ danger-fill đã pass contrast, "Giá gốc", chỉ avatar. Chốt theo yêu cầu gốc ("rõ ràng, highlight"): đỏ + "Giá gốc" + avatar + topline; bù niềm tin bằng câu miễn trừ PDP "Giá, giá gốc và tình trạng hàng do shop tự khai" + cảnh báo trong form "Giá gốc đặt cho có sẽ bị gỡ khi kiểm duyệt" (**Cuong xác nhận vế này**). Cắt sang phase 2: bulk import cột giá gốc, SSR + bump pr:v, native, hết hạn.

**Code:** 2 vòng. Vòng 1: 21 file sửa + 4 mới (migration `20260829120000_shop_compare_at_price.sql`, `src/lib/shop/discount.ts`, test). Review Codex bắt 2 lỗi thật (`-0%` khi giảm <1%; bật ma trận xoá giá gốc) + 1 rủi ro nowrap 320px → vòng 2 sửa. Gate: tsc/lint/vitest 3854 pass/bundle CODE 1749.5/1800 (headroom 50 KB). **pgTAP chưa chạy** (Docker local chết) → CI. Chưa commit.

**Test thật:** 2 pass / 0 fail / 7 skip — Chrome chưa login, `SHOP_PUBLIC_OPEN=false`; TC8/TC10 cần migration prod.

**Cuong cần:**
1. Xác nhận câu "Giá gốc đặt cho có sẽ bị gỡ khi kiểm duyệt" (cam kết admin) — hoặc bảo tôi bỏ vế đó.
2. Cho phép commit + PR; khi merge tôi áp migration prod qua Management API (deploy-guard drift), rồi anh nhập giá gốc cho 20 sp qua form sửa sản phẩm (VariantEditor cột "Giá gốc") — hoặc gửi bảng slug→giá gốc để tôi SQL một lần.
3. Kiểm tay: card 320/375/414 không tràn; PDP khoảng giá 320px; badge đỏ có "quá Shopee" không.

Raw: `docs/build-feature/shop-discount-badge-seller-entry/` (01-analysis, 02-critics/final, 03-ux-spec, rounds/round1-*, round2-*).

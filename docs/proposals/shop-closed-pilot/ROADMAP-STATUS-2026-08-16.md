# Shop roadmap status — 2026-08-16 (tối)

## Đã lên production

| Mốc | Trạng thái | Bằng chứng |
|---|---|---|
| P1 seller onboarding (hồ sơ, duyệt, pilot allowlist) | ✅ prod | #578 `4ea32d3e` (16/08 sáng) |
| P2a catalog (sản phẩm, variant, tồn kho, media) | ✅ prod | #578 |
| P2b moderation + buyer/public surfaces | ✅ prod | #578 + Wave-0-fixes #580 |
| Seller Rules v1 + Privacy | ✅ áp, hash `fb62bd47…` | effective 14/08 |
| **Nút kích hoạt shop** (RPC `shop_activate` + admin UI) | ✅ prod | #584 `1854cf5c` (16/08 tối), PASS trên iPhone thật |
| **Fix iOS Safari không đăng được ảnh** (JPEG fallback end-to-end) | ✅ prod | #584, verify iPhone thật; edge fn đã fleet-redeploy |
| Polyfill `crypto.randomUUID` (iOS <15.4 sập trang) | ✅ prod | #584 |
| Migration ledger prod | ✅ đồng bộ (2 version mới đã ghi) | script `apply-shop-activate-and-jpeg-prod.sh` |

## Đang diễn ra (16/08 tối)

- Cuong tự onboard tài khoản nội bộ `thepicklehub.net@gmail.com` (đã vào pilot allowlist 13:23Z) → nộp hồ sơ → duyệt → kích hoạt trên prod. Về danh nghĩa vẫn là **Wave 0/nội bộ** — chưa có seller ngoài.
- Indexing /shop: **OFF** (noindex, không sitemap) — đúng lệnh cấm.

## Backlog mới (feedback PO 16/08 tối)

1. **UI polish toàn khu Shop** — PO: "giao diện vẫn đang quá xấu". Cần một vòng design pass riêng (hallmark audit các màn chính: /shop/sell, seller center, admin queue, PDP, public shop) trước khi mời seller ngoài. Chưa lên lịch.
2. **Bulk approve sản phẩm** trong `/admin/shop/products` — duyệt nhiều sản phẩm cùng lúc. PO xác nhận để sau (Wave 1 chỉ 3-5 seller, volume thấp).
3. Admin UI cho pilot allowlist (hiện thêm bằng `scripts/add-shop-pilot-member.sh`).
4. Thumbnail thật trong danh sách sản phẩm seller (hiện chỉ hiện số ảnh — by design P2a).

## Nợ kỹ thuật còn mở

- 🔴 `shops.owner_user_id` lộ qua REST `select=*` cho anon — **bắt buộc xử lý TRƯỚC khi bật indexing** (đã ghi từ pilot).
- B14 delete-account cleanup no-op (có defect doc riêng, không vá bằng grant lẻ).
- Bundle Total headroom 13.6 KB (cạn dần từ trước — cần dọn một đợt).
- pgTAP: thiếu case `restricted` cho `shop_activate`; idempotent-replay chưa snapshot `verified_at`.
- JPEG inspector chấp nhận vùng mù APP1-giữa-scan (chủ đích, ngang mức webp).

## Gate các mốc tiếp theo (thứ tự đã chốt sáng 16/08 — full-build P3a = RED)

1. **Mở Wave 1** (3-5 seller quen thật): PO ký **phễu 3 số + ngưỡng bàn P3a** viết trước + legal review xong. → soak 2-4 tuần.
2. **Bật indexing /shop**: sau Wave 1 ổn + fix `owner_user_id` + PO duyệt.
3. **P3a (giỏ hàng/đơn/thanh toán)**: CHỈ bàn khi soak có tín hiệu chạm ngưỡng. Không build trước.

## Audit trail

`docs/build-feature/shop-activation-button/` · `docs/build-feature/ios-image-upload-fallback/` · `docs/proposals/shop-closed-pilot/` · diff đã ship: `docs/build-feature/review-diff-2026-08-16.patch`

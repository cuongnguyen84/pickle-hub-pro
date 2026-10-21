# Shop roadmap status — 2026-08-17 (sau ship #603)

## Đã lên production (cộng dồn)

| Mốc | Trạng thái | Bằng chứng |
|---|---|---|
| P1 onboarding + P2a catalog + P2b moderation/public | ✅ | #578 `4ea32d3e` + #580 (16/08 sáng) |
| Nút kích hoạt shop (RPC `shop_activate` + admin UI) | ✅ | #584 `1854cf5c` (16/08 tối), PASS iPhone |
| Fix iOS Safari không đăng được ảnh (JPEG fallback end-to-end) | ✅ | #584 — Wave-1 blocker đã gỡ |
| **UI overhaul card-first 5 vòng** (thumbnail thật · dashboard seller · card trắng radius 20/giá đậm/nút tròn · grid 2 cột từ 320px · chip active đen · ShopStore sản phẩm lên fold · hero gradient /shop) | ✅ | **#603 `8f833e5a` (17/08)**, PO chấm từng vòng trên preview + iPhone, CI 8/8, prod verify bundle + smoke 200 |
| **Logo + ảnh bìa shop công khai** (nối publish leg từng bị bỏ trống: migration `20260817090000` + edge `publish_profile` + client auto-publish + storefront render) | ✅ | trong #603; prod DB + edge đã áp; logo/cover shop ThePickleHub live |
| Ledger migration prod | ✅ đồng bộ (3 version mới 16-17/08 đều ghi) |
| Indexing /shop | 🔒 OFF đúng lệnh (noindex, không sitemap) |

Hạ tầng vận hành pilot: pilot allowlist qua `scripts/add-shop-pilot-member.sh` (Wave 1 hiện có 1 thành viên: thepicklehub.net@gmail.com — shop nội bộ, đã active, có sản phẩm + logo/bìa).

## 🔴 Chặn Wave 1 (phải xong TRƯỚC khi mời seller ngoài)

1. **Bug nút "Đưa lên trang shop" trên iOS Safari (PO tái hiện 17/08)** — server chứng minh khỏe từng khúc (prepare trả plan đúng dưới danh tính seller, source objects đúng chỗ, edge fn phản hồi đúng probe); click từ iPhone không thấy tới gateway; log prod `function_edge_logs` ghi thiếu nặng nên không kết luận từ absence. Workaround: `scripts/publish-shop-profile-media-manually.sh`. Việc tiếp: repro Chrome desktop + bắt console iPhone.
2. **Gate PO chưa ký** (không đổi từ 16/08): phễu 3 số + ngưỡng bàn P3a viết trước + legal review xong.
3. `owner_user_id` lộ qua REST anon — bắt buộc trước khi bật indexing (chưa chặn Wave 1 vì noindex, nhưng nằm trên đường tới indexing).

## Backlog (không chặn)

- Bulk-approve sản phẩm admin (PO đã hoãn) · admin UI pilot allowlist · pill suspended rỗng + filter đếm sai (bug có sẵn P2b, chờ PO chốt chữ) · nút "Nhắn Zalo" chờ PO duyệt URL `zalo.me/2932845421782592643` · capture visual baseline (/shop, /shop/sell đã vào spec) · monogram 22px PDP · gate pending-cleanup theo shop state cả 2 arm media (P3 từ review) · test-hardening aria-label 1 dòng · **bundle Total headroom còn ~9 KB — cần đợt dọn riêng trước feature JS lớn kế tiếp** · fixture QA nên seed ảnh thật · B14 delete-account (defect doc riêng).

## Trình tự phía trước (đã chốt từ 16/08 — full-build P3a = RED, không đổi)

1. **Fix bug nút publish iOS** → 2. **PO ký gate** (phễu 3 số + ngưỡng P3a + legal) → 3. **Mở Wave 1**: 3-5 seller quen (thêm vào allowlist bằng script), soak 2-4 tuần đo phễu → 4. Theo tín hiệu: nới moderation (auto-approve shop uy tín?), bật indexing (sau fix owner_user_id), rồi mới bàn **P3a giỏ hàng/đơn/thanh toán**.

## Audit trail
`docs/build-feature/shop-activation-button/` · `docs/build-feature/ios-image-upload-fallback/` · `docs/build-feature/shop-ui-polish/` (5 vòng) · bản 16/08: `ROADMAP-STATUS-2026-08-16.md`.

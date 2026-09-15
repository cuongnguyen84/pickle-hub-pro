# Shop native — roadmap & checklist

**Cập nhật:** 2026-08-18  
**Nguyên tắc:** chỉ đánh dấu hoàn thành khi build/test tương ứng đã pass.

## Milestone hiện tại — B01 sample review

- [x] Đọc và đối chiếu contract P2a.1–P2a.5.
- [x] Tạo buyer domain model cho category, seller, product, media và variant.
- [x] Giữ invariant giá VND là `Int`; giá/tồn nằm ở variant.
- [x] Tạo `ShopRepository` protocol và deterministic fixture repository.
- [x] Dựng B01 Shop Home bằng SwiftUI.
- [x] Thêm entry Shop pilot từ Home; không thêm tab thứ sáu.
- [x] Có loading, empty và error state ở B01.
- [x] Có search affordance, category rail, product rail và verified seller section.
- [x] Build Swift 6 pass (`xcodebuild`, iPhone 17 / iOS 26.2).
- [x] Unit tests Shop pass (4/4).
- [x] Chụp giao diện trên iPhone 17 simulator (`docs/screenshots/shop-b01-sample-iphone17.png`).
- [ ] Product Owner duyệt visual direction.

### Hallmark V2

- [x] Chạy audit độc lập trên screenshot V1: 1 critical · 3 major · 3 minor.
- [x] Bỏ Specimen fall-through và số chương 01/02/03.
- [x] Thu gọn masthead để sản phẩm xuất hiện sớm hơn.
- [x] Chuyển category tile thành compact category rail.
- [x] Chuyển “Xem tất cả” thành control thật.
- [x] Tăng product-card hierarchy và giảm eyebrow lặp lại.
- [x] Build/test lại V2 — 4/4 shop foundation tests pass.
- [x] Chụp screenshot V2 trên iPhone 17.
- [ ] Product Owner duyệt V2.

### Hallmark V3 — sport editorial

- [x] Thay macro-layout catalog bằng campaign cover thể thao.
- [x] Tạo hero tương phản cao, CTA tìm kiếm và commerce rail.
- [x] Build/test lại — 4/4 shop foundation tests pass.
- [x] Chụp preview vào file ổn định trong repository.
- [ ] Product Owner duyệt art direction V3.

### Hallmark V4 — compact commerce feed

- [x] Study DNA từ ảnh tham khảo: header gọn, hero photographic thấp, commerce rail.
- [x] Tạo hero pickleball riêng, không sao chép imagery trong ảnh tham khảo.
- [x] Giảm hero còn 190pt và đưa mục Nổi bật lên trong viewport đầu.
- [x] Chuyển danh mục xuống sau rail sản phẩm theo nhịp commerce.
- [x] Build/test lại — 4/4 shop foundation tests pass.
- [x] Chụp preview V4 vào file ổn định trong repository.
- [ ] Product Owner duyệt art direction V4.

### V4.1 — category-first baseline

- [x] Giảm hero từ 190pt xuống 156pt.
- [x] Đưa bốn danh mục chính vào viewport đầu.
- [x] Giữ phần mở đầu của rail Nổi bật trong viewport đầu.
- [x] Build/test lại — 4/4 shop foundation tests pass.
- [x] Chụp preview V4.1 vào file ổn định trong repository.
- [x] Product Owner xác nhận hướng category-first; dùng làm baseline Buyer UI.

## N0 — Foundation

- [x] Models tối thiểu cho B01–B05.
- [x] Repository abstraction.
- [x] Fixture catalogue.
- [x] Money formatter và variant matching tests.
- [x] Feature flag hai lớp cho pilot (capability + release activation, fail-closed; Release mặc định tắt).
- [x] Public DTO/RPC contract matrix (`docs/shop-native-c1-contract-matrix.md`, snapshot P2b `7b52cc37`).
- [x] Shop deep links.
- [x] `SupabaseShopRepository` production read-only, chỉ dùng bốn public RPC; không query private table.

## N1 — DesignSystem Shop

- [x] B01 dùng lại `TLColor`, `TLType`, `TLSpacing`, `TLRadius`.
- [x] Product card mẫu.
- [x] Seller verification presentation mẫu.
- [x] Tách commerce semantic tokens nền tảng (surface/action/verified/unavailable/touch target).
- [x] Product media component production dùng approved rendition loader và stable fallback.
- [x] Variant selector component.
- [x] Stock/availability presentation component (không bịa số lượng).
- [x] Wishlist/quantity/sticky commerce components.
- [x] Component state matrix và automated accessibility render tests.

## N2 — Buyer discovery

- [x] B01 Shop Home — V4.1 category-first baseline đã được chốt.
- [x] B02 Search — fixture-complete.
  - [x] Navigation từ B01 search và category shortcuts.
  - [x] Repository-backed query với debounce/cancellation.
  - [x] Loading, error và zero-result states.
  - [x] Grid hai cột, category chip và sort sheet native.
  - [x] Facets chung: category, condition, verified seller, availability và sort.
  - [x] State được giữ bởi native navigation; screenshot B02 đã chụp.
- [ ] B03 Category/filter/sort — attribute facets sinh từ catalogue và applied chips đã xong; chờ public facet vocabulary/C1 để khóa controlled vocabulary.
- [x] B04 Product Detail — nối C1 public product/media/contact; variant `mediaID` phản ánh vào gallery state.
- [x] B05 Variant Sheet — variant selection đã nối nút thêm vào giỏ production C3.
- [x] B06 Store Detail — nối C1 public shop/contact và product-card summaries.
- [ ] B07 Wishlist shell/auth gate — shell và auth gate đã xong; chờ persistence contract C2.

### N2 hardening — fixture-backed

- [x] B03 sinh attribute facets từ catalogue, không hardcode facet values trong View.
- [x] Applied category/attribute filters tháo được từng chip.
- [x] B04 phản ánh variant `mediaIndex` vào gallery state.
- [x] B05 giữ tổ hợp hết hàng nhìn thấy nhưng disabled và có accessibility label.
- [x] B06 hiển thị verification disclaimer và không lộ private seller fields.
- [x] Chụp review B03, B05 và B06 trên iPhone 17.
- [x] 9/9 Shop foundation tests pass.

### Native integration hardening

- [x] Approved rendition loader dùng ephemeral session và bỏ persistent URL cache để hỗ trợ thu hồi media.
- [x] Chỉ chấp nhận HTTP 2xx, MIME `image/*` và payload trong giới hạn.
- [x] B01–B04 và B06 dùng remote-image component với fallback ổn định.
- [x] Universal/custom deep links cho shop home, search, category, product và store.
- [x] Product/store deep link resolve bằng slug qua repository contract.
- [x] Native navigation giữ query/filter/scroll state khi push/pop trong cùng session.
- [x] Scenario repository cung cấp normal/empty/unavailable cho UI review và tests.
- [x] 20/20 tests pass trong Shop foundation, image policy và deep-link suites.

### Context note — 2026-08-12

- [x] Native media contract dùng `mediaID`, `position`, logo/cover và `coverFocalY`.
- [x] Native approved-image loader sẵn sàng cho `public_path` và thu hồi rendition.
- [x] Scenario repository khóa empty/unavailable states.
- [x] 20/20 targeted native regression tests pass.
- [x] Context handoff được lưu tại `docs/shop-native-context-handoff.md`.
- [x] P2a implementation complete — Product Owner acceptance PASS locally (7/7 checkpoint, 12/12 PO tests).
- [x] 21/21 targeted native regression tests pass sau semantic component extraction.
- [x] Shop components render ở 320/375/414/768pt và Accessibility 3; grid/hero/sticky bar thích ứng Dynamic Type.
- [x] Normal/empty/unavailable presentation-state regression coverage.
- [x] Analytics protocol/event schema có privacy guard; chưa nối production transport.
- [x] Increase Contrast + Accessibility Extra Large visual QA trên iPhone 17 simulator; settings đã được khôi phục.
- [x] Reduce Motion code audit: Shop không có animation bắt buộc; numeric content transition không gắn animation.
- [ ] Manual VoiceOver reading order trên simulator/device.

## Contract-gated work

- [x] P2a.6 media upload/logo/cover hoàn thành trên web.
  - [x] Native model đã đổi variant mapping từ index sang `mediaID` theo composite FK thật.
  - [x] Native media giữ `position`; ảnh chính được suy ra từ position 0.
  - [x] Native seller contract đã có logo, cover và `coverFocalY`.
  - [x] Buyer tải approved `public_path` sau P2b/C1; không đọc draft/original private.
- [x] P2a.7 preview/submit review — hoàn thành và nghiệm thu local trong gói P2a.
- [x] C1/P2b acceptance cuối — Product Owner acceptance PASS locally.
- [x] N3 preparation: public DTOs, four-RPC transport interface và leakage/path decoding guards.
- [x] 32/32 targeted native tests pass sau P2b DTO/transport preparation.
- [x] 35/35 targeted native tests pass sau feature gate hai lớp.
- [x] Bật public RPC repository vào Buyer UI; review hooks giữ fixture tách biệt, không fallback khi RPC lỗi.
- [x] Align contract native với `feat/shop-production-phase-2b` @ `7b52cc37` trước khi nối dữ liệu thật.
- [x] Anonymous local integration: 4/4 public RPC HTTP 200 và đúng empty/not-found shape trên DB sạch.
- [x] 39/39 targeted native tests pass sau N3 public repository integration.
- [x] Cursor pagination (`created_at + id`) cho search/category/store, chống duplicate khi append.
- [x] Public catalogue cache 5 phút + stale-if-error tối đa 24 giờ; UI gắn nhãn offline.
- [x] Pull-to-refresh bỏ qua fresh cache; search debounce/cancellation giữ nguyên.
- [x] 41/41 targeted native tests pass sau pagination/cache/offline hardening.
- [x] Production C1 verification 17/08: bốn public RPC HTTP 200; search có dữ liệu; product/shop public contract PASS, không lộ draft media hoặc `stock_on_hand`.
- [x] Full native test target 199/199 pass; Debug/Release build và private-table scan xanh.
- [ ] C2 wishlist contract pass.
- [x] C3 Phase 3 cart/order contract có trên production; native đã khóa theo snapshot `feat/shop-phase-3`.
- [ ] C4 Phase 3b order/support contract pass.
- [x] C5 Phase 4 VietQR/manual reconciliation được Product Owner duyệt và có trên production.

### P3 preparation — sau closed pilot

- [x] Phase 0–2 hoàn thành production; P2b production indexing OFF.
- [x] Quyết định 17/08: P3a full-build tiếp tục bị khóa tới sau Wave 1 soak 2–4 tuần và Product gate.
- [x] Audit xác nhận checkout hiện tại chưa có C2/C3 migration, RPC, RLS hoặc pgTAP; không đoán contract.
- [x] `ShopVariantSelection` presentation reducer + 7 regression tests; đã nối vào PDP/variant sheet.
- [x] B07 dùng explicit loading/empty/loaded/unavailable states; production mặc định unavailable chờ C2.
- [x] Xóa saved fixture/local removal giả và các wishlist button action rỗng khỏi production catalogue/PDP.
- [x] `ShopProductSummaryRow` dùng public card summary, không fabricate variant/seller-private data.
- [x] Bỏ quantity selector dựa trên public `stockOnHand`; checkout phải revalidate phía server sau C3.
- [x] P3-preparation targeted integration: 26/26 PASS.
- [x] Buyer Shop card-first đồng bộ production #603: Home/Search/Category/Store dùng card 1:1, grid 2 cột, title 2 dòng, chỉ gắn cờ hết hàng; Home bỏ hero marketing và đưa “Mới đăng” lên trước fold.
- [x] Regression 17/08: PDP gallery render đủ media bằng pager vuốt/chấm chọn thật; Store luôn hiển thị CTA contact đã duyệt hoặc trạng thái trung thực khi chưa có contact.
- [x] Full native regression 211/211 PASS + Release build PASS.
- [x] Product duyệt native closed-pilot 17/08; Release artifact gate chuyển sang `YES/YES`. Chưa upload hoặc phân phối artifact.

### Native N4/B08 — 18/08

- [x] `ShopCartRepository` tách khỏi public catalogue repository; chỉ authenticated mutation `shop_cart_items` và read `shop_cart_view`.
- [x] PDP chọn variant + qty 1–10 và thêm vào giỏ; signed-out mở login.
- [x] Cart entry trong toolbar; màn giỏ nhóm theo shop, sửa qty, bỏ dòng, giá/phí hiện tại và unavailable reason do server cấp.
- [x] Contract decode + variant regression: 9/9 PASS; Debug simulator build PASS.
- [ ] Authenticated production smoke B08.
- [x] B09 checkout/idempotent `shop_order_create` + conflict presentation nền tảng.

### Native B09/B10 + Phase 4 — 18/08

- [x] Checkout theo từng shop; gửi đủ 8 tham số `shop_order_create`, giữ một `client_token` xuyên suốt retry thủ công.
- [x] Server tiếp tục là authority cho giá, phí ship, tồn kho và one-shop invariant.
- [x] Order detail đọc projection RLS-safe, không chọn `buyer_user_id`, `client_token` hoặc `payment_confirmed_by`.
- [x] `shop_order_payment_info` + `shop_order_claim_payment` đã nối; seller confirm có trong repository contract nhưng không dựng seller UI trong buyer native.
- [x] VietQR dùng đúng amount/memo server; thiếu bank hiển thị honest fallback; QR/claim không được gọi là đã thanh toán.
- [x] 12/12 cart + variant + Phase 4 contract tests PASS; Debug build PASS.
- [ ] Authenticated production smoke create/order/payment claim.
- [ ] Quét QR bằng app ngân hàng trên thiết bị thật và đối chiếu exact amount/memo.

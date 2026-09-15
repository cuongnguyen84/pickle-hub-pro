# Shop native iOS — context handoff

**Cập nhật:** 2026-08-18  
**Workspace:** `/Users/cm10/pickle-hub-pro/apple`  
**Branch / HEAD lúc ghi:** `feat/shop-production-phase-1` @ `433610ae`  
**Trạng thái:** Product xác nhận Phase 3 và Phase 4 đã xong production ngày 18/08. Native buyer đã triển khai local cart → checkout → order detail → VietQR/manual reconciliation, chờ authenticated production/device smoke.

## Prompt tiếp tục sau khi xoá context

> Đọc `docs/shop-native-context-handoff.md`, `docs/shop-native-roadmap-handoff.md` và `docs/shop-native-checklist.md`; kiểm tra worktree hiện tại rồi tiếp tục production smoke B08–B10/P4. Không reset/checkout thay đổi của user, deploy hoặc push.

## Quyết định Product đang hiệu lực

- Phase 0–2 web đã hoàn thành production; P2b chạy thật, indexing OFF.
- Native dùng SwiftUI; Buyer đi native, Seller/Admin tiếp tục web trong MVP.
- Shop mở từ Home/deep link, không thêm tab thứ sáu.
- Native Release closed-pilot đã được duyệt ngày 17/08:
  - `SHOP_NATIVE_BUILT_IN = YES`
  - `SHOP_NATIVE_PILOT_ENABLED = YES`
- Đây mới là build/test simulator; chưa archive, upload TestFlight hoặc phân phối.
- Phase 3 cart/order và Phase 4 bank-transfer contract đã có trên production.
- Phase 4 là VietQR + manual reconciliation, không phải payment gateway/webhook.
- Wishlist vẫn chờ C2 riêng.

## Implementation Shop hiện tại

- `Core/Shop`
  - Public models/DTOs, C1 API/repository, cache/pagination, feature gate, analytics schema.
  - `SupabaseShopRepository` chỉ gọi `shop_public_search`, `shop_public_categories`, `shop_public_product`, `shop_public_shop`.
  - Không query private Shop tables và không silent-fallback sang fixtures.
  - `ShopVariantSelection` là reducer presentation-only; không coi public stock là checkout authority.
- `Features/Shop`
  - B01 Home, B02 Search, B03 Category, B04 PDP, B05 Variant, B06 Store hoàn thành trong phạm vi C1.
  - Buyer UI đã đồng bộ card-first production #603: ảnh 1:1, grid hai cột, title hai dòng, chỉ gắn cờ hết hàng, Home không còn marketing hero.
  - B07 Wishlist chỉ có honest unavailable/auth shell; entry production đang ẩn, không persistence.
- `DesignSystem/Shop`
  - Semantic media/price/availability/verification/card/variant/commerce components.

## Hai finding nghiệm thu mới nhất và bản sửa

### PDP gallery

- Production RPC trả đủ 3 media cho sản phẩm test, nhưng native cũ chỉ render ảnh đầu; indicator chỉ trang trí.
- Đã sửa `ShopProductDetailView.swift` thành `TabView` pager:
  - vuốt ngang được;
  - chấm ảnh bấm được;
  - có bộ đếm `1/3`;
  - VoiceOver có “Ảnh n trên 3”;
  - chọn variant có `mediaID` sẽ chuyển đúng media.

### Contact CTA

- Read-only production audit trả `product_contacts=0` và `shop_contacts=0` cho fixture thật hiện tại.
- Không được dựng link từ email/phone riêng.
- PDP sau khi chọn đủ variant sẽ báo `Chưa có kênh liên hệ` nếu không có approved contact.
- Store luôn dành vùng contact rõ ràng: có contact thì hiện nút toàn chiều ngang; chưa có thì hiện `Shop chưa công bố kênh liên hệ`.

## Verification gần nhất

- Anonymous production C1 smoke: 4/4 RPC HTTP 200; search có dữ liệu; product/shop public contract PASS.
- Public boundary PASS: media dùng `public_path`, không draft/original, variant không lộ `stock_on_hand`.
- Full native regression sau gallery/contact fix: **211/211 PASS**.
- Release simulator build: **PASS**.
- Artifact trước finding đã xác nhận `ShopNativeBuiltIn=YES`, `ShopNativePilotEnabled=YES`; Release config hiện vẫn `YES/YES`.
- `git diff --check`: PASS.
- Simulator đang dùng: iPhone 17 Pro, iOS 26.2, id `44A3900E-0C23-4CD4-ABA6-41B3B17F8792`.
- Có hai warning localization `%lld` sẵn có ngoài Shop; không làm build fail.

## Next actions

1. Product chạy lại manual simulator acceptance:
   - PDP vuốt/bấm đủ các ảnh;
   - variant-media swap;
   - Store thấy contact CTA hoặc honest no-contact state;
   - khi web/Admin duyệt contact thật, xác minh native tự hiện link public.
2. Chạy manual VoiceOver reading-order QA; automated Dynamic Type/render đã pass.
3. Nếu Product yêu cầu phân phối closed-pilot: chuẩn bị archive/TestFlight là bước riêng, phải xác nhận trước khi upload.
4. Chạy authenticated production smoke B08–B10 và P4 buyer claim; không dùng đơn thật ngoài fixture nghiệm thu.
5. Quét VietQR trên device thật và seller confirm bên web để kiểm end-to-end timestamp.

## Lệnh verification

```sh
xcodegen generate

xcodebuild test \
  -project ThePickleHub.xcodeproj \
  -scheme ThePickleHub \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.2' \
  -quiet

xcodebuild build \
  -project ThePickleHub.xcodeproj \
  -scheme ThePickleHub \
  -configuration Release \
  -destination 'generic/platform=iOS Simulator' \
  -quiet

git diff --check
```

## Worktree safety

- Worktree dirty và có nhiều thay đổi của user ngoài Shop.
- Nhiều file Shop/docs/tests đang untracked; chưa tự ý commit.
- Không reset, checkout hoặc xóa hàng loạt.
- Review kỹ các file shared như `HomeView.swift`, `AppTabView.swift`, `DeepLink.swift`, `DeepLinkTests.swift` trước khi commit.
- `Config/Release.xcconfig` còn có version/build-number changes của user; chỉ thay đổi Shop gate trong phạm vi công việc này.

## Tài liệu liên quan

- `docs/shop-native-roadmap-handoff.md` — roadmap/gates chính thức.
- `docs/shop-native-checklist.md` — checklist chi tiết.
- `docs/shop-native-parallel-plan.md` — kiến trúc N0–N7.
- `docs/shop-native-c1-contract-matrix.md` — contract C1.

# Shop native iOS — roadmap handoff

**Cập nhật:** 2026-08-18  
**Workspace:** `/Users/cm10/pickle-hub-pro/apple`  
**Branch / HEAD lúc ghi:** `feat/shop-production-phase-1` @ `433610ae`  
**Trạng thái tổng:** Web/backend Phase 3 và Phase 4 đã hoàn thành production theo xác nhận Product ngày 18/08. Native đã nối B08 cart, B09 checkout, B10 order detail và P4 VietQR/manual reconciliation theo contract thật.

## Prompt gọi lại ở phiên sau

> Đọc `docs/shop-native-roadmap-handoff.md`, kiểm tra worktree hiện tại, rồi tiếp tục từ mục **Next executable action**. Không deploy/merge/push, không ghi đè thay đổi không liên quan và không bắt đầu C2/C3/C4/C5 nếu contract hoặc Product gate chưa pass.

## Phạm vi sản phẩm đã chốt

- App native dùng SwiftUI.
- Buyer B01–B15 đi native; Seller/Admin tiếp tục dùng web trong MVP.
- Shop mở từ Home và deep link, không thêm tab thứ sáu.
- Visual baseline: V4.1 category-first compact commerce feed.
- Buyer chỉ đọc approved public rendition và public RPC; không đọc bảng/private draft/original.
- Không bịa rating, sold count, discount, tồn kho hoặc delivery promise.

## Roadmap native

| Giai đoạn | Nội dung | Trạng thái | Gate/phụ thuộc |
| --- | --- | --- | --- |
| N0 | Models, repository abstraction, fixtures, feature gate, deep links | ✅ Hoàn thành | — |
| N1 | Commerce tokens/components và accessibility render coverage | ✅ Hoàn thành | Manual VoiceOver còn là QA người thật |
| N2 / B01–B06 | Home, search, category, PDP, variant UI, store | ✅ Hoàn thành trong phạm vi C1; card-first đồng bộ UI buyer production #603 | B03 controlled facet vocabulary chưa có trong C1; cart thật chờ C3 |
| N2 / B07 | Wishlist shell + auth gate | 🟡 Honest states hoàn thành, entry ẩn | P3a/Wave gate + C2 |
| N3 | Supabase public repository, pagination, cache/offline, security guards | ✅ Hoàn thành; production C1 smoke PASS | — |
| B08 | Cart native | 🟡 Đã nối contract + UI local; chờ authenticated production smoke | C3 production |
| B09–B10 | Checkout, order detail | 🟡 Đã nối local; chờ authenticated production smoke | C3 production |
| B11–B15 | Orders, support | ⏳ Chưa bắt đầu | C4 |
| P4 payment | VietQR + đối soát tay | 🟡 Native đã nối local; chờ device/prod smoke | C5 production |

## Implementation đã có

- Hai-key feature gate: `ShopNativeBuiltIn` + `ShopNativePilotEnabled`, dùng đồng nhất ở Home, deep links và review hooks; Release đã được Product bật `YES/YES` ngày 17/08 và vẫn fail-closed nếu thiếu/sai giá trị.
- `SupabaseShopRepository` chỉ gọi bốn C1 public RPC:
  - `shop_public_search`
  - `shop_public_categories`
  - `shop_public_product`
  - `shop_public_shop`
- Search/category/store có cursor pagination `created_at + id` và chống duplicate.
- Public catalogue cache: fresh 5 phút, stale-if-error tối đa 24 giờ; pull-to-refresh bỏ qua fresh cache; UI báo offline.
- Product/store slug resolution hỗ trợ redirect một hop.
- Media/contact guard chặn private path, draft/original, credential, query và fragment không hợp lệ.
- Review/screenshot hooks dùng fixture riêng; luồng app thường dùng Supabase và không silent fallback về fixture.
- B01–B06 đã nối public read contract; B07 chỉ là shell/auth gate.
- B07 production không còn hiển thị saved fixture hoặc thao tác bỏ lưu giả; mặc định báo unavailable cho tới C2, fixture chỉ được inject rõ ràng trong review/test.
- `ShopVariantSelection` là reducer presentation-only đã nối vào PDP: xóa lựa chọn phụ thuộc bị stale, giữ mapping variant/media nguyên tử và không coi public stock là checkout authority.
- Product card/PDP không còn nút wishlist action rỗng; quantity selector dựa vào public `stockOnHand` đã được bỏ khỏi lead-gen variant sheet.
- `ShopProductSummaryRow` dùng đúng public card summary, không fabricate full product/variant cho wishlist/list surfaces.

## Verification gần nhất

- Targeted Shop baseline trước tranche: **41/41 PASS**.
- Tranche P3 preparation: **26/26 targeted PASS** (7 variant reducer + 14 foundation + 5 render).
- Full native target sau tranche card-first: **211/211 PASS**.
- Release simulator build: **PASS**; Product đã duyệt bật native closed-pilot ngày 17/08, artifact gate là `ShopNativeBuiltIn=YES`, `ShopNativePilotEnabled=YES`.
- Anonymous production C1 smoke ngày 17/08: bốn RPC public đều HTTP 200; search có dữ liệu thật; product/shop contract PASS, media chỉ dùng `public_path` và không lộ `stock_on_hand`.
- Debug build: PASS.
- Release build: PASS; artifact gate xác nhận capability và pilot activation đều bật.
- Local Supabase anonymous smoke: cả bốn RPC HTTP 200 trên DB local sạch, đúng empty/not-found shape.
- Private-table scan và `git diff --check`: PASS.
- Simulator chuẩn: iPhone 17 / iOS 26.2, id `5A44903A-DF46-4016-9903-33CBF05FD3F5`.

## Trạng thái môi trường liên quan

- Web P2a: Product Owner acceptance PASS locally.
- Web P2b: Product Owner acceptance PASS locally.
- Closed-pilot foundation: hoàn thành local.
- Cloudflare staging: đã tạo và deploy.
- Closed pilot: **đã hoàn thành**; P2b chạy production, indexing OFF.
- Wave 0 nội bộ đang chạy; Wave 1 chờ web fix/gate vận hành theo báo cáo Product 17/08.
- Phase 3 production đã cung cấp `shop_cart_items`, `shop_cart_view`, `shop_order_create`, order transition/read models và stable error reasons.
- Native B08 dùng repository mutation tách khỏi public `ShopRepository`, auth gate, qty 1–10, cart nhóm theo shop và trạng thái unavailable từ server.
- Phase 4 VietQR/manual reconciliation đã có production; không có gateway/webhook/auto-reconciliation.

Thông tin `PGRST202` staging trong snapshot 13/08 đã lỗi thời sau closed pilot. Anonymous C1 smoke trên đúng production project đã PASS ngày 17/08. Product đã ký activation native Release ngày 17/08; việc upload/phân phối artifact vẫn là bước riêng.

## Next executable action

### 1. Việc làm được ngay, không cần backend contract mới

1. Kiểm tra lại worktree và giữ nguyên mọi thay đổi không thuộc Shop.
2. Full regression + Release build cho tranche P3 preparation đã PASS; chạy lại khi code/config tiếp tục đổi.
3. Có thể thực hiện manual VoiceOver reading-order QA trên simulator/device và ghi kết quả; không đổi contract.
4. ✅ C1 anonymous smoke read-only trên production đã PASS; Release pilot flag đã được Product duyệt và bật ngày 17/08.

### 2. Next native commerce action

1. Chạy authenticated production smoke cho B08: add → increment → cart view → remove, trên buyer test; không tạo đơn ngoài dữ liệu test.
2. Chạy authenticated smoke B09: idempotent create, một shop một đơn và các conflict giá/phí/tồn.
3. Chạy P4 device smoke: quét VietQR thật, buyer claim idempotent và seller confirm trên web; xác minh native chỉ báo confirmed sau server timestamp.
4. C2 wishlist vẫn là lát cắt riêng, không nhồi vào cart repository.
5. Không gọi VietQR là cổng thanh toán: Phase 4 production vẫn là chuyển khoản và đối soát thủ công.

### 3. Điểm phải dừng chờ quyết định

- Nếu staging chưa có bốn RPC: dừng remote acceptance, báo blocker; không sửa app để fallback private table/fixture.
- Không triển khai wishlist persistence khi C2 chưa chốt.
- Không đổi/đoán RPC/DTO/error code ngoài snapshot Phase 3 production.
- C4 chưa chốt: không triển khai order/support state machine.
- Không tự mở/tắt indexing hoặc thay đổi production flags nếu chưa có yêu cầu vận hành riêng.
- Không deploy migration, merge PR, push, bật production pilot hoặc chạy Wave 0 nếu chưa có yêu cầu rõ ràng.

## Lệnh verification

```sh
xcodegen generate

xcodebuild test \
  -project ThePickleHub.xcodeproj \
  -scheme ThePickleHub \
  -destination 'platform=iOS Simulator,id=5A44903A-DF46-4016-9903-33CBF05FD3F5' \
  CODE_SIGNING_ALLOWED=NO

xcodebuild build \
  -project ThePickleHub.xcodeproj \
  -scheme ThePickleHub \
  -configuration Release \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO

git diff --check
```

Targeted suites quan trọng: `ShopFeatureGateTests`, `ShopFoundationTests`, `ShopImagePolicyTests`, `DeepLinkTests`, `ShopComponentsRenderTests`, `ShopAnalyticsTests`, `ShopPublicContractTests`, `SupabaseShopRepositoryTests`.

## Worktree safety

- Worktree đang dirty, gồm cả thay đổi của user ngoài Shop; không reset/checkout/delete hàng loạt.
- Nhiều file Shop/docs/tests đang untracked; không tự ý commit hoặc gom chung với thay đổi khác.
- Review diff kỹ ở `HomeView.swift`, `AppTabView.swift`, `DeepLink.swift` và `DeepLinkTests.swift` vì có thể chứa thay đổi đồng thời của user.
- Luôn dùng public RPC cho Buyer; không query private shop tables.

## Tài liệu nguồn

- `docs/shop-native-context-handoff.md` — snapshot implementation chi tiết.
- `docs/shop-native-checklist.md` — checklist và contract gates.
- `docs/shop-native-parallel-plan.md` — kiến trúc/roadmap N0–N7.
- `docs/shop-native-c1-contract-matrix.md` — mapping C1/P2b cho native.
- `docs/screenshots/` — visual evidence B01–B06.

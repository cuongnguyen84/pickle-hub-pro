# ThePickleHub Shop — Screen-by-Screen Task Board

> **Review target:** Product-owner visual review  
> **Source specification:** [`shop-marketplace-plan.md`](./shop-marketplace-plan.md)  
> **Mode:** Prototype/UI first. No production payment, payout or irreversible migration work.  
> **Design direction:** The Line · sport-performance · utilitarian · mobile-first · Vietnamese-first  
> **Status legend:** `[ ]` not started · `[-]` in progress · `[x]` ready for product-owner review

---

## 0. Rules for Claude Code

1. Read the source specification completely before starting.
2. Inspect and reuse existing The Line tokens, layout and UI primitives.
3. Build shared foundations before individual screens.
4. Do not create fake seller counts, ratings, sold counts, discounts, delivery promises or inventory.
5. Use deterministic fixture data labeled as prototype data.
6. Do not connect a real payment provider.
7. Do not create or apply production database migrations during the screen-design batch.
8. Keep prototypes behind an isolated preview/dev route or Storybook-equivalent mechanism that cannot be indexed or mistaken for production.
9. Before editing, provide the product owner with the exact files to create/modify/delete. Deletions require explicit approval.
10. Every completed task includes screenshots at the specified widths and a short interaction-state checklist.

### Global done criteria

- Vietnamese copy fits without truncating primary actions.
- No page-level horizontal scrolling at 320, 375, 414 and 768 px.
- All touch targets are at least 44×44 px.
- Focus-visible is obvious and keyboard order matches visual order.
- Loading, empty, error, disabled and success states are represented where relevant.
- Reduced-motion behavior is implemented.
- Product image spaces reserve dimensions.
- Seller identity remains visible at commercial commitment points.
- Raw colors/fonts are not improvised inside screen components.
- Screens look native to ThePickleHub, not like copied Shopee/Amazon pages.

---

## 1. Delivery batches

| Batch | Purpose | Tasks | Product-owner checkpoint |
| --- | --- | --- | --- |
| F | Shared design foundation | F01–F08 | Tokens, shell and components approved |
| B1 | Buyer discovery | B01–B07 | Browse/search/product experience approved |
| B2 | Buyer transaction/support | B08–B15 | Cart/checkout/order/trust experience approved |
| S1 | Seller onboarding | S01–S04 | Seller acquisition and approval status approved |
| S2 | Seller operations | S05–S10 | Listing/order operations approved |
| A | Administration | A01–A05 | Review/moderation/dispute UX approved |
| Q | Cross-screen validation | Q01–Q06 | Final UI prototype sign-off |

Recommended sequence:

```text
F → B1 → S1 → S2 → B2 → A → Q
```

B2 waits until product/variant semantics from S2 are stable. Admin tasks wait until seller application and order/dispute models are represented in prototypes.

---

## 2. Shared foundation tasks

### [x] F01 — Prototype environment and fixtures

**Depends on:** none

**Deliver:**

- Isolated non-indexable preview entry.
- Fixture factories for shop, product, variants, cart, application, order, return and dispute.
- Explicit `prototype` labeling in development navigation.
- Fixture scenarios: normal, empty, slow, error, suspended, unavailable and permission denied.

**Do not:** put fixture data into production Supabase tables.

**Review evidence:** preview URL/command and fixture scenario index.

**Đã dựng:** `/proto/shop` (lazy chunk riêng, không link từ đâu trong sản phẩm). Chặn index 3 lớp: thẻ noindex + `Disallow: /proto` ở `public/robots.txt` và `functions/robots.txt.ts` + `NOINDEX_PATTERNS` trong `functions/_middleware.ts`. Fixture cố định ở `src/proto/shop/fixtures.ts` (shop, product, variant, cart, application, order, return, dispute) — không Math.random, không Date.now. 7 kịch bản qua `?scenario=` (`normal|empty|slow|error|suspended|unavailable|denied`), đổi bằng ô chọn trên thanh vàng. Điều hướng bản mẫu = trang chỉ mục tại `/proto/shop`. Không ghi gì vào Supabase.

### [x] F02 — Shop design tokens

**Depends on:** F01

**Deliver:**

- Mapping to existing The Line colors, font, spacing, radii, rules and motion.
- Commerce semantic tokens for price, discount, stock, verified, warning and destructive states.
- Light/dark contrast validation.
- No new global font.

**Review evidence:** token specimen at 375 and 1440 px.

**Đã dựng:** `src/proto/shop/shop.css` — 9 token thương mại, mỗi cái là alias của một token The Line (`--shop-danger: var(--tl-live)`…), không màu mới, không font mới. Màn `/proto/shop/tokens` tự **đo tương phản trực tiếp trên DOM**: 13/13 cặp đạt WCAG AA cả nền tối lẫn nền sáng, có nút chuyển 2 chế độ ngay trên trang.

### [x] F03 — Shop shell and responsive navigation

**Depends on:** F02

**Deliver:**

- Buyer Shop header/search/cart context.
- Seller Center responsive shell.
- Shop Admin integration proposal using current AdminLayout.
- Correct safe-area and existing bottom-nav clearance.
- No sixth bottom-nav item.

**Review evidence:** buyer/seller/admin shells at 375, 768 and 1440 px.

**Đã dựng:** `src/proto/shop/components/Shells.tsx` — `BuyerShell` / `SellerShell` / `AdminShopFrame`. Xem tại `/proto/shop/shells?variant=buyer|seller|admin`. Không thêm mục thứ 6 vào BottomNav: trang mua hàng nằm DƯỚI thanh 5 mục sẵn có, `/seller/*` vào danh sách ẩn giống `/creator`. Admin = **1 mục cha + 3 mục con** trong `AdminLayout` (sidebar đã 18 mục).

### [x] F04 — Product discovery primitives

**Depends on:** F02

**Deliver:**

- ProductCard.
- ProductPrice.
- SellerIdentity and VerificationBadge.
- CategoryShortcut.
- StockStatus and DeliverySummary.
- Wishlist control.

**States:** all global interaction states plus price range, sale, used, unavailable and suspended seller.

**Review evidence:** component matrix at 320 and 1440 px.

**Đã dựng:** `src/proto/shop/components/Primitives.tsx` — ProductCard, ProductPrice, SellerIdentity, VerificationBadge, CategoryShortcut, StockStatus, DeliverySummary, WishlistButton. Ma trận tại `/proto/shop/primitives/discovery`. Đã siết Rule 4 vào chính component: không sao đánh giá, không “đã bán N”, không % giảm giá; “giá cũ” chỉ hiện khi người bán đổi giá thật và luôn kèm ngày; `stock: null` ⇒ chỉ nói “Còn hàng”, không bịa số.

### [x] F05 — Search and filtering primitives

**Depends on:** F02

**Deliver:**

- ShopSearchField.
- Desktop FilterRail.
- Mobile FilterSheet.
- AppliedFilterChips.
- Sort control.
- Result-count announcement.

**Review evidence:** keyboard flow and mobile filter recording/screenshot at 375 px.

**Đã dựng:** `src/proto/shop/components/SearchFilters.tsx` — ShopSearchField, FacetList (rail máy tính), FilterSheet (điện thoại, có bẫy tiêu điểm + Esc + trả tiêu điểm), AppliedFilterChips, SortControl, ResultCount (`role=status aria-live=polite`). Xem `/proto/shop/primitives/search` và `?variant=sheet`. 10 nhóm lọc cho vợt đã định nghĩa sẵn.

### [x] F06 — Commerce action primitives

**Depends on:** F02

**Deliver:**

- VariantSelector.
- Quantity control.
- Sticky mobile commerce bar.
- CartSellerGroup.
- OrderStatusTimeline.
- PolicySummary.

**Review evidence:** eight-state matrix and safe-area screenshot.

**Đã dựng:** `src/proto/shop/components/Commerce.tsx` — VariantSelector (tự tính tổ hợp không khả dụng), QuantityControl, StickyCommerceBar, CartSellerGroup, OrderStatusTimeline, PolicySummary. Ma trận 8 trạng thái tại `/proto/shop/primitives/commerce`. Dòng thời gian luôn ghi AI làm (người mua / người bán / quản trị / hệ thống).

### [x] F07 — Seller/admin form primitives

**Depends on:** F02

**Deliver:**

- SellerApplicationStepper.
- AutosaveIndicator.
- DocumentUploader.
- ListingStatusBadge.
- VariantMatrix desktop and mobile representations.
- ModerationDecisionForm.
- EvidenceViewer.

**Review evidence:** form state matrix at 375 and 1024 px.

**Đã dựng:** `src/proto/shop/components/Forms.tsx` — SellerApplicationStepper, AutosaveIndicator, DocumentUploader, ListingStatusBadge, VariantMatrix (bảng trên máy tính ↔ thẻ trên điện thoại), ModerationDecisionForm, EvidenceViewer. Ma trận tại `/proto/shop/primitives/forms`. Ô ghi chú nội bộ và ô người nộp đọc được khác nhau về màu, viền, biểu tượng và nhãn — không chỉ khác chữ.

### [x] F08 — Shared copy and accessibility contract

**Depends on:** F04–F07

**Deliver:**

- Vietnamese terminology glossary.
- Error/cause/recovery copy patterns.
- Accessible names for icon controls.
- Heading hierarchy map.
- Live-region rules.
- Focus restoration rules for sheets/dialogs.

**Review evidence:** short checklist linked from every screen task.

**Đã dựng:** `src/proto/shop/copy.ts` + màn `/proto/shop/contract`: từ điển thuật ngữ, khuôn lỗi *chuyện gì → vì sao → làm gì tiếp*, tên aria cho nút biểu tượng, cấu trúc tiêu đề, quy tắc live-region, quy tắc trả tiêu điểm. **Được cưỡng chế bằng test**: `src/proto/shop/__tests__/copy-contract.test.ts` chặn 10 cụm từ cấm (“thanh toán thành công”, “giao trong 24h”, “chính hãng 100%”…) và bắt nút chỉ-có-biểu-tượng thiếu aria-label. 14/14 xanh.

---

## 3. Buyer discovery tasks

### [x] B01 — Shop home `/shop`

**Depends on:** F03, F04, F05, F08

**Deliver:** search-led catalogue home, category shortcuts, real-data-safe product sections, verified shops, buying guides and seller CTA.

**Required variants:** first visit, returning user, empty catalogue, loading, offline and fatal error.

**Screenshots:** 375, 768, 1440 px.

**Acceptance:** no oversized marketing hero; useful category/product entry appears above the fold.

**Đã dựng:** `/proto/shop/home`. Không có hero quảng cáo to: mở trang là ô tìm kiếm + 6 danh mục, ở 320px thẻ sản phẩm đầu đã ló lên. Không có mục “bán chạy”/“xu hướng” (không có dữ liệu bán). 6 biến thể: lần đầu / quay lại (có nhắc giỏ) / trống / đang tải / mất mạng / lỗi nặng.

### [x] B02 — Shop search `/shop/search`

**Depends on:** F04, F05

**Deliver:** search results, URL-backed query/filter/sort state, desktop filter rail and mobile filter sheet.

**Required variants:** results, zero results, spelling suggestion, loading-more, network failure and removed filter.

**Screenshots:** 320, 375, 1440 px; mobile filter sheet open.

**Acceptance:** Back restores query, filters and scroll position.

**Đã dựng:** `/proto/shop/search`. Từ khoá + bộ lọc + sắp xếp đều nằm trong URL (`useSearchParams`, push), nên **Back khôi phục đúng truy vấn, bộ lọc và vị trí cuộn** — không tự chế lại cơ chế cuộn. 6 biến thể: có kết quả / 0 kết quả / gợi ý chính tả / tải thêm / lỗi mạng / đã gỡ bộ lọc.

### [x] B03 — Category catalogue `/shop/category/:slug`

**Depends on:** B02

**Deliver:** category-specific header and facets, starting with paddles.

**Required paddle facets:** weight, thickness, face/core material, shape, grip, play style, condition, seller verification and availability.

**Screenshots:** 375 and 1440 px with three applied filters.

**Acceptance:** every key displayed product attribute has a corresponding useful facet or documented reason not to.

**Đã dựng:** `/proto/shop/category/:slug`. 10 nhóm lọc cho vợt. Bảng đối chiếu **thuộc tính hiển thị ↔ bộ lọc** ở `?variant=coverage`: 10 thuộc tính có bộ lọc, 3 cố ý chưa có (giá, thương hiệu, tỉnh gửi) kèm lý do viết sẵn.

### [x] B04 — Product detail `/shop/product/:slug`

**Depends on:** F04, F06, B03

**Deliver:** gallery, title, honest price, seller, variants, delivery, return summary, specifications, description, store card, verified reviews and related products.

**Required variants:** simple product, multi-variant product, used product, out of stock, suspended seller and unpublished product fallback.

**Screenshots:** 320, 375, 768 and 1440 px; mobile top and sticky-action positions.

**Acceptance:** seller, selected variant, total product price context, delivery origin and return summary are clear before Add to cart.

**Đã dựng:** `/proto/shop/product/:slug`. Trước nút “Thêm vào giỏ” đã có đủ 5 thứ: người bán + huy hiệu xác minh, phiên bản đang chọn + mã hàng, tạm tính (ghi rõ chưa gồm phí ship), nơi gửi hàng, chính sách đổi trả. Phần đánh giá nói thẳng **chưa có đánh giá nào**, không bịa 4.8★. 7 biến thể gồm cả sản phẩm chưa đăng bán và shop tạm ngưng.

### [x] B05 — Variant selector sheet

**Depends on:** F06, B04

**Deliver:** dependent option selection, unavailable combinations, selected media/price/SKU/stock and quantity.

**Required variants:** no selection, partial selection, valid selection, sold-out combination, price-changing selection and add failure.

**Screenshots:** 375 px for every state; 1440 px inline-selector version.

**Acceptance:** selecting a variant never changes seller; unrelated low-price options cannot be represented as variants.

**Đã dựng:** `/proto/shop/variant-sheet`. 7 trạng thái. Người bán được ghim trong đầu bảng chọn nên **đổi phiên bản không thể đổi người bán**. Tổ hợp hết hàng bị vô hiệu hoá + gạch ngang (tự suy từ tồn kho, không hardcode).

### [x] B06 — Store detail `/shop/store/:slug`

**Depends on:** F04, B02

**Deliver:** shop identity, verification explanation, location, meaningful operations facts, follow/contact, products, policies and shop reviews.

**Required variants:** new approved shop, established shop, no products and suspended shop.

**Screenshots:** 375 and 1440 px.

**Acceptance:** no private seller documents/contact data leak into the public screen.

**Đã dựng:** `/proto/shop/store/:slug`. Màn hình render từ **danh sách trắng `PUBLIC_FIELDS`** — trường mới thêm vào hồ sơ shop sẽ vô hình ở đây tới khi ai đó cố ý thêm vào danh sách. Không có số điện thoại, địa chỉ riêng, giấy tờ. 4 biến thể: shop lâu năm / shop mới 0 sản phẩm / tạm ngưng / lỗi tải.

### [x] B07 — Wishlist/saved products

**Depends on:** F04

**Deliver:** saved list, availability/price-change disclosures, move-to-cart and unavailable item handling.

**Required variants:** empty, normal, price changed, product removed and seller suspended.

**Screenshots:** 375 and 1440 px.

**Đã dựng:** `/proto/shop/wishlist`. Mỗi dòng tự khai điều đã đổi kể từ lúc lưu: giá đổi (kèm giá lúc lưu), shop tạm ngưng, sản phẩm bị gỡ. Có Hoàn tác sau khi bỏ lưu. 5 biến thể.

---

## 4. Buyer transaction and support tasks

### [x] B08 — Cart `/shop/cart`

**Depends on:** F06, B05

**Deliver:** seller-grouped cart, per-seller subtotal/checkout, quantity changes, Undo removal and invalid-item repair.

**Required variants:** one seller, multiple sellers, price change, out of stock, seller unavailable and empty cart.

**Screenshots:** 375 and 1440 px with two seller groups.

**Acceptance:** user understands that each shop is checked out and delivered separately.

**Đã dựng:** `/proto/shop/cart`. **Không có nút “đặt tất cả”** ở bất kỳ đâu — chỉ nút đặt riêng từng shop, kèm một dòng giải thích vì sao (mỗi shop tự gửi, phí riêng, đổi trả riêng). Có Hoàn tác khi bỏ sản phẩm. 5 biến thể gồm shop tạm ngưng (chỉ khoá nhóm đó, nhóm khác vẫn đặt được).

### [x] B09 — Checkout `/shop/checkout/:shopId`

**Depends on:** B08, F07

**Deliver:** address, shipping, payment, item review, policies, total and guarded final action.

**Required variants:** new address, saved address, address error, shipping unavailable, COD, manual VietQR explanation, stock/price changed, submitting and recoverable payment failure.

**Screenshots:** 320, 375, 768 and 1440 px.

**Acceptance:** no hidden mandatory charge; double-tap cannot create a second visual submission; VietQR is never represented as automatically verified.

**Đã dựng:** `/proto/shop/checkout/:shopId`. Tổng liệt kê từng dòng + nút lặp lại đúng số tiền (“Đặt đơn · 2.485.000₫”), có câu “không có phí nào khác”. Bấm lần đầu là nút **khoá + đổi thành “Đang gửi…”**, không tự mở lại. VietQR nói rõ **đối soát bằng tay**, không tự động. 8 biến thể.

### [x] B10 — Order success

**Depends on:** B09

**Deliver:** order-created outcome for COD, awaiting manual payment and confirmed payment.

**Screenshots:** 375 and 1440 px.

**Acceptance:** status, seller, next step and tracking entry are understandable without celebratory decoration.

**Đã dựng:** `/proto/shop/order-success`. Không confetti, không dấu tích to. Mở đầu bằng **việc người mua phải làm tiếp**: COD thì chờ shop xác nhận, VietQR thì chuyển khoản đúng nội dung + cảnh báo tự huỷ sau 48 giờ. 3 biến thể.

### [x] B11 — Buyer orders list

**Depends on:** F06

**Deliver:** status tabs/filters, seller/date search and meaningful next-action labels.

**Required variants:** empty, mixed statuses, load error and pagination.

**Screenshots:** 375 and 1440 px.

**Đã dựng:** `/proto/shop/orders`. Nhãn mỗi dòng nói **người mua cần làm gì**, không nói tên trạng thái kỹ thuật (“Người bán đang chuẩn bị hàng — chưa cần làm gì”). 4 tab, tìm theo mã đơn/tên shop, tải thêm. 3 biến thể + lỗi.

### [x] B12 — Order detail `/shop/order/:orderCode`

**Depends on:** B11

**Deliver:** status/next step, shipment timeline, seller, items, address, payment and allowed support actions.

**Required variants:** awaiting payment, processing, shipped, delivered, cancelled, return active, dispute active and refunded.

**Screenshots:** 375 and 1440 px for processing and dispute states.

**Đã dựng:** `/proto/shop/order/:code`. Dòng đầu tiên trả lời **ai làm tiếp và hạn bao giờ** — nằm trên cả dòng thời gian. 8 biến thể trạng thái, mỗi trạng thái có tập hành động riêng.

### [x] B13 — Return request

**Depends on:** B12, F07

**Deliver:** item selection, reason, eligibility, evidence upload, resolution request, review and submit.

**Required variants:** eligible, ineligible with explanation, upload error and submitted.

**Screenshots:** 375 and 1024 px.

**Đã dựng:** `/proto/shop/return`. Trạng thái **không đủ điều kiện** là trọng tâm: nói vì sao, chỉ chỗ chính sách đã hiển thị trước khi đặt, và vẫn mở đường khiếu nại nếu hàng không đúng mô tả. Có nhắc “chưa gửi hàng đi vội”. 4 biến thể.

### [x] B14 — Dispute detail

**Depends on:** B13

**Deliver:** structured timeline for claims, responses, evidence, deadlines and decision.

**Required variants:** awaiting seller, awaiting buyer, admin review, resolved buyer and resolved seller.

**Screenshots:** 375 and 1440 px.

**Đã dựng:** `/proto/shop/dispute/:id`. Dòng thời gian có ghi tên người viết, bằng chứng đính kèm xem được, và mỗi giai đoạn mở đều ghi **nếu không ai trả lời thì sao**. 5 giai đoạn gồm 2 kết quả đã xử lý.

### [x] B15 — Verified review composer

**Depends on:** B12, F07

**Deliver:** exact product/variant context, rating, neutral prompt, optional text/media and submit outcome.

**Required variants:** eligible, already reviewed, not yet eligible, validation error and submitted.

**Screenshots:** 375 and 1024 px.

**Acceptance:** prototype visibly communicates verified purchase; no incentive for positive reviews.

**Đã dựng:** `/proto/shop/review`. Ghim đúng đơn + phiên bản + dòng “Mua thật”. Câu hỏi trung tính (**“Sản phẩm có đúng như mô tả không?”**, không phải “bạn có hài lòng không”). Ghi rõ **không tặng điểm, không tặng voucher** cho đánh giá. 1–2 sao bắt buộc giải thích. 5 biến thể.

---

## 5. Seller onboarding tasks

### [x] S01 — Sell landing `/shop/sell`

**Depends on:** F03, F08

**Deliver:** eligibility, required documents, steps, obligations, fee state, verification meaning and Start/Continue actions.

**Required variants:** anonymous, eligible authenticated, existing draft, under review and approved seller.

**Screenshots:** 375 and 1440 px.

**Acceptance:** requirements are clear before the user starts; no invented review SLA.

**Đã dựng:** `/proto/shop/sell`. Điều kiện + giấy tờ + 6 bước + nghĩa vụ đọc được **trước** khi bấm bắt đầu. **Không bịa SLA duyệt**: nói thẳng “người xem, chưa cam kết thời gian vì lượng hồ sơ còn ít và chưa đo được”. Phí: “hiện chưa thu, có thu sẽ báo trước” — không nói “miễn phí trọn đời”. 5 biến thể theo trạng thái người xem.

### [x] S02 — Application stepper `/seller/application`

**Depends on:** F07, F08, S01

**Deliver six steps:** seller type; identity/legal; shop; addresses; payout/documents; review/submit.

**Required states per step:** pristine, partially complete, autosaving, saved, save failed, validation error and restored draft.

**Screenshots:** every step at 375 px; steps 2, 5 and 6 at 1024 px.

**Acceptance:** browser Back/exit does not lose a saved draft; sensitive-field purpose is explained.

**Đã dựng:** `/proto/shop/seller/application`. Số bước nằm trong URL (`?step=`) nên **Back đi lùi từng bước, không văng khỏi form** — đây là cách mất hồ sơ điền dở phổ biến nhất. Bản nháp ghi vào `localStorage` mỗi lần gõ, chỉ báo “đã lưu” kèm giờ. Mỗi ô nhạy cảm có dòng khoá 🔒 nói ai xem được và dùng làm gì. 10 ảnh phủ 7 trạng thái/bước.

### [x] S03 — Application status

**Depends on:** S02

**Deliver:** draft, submitted, under review, needs changes, approved, rejected and withdrawn presentations.

**Screenshots:** 375 and 1024 px for needs-changes, approved and rejected.

**Acceptance:** every non-approved state includes the correct recovery or next step.

**Đã dựng:** `/proto/shop/seller/status`. 7 trạng thái, mỗi trạng thái **bắt buộc có bước tiếp theo** (kiểu `StatusView.next` không cho phép thiếu). Người nộp chỉ thấy `applicantNote`; `internalNote` nằm cùng bản ghi và không được tham chiếu ở màn này.

### [x] S04 — Seller dashboard `/seller`

**Depends on:** F03, F04, S03

**Deliver:** attention queue, operational stats, recent orders, listing issues and new-shop checklist.

**Required variants:** newly approved empty shop, active seller, urgent tasks and data error.

**Screenshots:** 375 and 1440 px.

**Acceptance:** no vanity chart; every metric opens the operational list it summarizes.

**Đã dựng:** `/proto/shop/seller`. Hàng đợi việc cần xử lý nằm **trên cùng** (chỗ duy nhất ngốn tiền nếu bỏ qua), hạn quá giờ đổi viền đỏ. **Không có biểu đồ doanh thu** — mỗi con số là một `<Link>` mở đúng danh sách nó tóm tắt. 4 biến thể gồm shop mới (checklist 3 việc).

---

## 6. Seller operation tasks

### [x] S05 — Seller products `/seller/products`

**Depends on:** F04, F07, S04

**Deliver:** searchable/filterable product management table on desktop and rows/cards on mobile.

**Required statuses:** draft, pending review, active, needs changes, restricted and archived.

**Screenshots:** 375 and 1440 px with mixed statuses.

**Đã dựng:** `/proto/shop/seller/products`. Máy tính = bảng, điện thoại = thẻ (bảng 6 cột ở 375px buộc cuộn ngang trong màn quản trị, dễ bấm nhầm sản phẩm). Đủ 6 trạng thái với bộ đếm trên từng chip lọc.

### [x] S06 — Create product `/seller/products/new`

**Depends on:** F07, S05

**Deliver eight sections:** category; basics; media; attributes; variants/price/stock; shipping; returns/disclosures; preview/submit.

**Required product fixtures:** single-SKU paddle, multi-variant shoes and used paddle.

**Required states:** autosave, category-change warning, media upload/retry, invalid attributes, duplicate SKU, variant bulk edit, preview errors and submitted for review.

**Screenshots:** every section at 375 px; category, variants and preview at 1440 px.

**Acceptance:** first-time seller can create a valid simple product without confronting advanced variant controls until needed.

**Đã dựng:** `/proto/shop/seller/products/new`, 8 phần. **Phiên bản TẮT mặc định** — người bán lần đầu chỉ thấy 1 ô giá + 1 ô tồn kho; bật “có nhiều phiên bản” mới hiện bảng ma trận. 10 ảnh phủ: 3 loại hàng mẫu, cảnh báo đổi danh mục, lỗi ảnh >8MB, thông số sai kiểu, trùng SKU, sửa hàng loạt, lỗi khi xem trước, đã gửi duyệt.

### [x] S07 — Edit product `/seller/products/:id/edit`

**Depends on:** S06

**Deliver:** live/draft changes, moderation status, version conflict, inventory edits and archive action.

**Required variants:** active product, pending changes, admin-requested changes, concurrent-edit conflict and product with open orders.

**Screenshots:** 375 and 1440 px for requested-changes and conflict states.

**Acceptance:** no newer server edit is silently overwritten; destructive impact is explained.

**Đã dựng:** `/proto/shop/seller/products/:id/edit`. Xung đột phiên bản hiện **cả hai bản cạnh nhau** với đúng trường khác nhau, nút chính là “Xem bản mới trước”, ghi đè là nút phụ màu đỏ. Ngừng bán liệt kê 4 hệ quả cụ thể gồm số đơn chưa xong đang gắn với sản phẩm.

### [x] S08 — Seller orders `/seller/orders`

**Depends on:** F06, S04

**Deliver:** attention-first order queue, filters and fulfillment deadlines.

**Required variants:** new orders, packing, shipped, return/dispute and empty queue.

**Screenshots:** 375 and 1440 px.

**Đã dựng:** `/proto/shop/seller/orders`. Sắp theo **hạn phải trả lời**, quá hạn lên đầu và viền đỏ — sắp theo ngày sẽ chôn mất đơn sắp tự huỷ. 4 tab có bộ đếm.

### [x] S09 — Seller order detail `/seller/orders/:id`

**Depends on:** S08

**Deliver:** state-dependent action surface for confirm, cancel, pack, tracking, return and dispute response.

**Required variants:** new order, packed, shipped, cancellation request, return request and dispute.

**Screenshots:** 375 and 1440 px for new order and return request.

**Acceptance:** UI never implies that a client-side click alone completes a financial or shipment state transition.

**Đã dựng:** `/proto/shop/seller/orders/:id`. Mọi nút là *yêu cầu* hoặc *ghi nhận* (“Ghi nhận đã gửi”, “Đề nghị huỷ đơn”), không nút nào ngụ ý một cú bấm hoàn tất chuyển trạng thái tiền/hàng. VietQR ghi “chờ quản trị viên đối soát” cho tới khi có người xác nhận. 6 biến thể trạng thái.

### [x] S10 — Seller settings `/seller/settings`

**Depends on:** F07, S03

**Deliver:** public profile, legal data, addresses, shipping, policies, masked bank data, staff/roles, notifications and close shop.

**Required variants:** normal, reverification required, bank-change reauthentication and insufficient staff permission.

**Screenshots:** 375 and 1440 px.

**Đã dựng:** `/proto/shop/seller/settings`. 9 nhóm. Tài khoản ngân hàng bị che + bắt nhập lại mật khẩu khi đổi, và có ghi chú thiết kế rằng **pilot không thu tài khoản ngân hàng**. Đóng shop liệt kê rõ: **không** tự huỷ đơn đang xử lý. Có biến thể thiếu quyền.

---

## 7. Administrator tasks

### [ ] A01 — Shop admin overview `/admin/shop`

**Depends on:** F03, F07, S04, B14

**Deliver:** actionable queues for applications, product reports, payment issues and disputes.

**Required variants:** normal operations, urgent backlog, empty healthy state and partial query failure.

**Screenshots:** 768 and 1440 px.

### [ ] A02 — Application queue `/admin/shop/applications`

**Depends on:** A01, S02

**Deliver:** URL-persistent filters, status, completeness/risk signals, submission time and assignment placeholder if applicable.

**Required variants:** all statuses, no results and loading/error.

**Screenshots:** 768 and 1440 px.

### [ ] A03 — Application review `/admin/shop/applications/:id`

**Depends on:** A02, S03

**Deliver:** applicant snapshot, secure evidence viewer, resubmission diff, internal/applicant-visible notes, audit timeline and decision rail.

**Required decisions:** request changes, approve and reject; each with validation, confirmation, submitting, success and failure.

**Screenshots:** 768 and 1440 px; 375 px full-screen evidence sheet.

**Acceptance:** internal notes cannot be confused with applicant-visible feedback; decision consequences are explicit.

### [ ] A04 — Product moderation `/admin/shop/products`

**Depends on:** S06, S07, A01

**Deliver:** buyer preview, structured listing data, evidence, flags, seller history context and moderated actions.

**Required variants:** first product, reported product, counterfeit concern, requested changes and removal with open orders.

**Screenshots:** 768 and 1440 px.

### [ ] A05 — Dispute resolution `/admin/shop/disputes`

**Depends on:** B14, S09, A01

**Deliver:** neutral facts, claims/responses/evidence, deadlines, internal notes, allowed outcomes and consequence preview.

**Required variants:** missing item, wrong variant, damaged item, seller non-response and partial refund proposal.

**Screenshots:** 768 and 1440 px.

**Acceptance:** outcome preview lists refund, return, inventory and notification effects before final action.

---

## 8. Cross-screen quality tasks

### [ ] Q01 — Responsive matrix

**Depends on:** all screen tasks intended for review

Verify every screen at 320, 375, 414 and 768 px; critical desktop screens at 1024 and 1440 px. Record failures and fixes.

### [ ] Q02 — Accessibility review

**Depends on:** Q01

- Automated axe pass.
- Keyboard-only walkthrough.
- Focus order/restoration.
- Screen-reader labels and live regions.
- 200% zoom.
- Reduced motion.
- Light/dark contrast.

### [ ] Q03 — Vietnamese content stress test

**Depends on:** Q01

Use long realistic Vietnamese product/shop names, addresses, return explanations and validation messages. No primary button or navigation link may wrap to two lines.

### [ ] Q04 — Failure-state review

**Depends on:** B09, S02, S06, S09, A03, A05

Exercise slow network, offline, upload retry, stale data, permission loss, duplicate submit, inventory conflict and provider timeout fixtures.

### [ ] Q05 — Hallmark anti-slop audit

**Depends on:** Q01–Q04

Run Hallmark's final slop test against the completed prototypes. Fix every applicable failure; record deliberate exceptions with reasoning.

### [ ] Q06 — UI/UX Pro Max final review

**Depends on:** Q05

Review accessibility, touch, performance, responsive behavior, forms, navigation, state clarity and visual consistency. Resolve critical/high findings before product-owner review.

---

## 9. Morning review checklist for product owner

Review in this order:

1. **B04 Product detail** — can you understand item, variant, seller, delivery and return terms immediately?
2. **S02 Seller application** — would a small Vietnamese shop know what to prepare and what remains?
3. **S06 Product editor** — can a first-time seller list one simple paddle without confusion?
4. **B09 Checkout** — are seller, items, fees, payment state and final commitment completely clear?
5. **A03 Admin review** — can admin make a consistent decision without leaking internal information?
6. **B12/B14 Order and dispute** — does every failure show who acts next and by when?

For each screen, answer:

- What is the first thing your eye sees?
- Is that the right priority?
- Is the primary action unambiguous?
- Is any text or badge making a claim unsupported by data?
- Could buyer confuse seller, variant, price, shipping or payment state?
- Could seller lose work or misunderstand approval status?
- Could admin make a damaging decision accidentally?
- Does this feel like ThePickleHub?

Record decisions as `approve`, `revise` or `remove`; include one sentence of reasoning for revise/remove.

---

## 10. Definition of screen-design completion

The screen-design phase is complete only when:

- F01–F08 are approved.
- All P0 buyer, seller and admin screens have a normal state and required edge states.
- Critical screenshots are available at their specified widths.
- Q01–Q06 pass without unresolved critical/high findings.
- Product owner explicitly approves the six critical screens.
- The next implementation plan maps approved screens to migrations, APIs/RPCs, RLS and production components.

Approval of the screen designs does not automatically approve payment-provider integration, production migration deployment or public marketplace launch.

---

## 11. Phát hiện trong lúc dựng (cập nhật liên tục)

Những thứ chỉ lộ ra khi dựng thật, không thấy được lúc viết bảng công việc.

| # | Màn | Phát hiện | Việc phải làm khi ship thật |
| --- | --- | --- | --- |
| P1 | F03 buyer | `ChatFAB` (nút Messenger + Zalo) **đè lên nút chính** của thanh hành động dính ở 375px. Thấy rõ trong `F-F03-buyer-375.png`. | Thêm `/shop` (và `/seller`) vào `HIDDEN_PREFIXES` của `src/components/layout/ChatFAB.tsx`, hoặc dời thanh dính sang trái. Trên trang thương mại, nút chat cộng đồng là thừa — liên hệ người bán đã nằm trong trang. |
| P2 | F03 seller | `/seller/*` phải vào danh sách ẩn của `BottomNav` giống `/creator`, nếu không sẽ có **hai thanh chồng nhau** ở đáy điện thoại. | 1 dòng trong `src/components/layout/BottomNav.tsx`. |
| P3 | F07 | Ô tải giấy tờ (CCCD / GPKD) mâu thuẫn với kết luận đã duyệt trong `shop-marketplace/proposal.md` §2: **không thu CCCD/bank ở pilot**. | Giữ component nhưng không đưa vào slice 1. Nếu dùng: bắt buộc private bucket + cơ chế phát hiện rò rỉ (hiện chưa có cái nào). |
| P4 | toàn bộ | Ứng dụng cuộn ở một `div` bên trong chứ không phải `<html>`, nên `fullPage` của Playwright và phép đo tràn ngang trên `documentElement` đều **báo sai**. | Mọi kiểm tra responsive về sau phải đo trên container cuộn thật (`scripts/proto-shop-shots.mjs` đã sửa). Gate a11y/responsive hiện có của repo có thể đang mù vì lý do này. |

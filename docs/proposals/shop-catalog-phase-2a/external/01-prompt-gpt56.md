# UX review brief — ThePickleHub Shop, Phase 2a (product catalog)

You cannot see the repository. Everything you need is below.

## Product context

ThePickleHub is a bilingual (Vietnamese-primary, ~95% VI users) pickleball
platform. Web app: React 18 + Vite, custom design system called "The Line"
(dark by default, light mode available via `data-mode="light"`). Also shipped
as a Capacitor native shell (iOS/Android) that loads the same web app.

Typical user: standing at a noisy public court in Saigon, mid-tier Android,
4G, one hand on the phone, arrives from a Facebook link straight onto a single
deep page. Perf budget p75 Vietnam: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1.

Phase 1 already shipped: closed-pilot gate, seller application form, admin
review of applications. Sellers are approved one by one by a single admin
(the founder, solo developer).

## Phase 2a scope (what we are reviewing)

Seller side:
- product list
- create product (8 sections: category, basic info, photos, specs,
  price/variants/stock, shipping, returns+declaration, preview+submit)
- variant/SKU matrix, bulk pricing, duplicate-SKU validation
- multi-photo upload
- draft autosave
- "preview as a buyer sees it"
- submit for moderation

Admin side: product moderation queue + review (approve / request changes / reject).

Buyer side (public catalog): shop home, search, category, product detail page,
store page.

## Decisions already locked by the product owner — do NOT reopen these

1. **No cart, no checkout, no payment, no orders, no reviews, no returns
   workflow.** Those are Phase 3. Phase 2a ships a *catalog only*.
2. **Inventory is a boolean per variant: in stock / out of stock. No numbers.**
   No "only 2 left". No stock quantity input anywhere.
3. **Categories are a fixed seed of 6, hardcoded in a DB migration.** No admin
   CRUD for categories.
4. **Approved = live immediately.** There is no separate "published" state. The
   seller removes a product by choosing "Ngừng bán" (stop selling).
5. No ID documents (CCCD), no bank accounts collected.
6. There is no "seller terms of service" document yet — so no screen may claim
   the seller accepted one.

## What already exists in the approved prototype (visual spec, 37 screens)

The prototype was approved by the product owner. It was built BEFORE decisions
2 and 1 above were locked, so parts of it now contradict them.

### Product status values (seller-facing), current Vietnamese labels

| key | label | hint under the label |
|---|---|---|
| draft | Nháp | Chỉ mình anh/chị thấy |
| pending_review | Chờ duyệt | Đang chờ quản trị viên xem |
| active | Đang bán | Người mua thấy sản phẩm này |
| needs_changes | Cần sửa | Có yêu cầu chỉnh sửa |
| restricted | Bị hạn chế | Đã ẩn khỏi trang mua hàng |
| archived | Ngừng bán | Anh/chị đã cất đi |

### Buyer product detail page (PDP), 375px, top to bottom

1. Sticky header: back arrow + shop name
2. Square photo gallery + thumbnail strip; picking a colour swatch moves the photo
3. `<h1>` product title
4. Row of pills: "Đã qua sử dụng" (if used) + a stock pill
5. Price, large
6. Seller card: shop initials + shop name + a verification pill
   ("Đã xác minh 12/07" or "Chưa xác minh")
7. Variant selector: option rows (e.g. Màu, Size) as pill buttons; impossible
   or out-of-stock combinations are disabled
8. A hint line: "Mã hàng PG-CP-W40 · còn 5"
9. Quantity stepper + "Tạm tính" (subtotal) = price x quantity
10. Delivery summary: "Gửi từ TP. Hồ Chí Minh" + "Đổi trả trong 7 ngày"
11. Full-width primary button "Thêm vào giỏ" (add to cart)
12. Collapsible "Chính sách của shop và của nền tảng"
13. Specs table, seller description, store card, empty reviews section,
    related products grid
14. Fixed bottom bar (mobile only) repeating price + shop name + variant +
    "Thêm vào giỏ"

The current stock pill logic:
- stock is null -> "Còn hàng" (in stock)
- stock <= 0 -> "Hết hàng" (out of stock)
- stock <= 3 -> "Chỉ còn {n} sản phẩm" (only n left)
- otherwise -> "Còn hàng"

Decision 2 deletes the number, so the "Chỉ còn N" branch and the "còn 5" hint
must go. Decision 1 deletes the cart, so "Thêm vào giỏ", the quantity stepper
and the subtotal have no destination.

**Important constraint:** the platform's floating chat button (Messenger/Zalo
community chat) is deliberately hidden on all `/shop` routes, because at 375px
it covered the sticky primary button. The stated reason in the code comment was
"contacting the seller lives inside the order". In Phase 2a there are no orders.
The `shops` database table has columns: slug, name, state, owner_user_id, city,
intro, verified_method, verified_at. **There is no public contact field.** The
seller's phone number exists only on the private application record and was
collected without any consent to publish it.

### Seller create-product form, 375px

- Autosave chip at top: "Đã lưu nháp lúc 09:41", with the line
  "Nháp lưu tự động. Đóng trang không mất."
- A horizontally scrolling nav of 8 anchor links to the sections
- Section 3 "Ảnh": a grid of photo tiles (min 110px) plus a dashed
  "Thêm ảnh" tile. Photo errors are shown as ONE page-level red banner:
  "Ảnh "IMG_2043.HEIC" vượt quá 8 MB nên chưa tải lên được. Chụp lại ở chế độ
  thường thay vì HDR, hoặc chọn ảnh khác." with a single "Thử lại" button.
  There is no per-file progress, no per-file retry, no per-file remove.
- Section 5 "Giá, phiên bản, tồn kho": a checkbox
  "Sản phẩm có nhiều phiên bản (màu, size…)". Off -> two fields, price and
  stock quantity. On -> the variant matrix.
- Variant matrix on mobile = one card per variant. Each card holds: variant
  name ("Trắng · 40"), a SKU text input, a price input, a stock input, and a
  hint line. Roughly 200px tall per card. Above the cards: two buttons
  "Đặt giá hàng loạt" and "Đặt tồn kho hàng loạt".
- Duplicate SKU is reported as a banner under the matrix:
  "Mã hàng "PG-CP-W40" bị trùng giữa Trắng/40 và Đen/40." — no jump link.
- Section 8: "Xem trước & gửi duyệt" with buttons "Gửi duyệt",
  "Xem trước như người mua", "Lưu nháp và thoát".

### Seller edit-product form

Has a concurrent-edit conflict state: a red banner saying the product was
edited elsewhere at a given time, showing two cards side by side ("Bản trên
máy chủ" vs "Bản anh/chị đang sửa") comparing price and stock quantity, with
buttons "Xem bản mới trước" (primary) and "Ghi đè bằng bản của tôi" (danger).

Also a "Ngừng bán" section that spells out consequences, several of which are
about open orders that cannot exist in Phase 2a.

### Known layout/a11y traps already hit once in this codebase

- `html`, `body` and `#root` are all `overflow: hidden; height: 100%`, so the
  document never scrolls. Every page must build its own scroll container.
  A whole prototype shipped unscrollable because the screenshot tool resized
  the viewport to the content height before capturing.
- An ancestor with `overflow: hidden` silently clips a wide table, and
  `scrollWidth` does not report it. Overflow must be detected by comparing
  right edges against the scroll container box.
- CSS grid children default to `min-width: auto` and blow out the layout.
- A focusable horizontal scroll area with no accessible name.
- Two `<h1>` on one page; a missing `<main>` landmark.
- Touch targets below 44px.
- Small-button class is `min-height: 36px` while the team's own acceptance
  criterion says every touch target is at least 44x44.
- Status pill colours were only ever contrast-checked in dark mode. Measured in
  light mode on the pill background `#e6e2d5`: "Còn hàng" green `#00b96b` is
  **1.99:1**, "Đã qua sử dụng" orange `#ff7a4d` is **1.99:1**, danger red
  `#d83428` is 3.65:1, amber `#8a6410` is 4.14:1, blue `#1d63c4` is 4.46:1.
  Pill text is 11.5px / weight 600, so 4.5:1 is required.

## Questions — answer these specifically, in this priority order

1. **Boolean-only stock.** Removing the number kills the "only 2 left" urgency
   signal and the quantity stepper. Which screens break, what copy has to be
   rewritten, what does the buyer genuinely lose, and is there an *honest* way
   to keep the feeling of truthfulness without inventing a number? Be concrete.

2. **No cart + no seller contact.** What should the primary action on a buyer
   product page be in a catalog-only phase, given there is no cart, no orders,
   no public seller contact field, and the community chat button is suppressed
   on shop routes? Name the exact button label (Vietnamese) and where it goes.

3. **Multi-file photo upload on a 375px Android on 4G.** Design the per-file
   state model and the exact interface: partial failure, retry, keeping the
   files that succeeded, cover-photo selection, reordering, HEIC from iPhone,
   8MB limit, cancel. Name concrete UI elements, not principles.

4. **Variant matrix at 375px with real data (10-20 variants).** One card per
   variant with three inputs each means ~4000px of form and 20 SKUs typed by
   hand on a phone. Is the card pattern still viable? If not, what replaces it?
   How should duplicate-SKU errors be surfaced across 20 cards?

5. **Vietnamese copy.** Propose better VI labels for the six product statuses
   if the current ones are weak. Then: with "approved = live immediately", what
   exactly happens when a seller edits a product that is already live and
   visible to buyers? State the rule you recommend and write the VI copy the
   seller sees. Consider both the seller's fear ("my product will disappear
   from sale while it waits again") and the buyer's trust ("a paddle got
   approved, then the photos were swapped for a fake brand").

6. **Truthful preview.** How do you guarantee "Xem trước như người mua" does
   not lie about what the buyer actually sees, given the preview is rendered
   for the owner from unsaved local form state while the buyer reads through a
   restricted public database view?

Answer as a senior product designer. Name the exact element and the exact fix.
Vietnamese copy strings should be natural Vietnamese as a Vietnamese seller
would say it, not translated English. No generic design platitudes.

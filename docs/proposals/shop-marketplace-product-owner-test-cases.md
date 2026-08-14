# ThePickleHub Shop Prototype — Product Owner Test Cases

> **Preview:** <https://shop-proto-screens.pickle-hub-pro.pages.dev/proto/shop>  
> **Local:** <http://localhost:8080/proto/shop>  
> **Branch:** `feat/shop-proto-screens`  
> **Purpose:** Product/UX acceptance. This prototype uses fixed fixture data and does not create real orders, payments or database records.

---

## 0. How to record results

For each case, mark one result:

- `[ ] PASS` — behavior and wording are acceptable.
- `[ ] REVISE` — keep the screen but change specified details.
- `[ ] FAIL` — flow is misleading, blocked or unsafe.
- `[ ] N/A` — intentionally deferred, with a reason.

Feedback format:

```text
TC-B04-01 — REVISE
Observed: Main image still shows the white paddle after selecting Black.
Expected: Black variant media should become the main image immediately.
Device/browser: iPhone 15 / Safari
Screenshot: attached
```

When reporting a failure, always include URL, viewport/device and screenshot.

---

## 1. Test setup

### Remote preview

1. Open the preview link.
2. Hard refresh once:
   - macOS Chrome: `Cmd + Shift + R`
   - Windows Chrome: `Ctrl + Shift + R`
3. Confirm the yellow prototype bar appears.
4. Confirm the index says the data is simulated and no payment/database action is real.

### Local fallback

```bash
cd /Users/cm10/pickle-hub-pro
git switch feat/shop-proto-screens
npm install
npm run dev
```

Open <http://localhost:8080/proto/shop>.

### Required test widths

- Mobile: 375×812 or a real iPhone/Android phone.
- Tablet/compact admin: 768×900.
- Desktop: 1440×900.

Chrome DevTools:

1. Open DevTools.
2. Toggle Device Toolbar.
3. Enter width `375`, height `812`, zoom `100%`.
4. Reload after changing width when validating initial layout.

Do not use only a resized desktop window as proof of mobile behavior.

---

## 2. Ten-minute release smoke test

Run these first. Stop and report immediately if any case fails.

### TC-SMOKE-01 — Prototype isolation

**URL:** `/proto/shop`  
**Viewport:** 375 and 1440

Steps:

1. Open the prototype index.
2. Confirm the yellow prototype banner is visible.
3. Click one Buyer, one Seller and one Admin screen.
4. Return to the index with browser Back.

Expected:

- Prototype is clearly labeled as non-production.
- Browser Back works.
- No login wall appears for fixture screens.
- No console-visible crash or blank page.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-SMOKE-02 — Buyer/Seller/Admin navigation separation

**Viewport:** 375

Steps:

1. Open `/proto/shop/product/vot-carbon-16mm-control`.
2. Confirm the normal global BottomNav remains visible for the buyer screen.
3. Open `/proto/shop/seller/products/new`.
4. Confirm the global BottomNav is absent.
5. Open `/proto/shop/admin/applications/app-2`.
6. Confirm the global BottomNav is absent.

Expected:

- Buyer has product navigation context.
- Seller/Admin never show the global Home/Live/Social/Feed/Tools bar.
- Seller/Admin content is not hidden behind any bottom bar.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-SMOKE-03 — ChatFAB overlap regression

**Viewport:** 375

Open these URLs one by one:

```text
/proto/shop/product/vot-carbon-16mm-control
/proto/shop/checkout/shop-1
/proto/shop/seller/products/new
/proto/shop/admin/applications/app-2
```

Steps for each:

1. Scroll until the primary/sticky action is visible.
2. Inspect the bottom-right and bottom-center areas.
3. Try tapping the entire primary button, including its right edge.

Expected:

- Messenger/Zalo ChatFAB is hidden.
- No floating button covers Add to cart, Place order, Preview or Submit decision.
- Primary action is fully readable and tappable.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-SMOKE-04 — No clipped content

**Viewport:** 375, 768 and 1440

Steps:

1. Open `/proto/shop/admin/applications` at 768.
2. Inspect the right-most table/content edge.
3. Open `/proto/shop/admin/applications/app-2` at 375.
4. Inspect applicant values and decision form.
5. Scroll every inner content area to its end.

Expected:

- A02 does not silently lose the right side of the table.
- No applicant value is cut off.
- No content disappears under `overflow:hidden`.
- Intentional horizontal regions are keyboard-focusable and visibly scrollable.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

---

## 3. Buyer discovery and product tests

### TC-B01-01 — Shop home finds products quickly

**URL:** `/proto/shop/home`  
**Viewport:** 375

Steps:

1. Load the page at the top.
2. Without scrolling, identify search, categories and the first product entry.
3. Tap a category and return with browser Back.
4. Tap a product.

Expected:

- Search and categories are immediately obvious.
- At least part of the product catalogue is visible without passing a large marketing hero.
- Back returns to the previous location/context.
- No fake “best seller”, sales count or rating is displayed.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-B02-01 — Search, filter and Back restoration

**URL:** `/proto/shop/search`  
**Viewport:** 375

Steps:

1. Enter a search query.
2. Open `Lọc`.
3. Select at least two paddle filters.
4. Confirm the button says `Xem N sản phẩm`.
5. Apply filters.
6. Confirm selected filters appear as removable chips.
7. Open one product.
8. Press browser Back.

Expected:

- Query/filter/sort are reflected in the URL.
- Mobile filter sheet does not refresh results while choices are still being made.
- Filter counts come from fixture data, not typed constants.
- Back restores query, filters and result position.
- Removing one chip updates the results and count.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-B02-02 — Zero-result recovery

**URL:** `/proto/shop/search?scenario=empty`  
**Viewport:** 375

Steps:

1. Open the URL.
2. Read the zero-result message.
3. Try its suggested recovery action.

Expected:

- Page explains that no result matches.
- Existing query/filter context remains visible.
- User can remove filters, change query or return to categories.
- No empty blank grid.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-B04-01 — Product decision in five seconds

**URL:** `/proto/shop/product/vot-carbon-16mm-control`  
**Viewport:** 375 and 1440

Steps:

1. Load the product page.
2. In five seconds, identify product, price and seller.
3. Before pressing Add to cart, locate selected variant/SKU, shipping origin and return summary.
4. Open the verification explanation.
5. Scroll to specifications and reviews.

Expected:

- Product, price and seller are immediately clear.
- `Đã xác minh` explains scope and date without claiming product authenticity.
- Specifications disclose that seller supplied the data.
- Reviews clearly say only purchasers can review.
- No unsupported rating, sold count or scarcity claim.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-B04-02 — Variant media synchronization

**URL:** `/proto/shop/product/giay-pickleball-court-pro`  
**Viewport:** 375

Steps:

1. Record initial media label, SKU and price.
2. Select color `Đen`.
3. Confirm media changes immediately before selecting size.
4. Select size `39`.
5. Record media, SKU and price.
6. Change color to `Trắng` while keeping size 39.
7. Try selecting an unavailable variant.

Expected sequence:

```text
Đen       → Bản đen   · —         · 1.290.000₫
Đen + 39  → Bản đen   · PG-CP-B39 · 1.390.000₫
Trắng +39 → Bản trắng · PG-CP-W39 · 1.290.000₫
```

Also expected:

- Seller identity never changes.
- Main image and active thumbnail stay synchronized.
- Unavailable combination is visible, crossed/disabled and cannot be selected.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-B04-03 — Product slow-loading skeleton

**URL:** `/proto/shop/product/vot-carbon-16mm-control?scenario=slow`  
**Viewport:** 375 and 1440

Steps:

1. Load the URL.
2. Compare skeleton structure with the normal page.
3. Observe media, title, price, seller/variant and CTA placeholders.

Expected:

- Skeleton resembles the real information hierarchy.
- At 375, final layout differs by no visually significant amount.
- At 1440, remaining height difference is below the initial viewport and does not move the first decision area.
- No infinite spinner.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-B04-04 — Honest exceptional product states

Open:

```text
/proto/shop/product/vot-da-qua-su-dung-6-thang
/proto/shop/product/giay-pickleball-court-pro?scenario=unavailable
/proto/shop/product/vot-da-qua-su-dung-6-thang?scenario=suspended
/proto/shop/product/vot-nhap-khau-cho-duyet
```

Expected:

- Used product exposes condition/defect context.
- Sold-out product cannot be added.
- Suspended seller cannot receive an order.
- Unpublished product is not presented as purchasable.
- Every blocked state provides an honest next action.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

---

## 4. Cart and checkout tests

### TC-B08-01 — Multi-seller cart clarity

**URL:** `/proto/shop/cart`  
**Viewport:** 375

Steps:

1. Count seller groups.
2. Inspect subtotal and checkout action for each group.
3. Remove one item and use Undo.
4. Open `/proto/shop/cart?scenario=unavailable`.

Expected:

- No `Checkout all sellers` button.
- Text explains each seller ships, charges and handles returns separately.
- An unavailable seller group does not block valid groups.
- Price/stock changes are disclosed rather than silently applied.
- Undo restores the removed item.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-B09-01 — Normal checkout transparency

**URL:** `/proto/shop/checkout/shop-1`  
**Viewport:** 375

Steps:

1. Identify seller, delivery address, shipping method and payment method.
2. Read every line in the total.
3. Confirm shipping fee is visible before the final summary.
4. Confirm final button repeats the exact total.
5. Press the final button twice quickly.

Expected:

- Checkout contains products from one clearly named seller.
- No mandatory cost appears only at the final action.
- Text says there are no other fees.
- Final action reads `Đặt đơn · 3.775.000đ` for the fixture.
- First press locks the button and changes it to `Đang gửi…`.
- Second press has no effect.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-B09-02 — VietQR truthfulness

**URL:** `/proto/shop/checkout/shop-1?variant=vietqr`  
**Viewport:** 375

Steps:

1. Select/read the VietQR payment section.
2. Search for wording about verification and cancellation.
3. Continue to the relevant order-success state from the index.

Expected:

- Wording says manual reconciliation and not automatic verification.
- State is `Chờ chuyển khoản`, not `Thanh toán thành công`.
- 48-hour cancellation behavior is explicit.
- Prototype never claims money was received.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-B09-03 — Checkout recovery cases

Open sequentially:

```text
/proto/shop/checkout/shop-1?variant=address-error
/proto/shop/checkout/shop-1?variant=no-shipping
/proto/shop/checkout/shop-1?variant=stock-changed
/proto/shop/checkout/shop-1?variant=payment-failed
```

Expected:

- Address error appears beside the field and focuses the field when appropriate.
- No-shipping state offers a concrete recovery.
- Stock/price change shows old and new price and requires review before placing.
- Payment failure preserves address/cart and says no money was deducted.
- Every screen has Retry/change/back action.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

---

## 5. Seller onboarding tests

### TC-S01-01 — Requirements before starting

**URL:** `/proto/shop/sell`  
**Viewport:** 375

Steps:

1. Read eligibility, required information, steps, obligations and fee statement.
2. Locate `Bắt đầu đăng ký`.

Expected:

- Requirements are understandable before Start.
- Pilot does not request CCCD/bank information.
- No invented approval time.
- Fee wording says the current pilot state without promising permanent free service.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-S02-01 — Draft preservation and Back behavior

**URL:** `/proto/shop/seller/application?step=0&variant=pristine`  
**Viewport:** 375

Steps:

1. Select a seller type and enter available fixture-safe text.
2. Continue to step 2.
3. Enter a contact field.
4. Press browser Back.
5. Press browser Forward.
6. Reload.

Expected:

- Back moves one form step rather than exiting unexpectedly.
- Previously entered values remain.
- Reload shows `Đã khôi phục bản nháp`.
- Save indicator truthfully changes between saving/saved states.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-S02-02 — Inline validation and focus

**URL:** `/proto/shop/seller/application?step=1&variant=invalid`  
**Viewport:** 375

Steps:

1. Press `Tiếp` with invalid/missing data.
2. Observe the stepper.
3. Observe the affected fields.
4. Type a valid value into the first field.
5. Submit/continue again.

Expected:

- Stepper summarizes which step has errors.
- Each invalid field has an adjacent cause/recovery message.
- Focus moves to the first invalid field.
- Fixing the field removes/updates its error without clearing other data.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-S02-03 — Final submit redirects to first invalid field

**Start URL:** `/proto/shop/seller/application?step=5&variant=pristine`  
**Viewport:** 375

Steps:

1. With an empty form, press `Gửi hồ sơ`.
2. Observe URL, selected step and focus.

Expected:

- URL becomes step 0.
- Focus lands on `f-type`.
- Stepper marks the four invalid/incomplete steps.
- A banner explains what must be completed.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-S02-04 — Save failure recovery

**URL:** `/proto/shop/seller/application?step=1&variant=failed`  
**Viewport:** 375

Expected:

- `Chưa lưu được` is obvious.
- `Thử lại` exists.
- Existing values remain.
- Failure does not falsely show `Đã lưu`.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

---

## 6. Seller product-management tests

### TC-S06-01 — First-time simple product

**URL:** `/proto/shop/seller/products/new`  
**Viewport:** 375

Steps:

1. Read minimum requirements at the top.
2. Inspect the initial price/inventory section.
3. Confirm variants are off by default.
4. Navigate through all eight sections.
5. Open buyer preview.

Expected:

- First-time seller sees one price and one inventory field initially.
- Advanced variant matrix appears only after enabling multiple variants.
- Autosave state is visible.
- Preview uses the buyer-facing product structure.
- Submit outcome explains `Chờ duyệt`.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-S06-02 — Variant matrix mobile behavior

**URL:** `/proto/shop/seller/products/new?variant=shoes`  
**Viewport:** 375 and 1440

Steps:

1. At 375, scroll to variant management.
2. Confirm each variant is a card/stack rather than a clipped wide table.
3. At 1440, confirm the matrix is scannable as a table.

Expected:

- No page-level horizontal overflow.
- SKU, price and inventory remain associated with the correct option values.
- Touch controls are at least 44 px.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-S06-03 — Bulk and duplicate-SKU regression

Open:

```text
/proto/shop/seller/products/new?variant=bulk
/proto/shop/seller/products/new?variant=duplicate-sku
```

Steps:

1. Confirm `bulk` shows `Áp cho tất cả`.
2. Confirm the bulk operation context is visible.
3. Open duplicate-SKU state.
4. Locate the exact duplicate.

Expected:

- Both special states render; neither falls back to simple product mode.
- Duplicate points specifically to `PG-CP-W40` shared by `Trắng/40` and `Đen/40`.
- Other valid rows are not falsely marked invalid.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-S06-04 — Media failure isolation

**URL:** `/proto/shop/seller/products/new?variant=media-error`  
**Viewport:** 375

Expected:

- Only failed file is marked.
- Reason and corrective action are shown.
- Successfully uploaded images remain.
- Retry does not clear product fields.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-S07-01 — Concurrent edit protection

**URL:** `/proto/shop/seller/products/p-2/edit?variant=conflict`  
**Viewport:** 375 and 1440

Steps:

1. Compare local and newer server values.
2. Inspect primary and destructive actions.

Expected:

- Both versions and exact changed fields are visible.
- Primary action is `Xem bản mới trước`.
- Overwrite is secondary/destructive.
- Newer data is never silently overwritten.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

---

## 7. Buyer order and dispute tests

### TC-B12-01 — Order next-action clarity

Open each URL:

```text
/proto/shop/order/PH-2608-0041
/proto/shop/order/PH-2608-0039
/proto/shop/order/PH-2608-0031
/proto/shop/order/PH-2607-0018
/proto/shop/order/PH-2607-0022
/proto/shop/order/PH-2607-0025
/proto/shop/order/PH-2606-0003
```

For every page answer:

1. Who acts next?
2. What is the deadline?
3. What happens after the deadline?

Expected:

- Open states answer all applicable questions above the timeline.
- Completed state says no further action is required.
- Available actions match the order state.
- Technical status names are not the only explanation.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-B14-01 — Dispute evidence separation

Open:

```text
/proto/shop/dispute/dis-1
/proto/shop/dispute/dis-2
/proto/shop/dispute/dis-3
/proto/shop/dispute/dis-4
/proto/shop/dispute/dis-5
```

Expected:

- Buyer, seller and admin evidence remain distinguishable.
- Every timeline entry shows author and time/context.
- Open states explain consequence of non-response.
- Final outcomes explain refund/return/order consequence.
- Resolved cases do not appear editable.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-B15-01 — Verified review integrity

**URL:** `/proto/shop/review`  
**Viewport:** 375

Steps:

1. Confirm exact order, product and variant are shown.
2. Read the review prompt.
3. Select one or two stars without explanation.
4. Attempt to submit.

Expected:

- `Mua thật` is tied to a fixture order/item.
- Prompt is neutral: `Sản phẩm có đúng như mô tả không?`
- No points/voucher incentive.
- One/two-star review requires useful explanation according to prototype rule.
- Ineligible/already-reviewed variants explain why submission is blocked.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

---

## 8. Admin tests

### TC-A02-01 — Application queue at 768 px

**URL:** `/proto/shop/admin/applications`  
**Viewport:** 768

Steps:

1. Inspect every visible column and the right edge.
2. Tab through interactive elements.
3. Change a filter and use browser Back.

Expected:

- No hidden 310px area or clipped right-most content.
- If horizontal scrolling is intentional, it is reachable, focusable and apparent.
- Filters persist in URL/history.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-A03-01 — Desktop application decision

**URL:** `/proto/shop/admin/applications/app-2`  
**Viewport:** 1440

Steps:

1. Review applicant snapshot.
2. Open a document/evidence item.
3. Compare internal note and applicant-visible note.
4. Select `Yêu cầu sửa`.
5. Do not select a field; inspect button state.
6. Select a required field and write a message.
7. Check `Đã đọc lại hồ sơ`.
8. Inspect `Sau khi bấm` consequence text.

Expected:

- Evidence access communicates audit logging.
- Internal and public notes cannot be confused visually or semantically.
- Submit remains locked until at least one field is selected.
- A public actionable note is required.
- Consequence is explicit before submission.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-A03-02 — Mobile admin layout

**URL:** `/proto/shop/admin/applications/app-2`  
**Viewport:** 375

Steps:

1. Confirm admin navigation starts as a compact `<details>` row.
2. Expand/collapse it.
3. Inspect applicant snapshot values.
4. Scroll to the decision form.
5. Select a decision and field.
6. Scroll while the submit action is available.

Expected:

- Full desktop sidebar does not push content down.
- Applicant data becomes vertically readable; no right clipping.
- One submit button is sticky within its form.
- No duplicate submit button.
- No ChatFAB or BottomNav overlap.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-A03-03 — Request-changes round trip

**Start URL:** `/proto/shop/admin/applications/app-2`  
**Viewport:** 375 or 1440

Steps:

1. Select `Yêu cầu sửa`.
2. Select the phone/contact field.
3. Enter applicant-visible correction guidance.
4. Complete the prototype decision action.
5. Follow the round-trip link to seller status.
6. Select `Sửa và gửi lại`.

Expected navigation:

```text
A03
→ S03
→ /seller/application?step=1&focus=f-phone
```

Final expected state:

- Seller application opens step 2.
- `f-phone` receives focus.
- Banner says who requested the correction.
- Other saved application data remains available.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

### TC-A03-04 — Decision failure recovery

**URL:** `/proto/shop/admin/applications/app-2?variant=error`  
**Viewport:** 1440

Expected:

- Decision is not shown as successful.
- Admin-entered note/selection remains.
- Retry or safe recovery exists.
- Duplicate decision is not implied.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

---

## 9. Scenario-bar test

### TC-SCENARIO-01 — Shared scenario switching

**Start URL:** `/proto/shop/home`  
**Viewport:** 375

Steps:

1. Use yellow bar to choose `Trống`.
2. Confirm URL includes `scenario=empty` and screen changes.
3. Choose `Mạng chậm`.
4. Choose `Lỗi tải`.
5. Copy current URL into a new tab.

Expected:

- State is reproducible from URL.
- New tab opens the same state.
- No scenario writes to Supabase.
- Unsupported scenario falls back safely to normal.

Result: `[ ] PASS` `[ ] REVISE` `[ ] FAIL`

---

## 10. Automated verification

Keep `npm run dev` running in Terminal 1.

### TC-AUTO-01 — Quality gates

Terminal 2:

```bash
cd /Users/cm10/pickle-hub-pro
node scripts/proto-shop-qa.mjs all
```

Expected:

```text
✅ ALL — không có phát hiện nào trên 37 màn hình.
```

If it fails, run the failing gate separately:

```bash
node scripts/proto-shop-qa.mjs Q01
node scripts/proto-shop-qa.mjs Q02
node scripts/proto-shop-qa.mjs Q03
node scripts/proto-shop-qa.mjs Q04
```

Result: `[ ] PASS` `[ ] FAIL`

### TC-AUTO-02 — Screenshot and render smoke

```bash
node scripts/proto-shop-shots.mjs
```

Expected:

- 236 screenshots generated.
- No console errors.
- No page-level horizontal overflow.
- Output directory:

```text
docs/proposals/shop-marketplace/screenshots/
```

Result: `[ ] PASS` `[ ] FAIL`

### TC-AUTO-03 — Focused screenshot reruns

After revising a critical screen:

```bash
node scripts/proto-shop-shots.mjs B04
node scripts/proto-shop-shots.mjs S02
node scripts/proto-shop-shots.mjs S06
node scripts/proto-shop-shots.mjs B09
node scripts/proto-shop-shots.mjs A03
```

Expected: each command reports no console error and no horizontal overflow.

Result: `[ ] PASS` `[ ] FAIL`

---

## 11. Final product-owner decision

### Critical screens

| Screen | Result | Required note if not PASS |
| --- | --- | --- |
| B04 Product detail |  |  |
| S02 Seller application |  |  |
| S06 Product editor |  |  |
| B09 Checkout |  |  |
| A03 Admin review |  |  |
| B12/B14 Order and dispute |  |  |

### Cross-cutting decisions

| Question | Decision |
| --- | --- |
| Does the Shop feel native to ThePickleHub? |  |
| Is seller identity clear at every commitment point? |  |
| Are variant, price, shipping and payment states unambiguous? |  |
| Can sellers recover without losing work? |  |
| Can admins make decisions without leaking internal notes? |  |
| Are mobile primary actions free from BottomNav/FAB overlap? |  |
| Is the prototype approved for implementation planning? |  |

### Sign-off

```text
Decision: APPROVE / REVISE / REJECT
Reviewed by:
Date:
Approved exceptions:
Required changes before implementation:
```

Prototype approval authorizes the next implementation-planning phase only. It does not authorize production migrations, payment integration, seller onboarding launch or public marketplace release.

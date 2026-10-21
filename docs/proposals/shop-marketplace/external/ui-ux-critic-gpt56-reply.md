# Blockers

## 1. The seven-step application is the wrong pilot artifact

For 1–3 sellers Cuong already knows, do **not** build a public, self-serve seven-step seller application. It optimizes for screening unknown sellers, while the pilot needs known sellers to list their first products.

The current flow asks sellers to surrender sensitive information before they see any value, with no buyers and no immediate payout. A Facebook-native seller will compare this with “post photos and a phone number in a group” and leave.

### Where abandonment will happen

These are directional effort estimates, not measured product analytics:

| Proposed step | Likely friction | Exact recommendation |
|---|---:|---|
| Authentication and draft creation | 1–3 minutes, worse if the Facebook in-app browser loses auth state | Send a seller-specific invite link that resumes directly into setup after login. Preserve the intended route through authentication. |
| Legal name, seller type, tax code | 2–10 minutes plus uncertainty about tax implications | Remove from the pilot. Ask later only when legally or operationally required. |
| Contact phone | Under 1 minute | Keep. Label it `Số điện thoại liên hệ`. Accept Vietnamese formats with or without spaces and `+84`. |
| Email | Duplicative if already on the account | Prefill from the account. Do not require re-entry. |
| Pickup and return addresses | 3–8 minutes; free-text district/province causes uncertainty and inconsistent data | Defer until the first product or shipping/COD activation. Use one pickup address and a checkbox: `Dùng địa chỉ này để nhận hàng hoàn`. |
| Bank account | 3–7 minutes plus high trust cost | Remove completely. It will not be used for months, cannot be autosaved, and this product already has measured abandonment around bank fields. |
| Business licence/CCCD | 5–15 minutes, data use, image-quality and trust concerns | Remove from the pilot. Do not collect KYC “just in case.” |
| Marketplace policies | 2–10 minutes depending on length; often abandoned or accepted without comprehension | Move to immediately before the first product is published. Use a short pilot agreement, not a separate wizard step. |
| Review and submit | 1–3 minutes, mostly repetition | Remove. Use a summary on the same setup screen. |
| Admin review | Hours or days of perceived waiting | Eliminate for invited sellers. Cuong has already screened them socially. |

The most likely exits are:

1. **Step 3, bank details:** already a documented source of abandonment and obviously unrelated to the current feature.
2. **Step 4, licence/CCCD upload:** the highest trust and technical burden, especially in a Facebook in-app browser on 4G.
3. **Step 2, address:** users will hesitate over whether to enter a registered address, shop address, warehouse, or home.
4. Some Facebook-native sellers will leave at the first legal/tax field because Facebook selling asks for none of it.

### Build this instead: invite-based seller activation

Use an admin-created invitation, not an application.

#### Admin action

On `/admin/shop/sellers`, Cuong selects `Mời người bán` and enters:

- `Tên cửa hàng`
- `Người liên hệ`
- `Số điện thoại`
- `Email hoặc tài khoản ThePickleHub`
- Optional internal note: `Ghi chú nội bộ`

Primary action:

- `Tạo lời mời`

Then show:

- `Sao chép liên kết mời`
- `Gửi qua email`
- `Đánh dấu đã liên hệ qua Zalo`

Cuong can paste the link into the existing Zalo/Facebook conversation.

#### Seller invite screen

Route: `/shop/seller/invite/:token`

One mobile screen, not seven:

- `Tên gian hàng` — prefilled, editable
- `Tên người liên hệ` — prefilled
- `Số điện thoại liên hệ` — prefilled
- `Kênh liên hệ ưu tiên` — `Zalo`, `Điện thoại`, `Email`
- Short agreement checkbox:

> `Tôi đồng ý tuân thủ quy định dành cho người bán thử nghiệm của ThePickleHub.`

Links:

- `Xem quy định dành cho người bán`
- `ThePickleHub sử dụng thông tin này như thế nào?`

Primary action:

- `Kích hoạt gian hàng`

Successful result:

> **Gian hàng đã được kích hoạt**  
> Bước tiếp theo là thêm sản phẩm đầu tiên. Cuong có thể hỗ trợ bạn nếu cần.

CTA:

- `Thêm sản phẩm đầu tiên`
- Secondary: `Nhờ Cuong hỗ trợ`

If product creation is genuinely outside this slice, the success metric cannot yet be tested. A thin first-product form or a concierge product-import tool is more important than the proposed review workflow.

### Data to defer until it has an operational purpose

Collect these at shipping or payout activation, not seller activation:

- Legal name
- Business/personal classification
- Tax code
- Pickup address
- Return address
- Bank code
- Bank account number
- Account-holder name
- Business licence
- CCCD

When an address is eventually needed, do not copy the existing three free-text fields. Build a controlled `Tỉnh / Thành phố` selector and dependent `Quận / Huyện` selector. Free text will produce variants such as `HCM`, `TP HCM`, `TP.Hồ Chí Minh`, and `Sài Gòn`, making shipping and reporting unreliable.

---

## 2. Do not implement document upload until private storage is production-ready

The proposed CCCD/business-licence upload cannot ship against any existing public bucket.

Before accepting one document, the system needs:

- A private bucket with no public fallback URL
- Server-authorized uploads
- Short-lived signed read URLs
- Authorization checked each time a URL is created
- No document URLs written to analytics, client logs, error reports, or audit text
- No service-worker or browser-cache persistence for document responses
- File type and size validation
- Malware scanning or at minimum strict MIME/content validation
- Expiry and deletion policy
- Audit entries for document access
- A visible signed-URL expiry state in the admin viewer

If that infrastructure is not ready, the exact fix is: **remove Step 4**, rather than accepting documents insecurely.

---

## 3. `/admin/news` must not be treated as the interaction model

The following patterns are safe to reuse:

- Existing admin shell and navigation
- TOTP protection
- shadcn/Radix primitives
- Semantic color tokens
- Card styling
- Toasts as secondary confirmation
- Existing authentication and role checks

The following patterns will actively break seller review:

- Single-tap state toggles
- `size="sm"` 36px action buttons
- Toast-only success and failure
- Silent empty results after query failure
- Raw enum labels
- Hardcoded `limit(50)`
- Fifteen-second polling forever
- No detail route
- No written decision record
- No differentiation between empty, loading, and failed queries

An accidental `Reject` or `Approve` is materially different from toggling a news item. Decisions need confirmation, persistent results, and an audit trail.

Also change the proposed requirement that **approval must have a written reason**. Require:

- `Request changes`: mandatory seller-visible explanation
- `Reject`: mandatory seller-visible explanation
- `Approve`: optional internal note

A mandatory approval essay adds admin work without helping the seller.

---

# Strong recommendations

## 1. If a review queue is retained for future unknown sellers, make it a real queue

### Queue: `/admin/shop/applications`

Use these filter tabs:

- `Cần xem xét`
- `Chờ người bán bổ sung`
- `Đã duyệt`
- `Đã từ chối`
- `Tất cả`

Each queue card should show:

- Shop name
- Contact name and phone
- Submitted date
- Current status
- Number of previous change requests
- Age indicator, such as `Chờ 2 ngày`
- Exact CTA: `Xem hồ sơ`

Do not place `Duyệt` or `Từ chối` directly on the queue card.

Use cursor pagination or a `Tải thêm` control. Do not silently stop at 50.

Replace continuous 15-second polling with:

- Fetch on entry
- Refresh after a decision
- Refresh when the window regains focus
- Manual `Làm mới` control
- Optional low-frequency refresh only while the queue is visible

### Detail: `/admin/shop/applications/:id`

Mobile section order:

1. Status and submission metadata
2. Contact card with `Gọi` and `Sao chép số`
3. Latest seller submission
4. Outstanding requested changes
5. Documents, if this is eventually supported
6. Review history
7. Decision controls

Use a bottom action bar with three stacked or wrapping actions:

- Primary: `Yêu cầu bổ sung`
- Secondary: `Duyệt hồ sơ`
- Destructive: `Từ chối`

On 375px, do not force all three into one row.

### Request-changes dialog

Do not use only one unstructured reason textarea. Cuong needs to identify exactly what must change.

Dialog title:

> `Yêu cầu người bán bổ sung`

For each issue, require:

- `Mục cần sửa` — select a field or section
- `Nội dung cần bổ sung` — seller-visible textarea
- Optional `Ghi chú nội bộ`

Example:

- `Mục cần sửa`: `Số điện thoại liên hệ`
- `Nội dung cần bổ sung`: `Số điện thoại hiện tại thiếu một chữ số. Vui lòng kiểm tra và nhập lại.`

Allow `Thêm mục khác`.

Primary action:

- `Gửi yêu cầu bổ sung`

Confirmation:

> **Gửi yêu cầu này cho người bán?**  
> Hồ sơ sẽ chuyển sang trạng thái “Cần bổ sung”.

After success, update the page itself:

> `Đã gửi yêu cầu bổ sung lúc 14:32, 9/8/2026.`

The toast may repeat this, but must not be the only record.

### Seller correction screen

At the top of the application, show:

> **Hồ sơ cần bổ sung**  
> Cuong đã yêu cầu bạn sửa 2 mục trước khi hồ sơ có thể được duyệt.

Then show a checklist:

- `Số điện thoại liên hệ`  
  `Số điện thoại hiện tại thiếu một chữ số. Vui lòng kiểm tra và nhập lại.`
- `Ảnh giấy phép kinh doanh`  
  `Ảnh hiện tại bị mờ ở phần mã số thuế. Vui lòng chụp lại trong đủ ánh sáng.`

Each item should have `Sửa mục này`, which scrolls to and focuses the exact field. Put the same message immediately under that field.

Primary action:

- `Gửi lại hồ sơ`

Confirmation:

> `Hồ sơ đã được gửi lại cho ThePickleHub.`

Preserve:

- The original submitted snapshot
- Each requested change
- The seller’s revised value
- Submission timestamps
- Admin decision timestamps

On the admin detail page, show a diff such as:

> `Số điện thoại: 090 123 456 → 0901 234 567`

### Limit the back-and-forth

After the second request-changes cycle, show Cuong:

> **Đã yêu cầu bổ sung 2 lần**  
> Nên liên hệ trực tiếp với người bán để tránh kéo dài quá trình.

Actions:

- `Gọi người bán`
- `Sao chép số điện thoại`
- `Đánh dấu đã liên hệ`

The third cycle should not be technically blocked, but the product should recommend a call. With only 1–3 pilot sellers, repeated form correspondence is less efficient than a two-minute phone or Zalo exchange.

Notify the seller through the channel they actually use. Email alone is insufficient. For the pilot, a manual Zalo message is acceptable if the admin UI provides exact copy:

> `ThePickleHub cần bạn bổ sung một vài thông tin để kích hoạt gian hàng: [link]`

---

## 2. Vietnamese state copy

Keep badge text short. Put explanations outside the badge.

### Application states

| State | Badge | One-line explanation |
|---|---|---|
| `draft` | `Bản nháp` | `Bạn chưa gửi hồ sơ này cho ThePickleHub.` |
| `submitted` | `Đã gửi` | `Hồ sơ đã được gửi và đang chờ ThePickleHub tiếp nhận.` |
| `under_review` | `Đang xem xét` | `Cuong đang kiểm tra thông tin trong hồ sơ của bạn.` |
| `needs_changes` | `Cần bổ sung` | `Bạn cần sửa hoặc bổ sung một số thông tin rồi gửi lại.` |
| `approved` | `Đã duyệt` | `Hồ sơ đã được duyệt. Bạn có thể tiếp tục kích hoạt gian hàng.` |
| `rejected` | `Từ chối` | `Hồ sơ chưa được chấp nhận. Xem lý do bên dưới.` |
| `withdrawn` | `Đã rút` | `Bạn đã rút hồ sơ này và ThePickleHub sẽ không tiếp tục xem xét.` |

Potentially too wide in compact mobile filters:

- `Đang xem xét`
- `Cần bổ sung`

They are acceptable as standalone badges, but not in a row of segmented tabs. Use shorter filter labels such as `Đang xem` and `Cần sửa` only in the filter control; retain the full labels in status badges.

Do not use `Bị từ chối` as the badge. `Từ chối` is shorter and less accusatory.

### Shop states

| State | Badge | One-line explanation |
|---|---|---|
| `pending_activation` | `Chờ kích hoạt` | `Gian hàng đã được duyệt nhưng vẫn còn bước cần hoàn tất trước khi hoạt động.` |
| `active` | `Đang hoạt động` | `Gian hàng đang hoạt động trên ThePickleHub Shop.` |
| `restricted` | `Bị hạn chế` | `Một số chức năng bán hàng đang bị giới hạn. Xem yêu cầu bên dưới.` |
| `suspended` | `Tạm ngưng` | `Gian hàng đang tạm ngưng và chưa thể tiếp tục bán hàng.` |
| `closed` | `Đã đóng` | `Gian hàng đã đóng và không còn hoạt động.` |

Likely too wide for narrow table cells or compact filter controls:

- `Chờ kích hoạt`
- `Đang hoạt động`

Do not abbreviate these inside the detail screen. Let the badge size to its content or wrap the surrounding layout. For compact filters use `Chờ mở` and `Hoạt động`.

The seller-facing explanation for `restricted` must always be followed by the specific restriction. Never leave only the generic sentence.

---

## 3. Discovery should not be a pilot investment

A homepage Shop section and public burger-menu entry do not help the current success metric. They may attract buyers into an empty marketplace and create the impression that the feature is unfinished.

### Minimum discovery surface for the pilot

Build only:

1. Direct seller invitation links sent by Cuong
2. A seller dashboard card visible only to invited sellers:
   > **Gian hàng của bạn**  
   > Hoàn tất thiết lập và thêm sản phẩm đầu tiên.
3. An account-menu entry for activated sellers:
   - `Quản lý gian hàng`
4. An admin list tracking:
   - Invited
   - Invite opened
   - Shop activated
   - First product started
   - First product submitted
   - First product published

Do not add Shop to:

- The mobile bottom navigation
- The public homepage
- Global search
- Buying-guide articles

until there are enough real, available products to satisfy a buyer arriving from Facebook.

### Build this instead of the homepage section

Build a seller activation dashboard with one visible checklist:

> **Bắt đầu bán trên ThePickleHub**

- `Kích hoạt gian hàng`
- `Thêm sản phẩm đầu tiên`
- `Gửi sản phẩm để xem xét`
- `Bắt đầu bán`

Show progress as `1/4 bước đã hoàn tất`.

Also build a concierge escape hatch:

> `Bạn có danh sách sản phẩm trên Shopee hoặc Facebook? Gửi liên kết cho Cuong để được hỗ trợ nhập sản phẩm.`

CTA:

- `Gửi liên kết sản phẩm`

That directly addresses sellers’ existing behavior and the pilot metric.

---

## 4. 375px mobile and accessibility fixes

### Seller form

#### Failure: seven labels in a horizontal stepper

At 375px, labels such as `Thông tin thanh toán` and `Tải giấy tờ` will truncate or create horizontal scrolling.

**Fix:** use:

- `Bước 1/2`
- Current title beneath it
- A simple progress bar
- `Quay lại` and `Tiếp tục`

Do not display all step names simultaneously.

#### Failure: two-column field layouts

`Quận / Huyện` and `Tỉnh / Thành phố`, or bank and account fields, will become cramped and produce horizontal overflow.

**Fix:** one field per row below 640px. Labels remain above inputs.

#### Failure: mobile keyboard zoom and hidden controls

Inputs below 16px can trigger iOS zoom, while sticky controls can be hidden by the keyboard or Capacitor safe area.

**Fix:**

- Input text at least 16px
- Minimum control height 44px
- Footer padding using `env(safe-area-inset-bottom)`
- Scroll the invalid field above the keyboard
- Do not use `size="sm"` for form actions

#### Failure: sticky footer covers the last field

**Fix:** add page-bottom padding equal to footer height plus safe-area inset. The footer must become normal document flow when the keyboard is open if reliable viewport detection is unavailable.

#### Failure: validation appears only after submission

**Fix:** put the exact message under the field and connect it using `aria-describedby`.

Example:

- Field: `Số điện thoại liên hệ`
- Error: `Nhập số điện thoại gồm 10 chữ số hoặc bắt đầu bằng +84.`

On submit, focus the first invalid field and announce:

> `Có 2 mục cần kiểm tra lại.`

Use an `aria-live="assertive"` error summary.

#### Failure: document thumbnails consume the viewport

If uploads are later added, full-width image previews will push actions far below the fold and consume memory on mid-tier Android.

**Fix:** show a compact file row:

- Thumbnail, 56×56
- File name
- File size
- Status
- `Xem`
- `Thay ảnh`
- `Xóa`

Compress images before upload, but retain enough resolution for document text. Never silently upload on mobile data without visible progress.

#### Failure: autosave implies bank data was saved

If sensitive fields are later introduced, a general `Đã lưu bản nháp` message would falsely imply that bank details were persisted.

**Fix:** show beside those fields:

> `Vì lý do bảo mật, thông tin ngân hàng không được lưu trong bản nháp.`

However, the pilot fix remains to omit the fields entirely.

### Admin application detail

#### Failure: desktop table on 375px

A multi-column table for identity, status, dates, and actions will horizontally scroll and hide important information.

**Fix:** use stacked cards on mobile. Each field uses:

- Label
- Value
- Copy action where useful

Do not put labels and long values in a fixed 50/50 grid.

#### Failure: three decision buttons in one row

`Yêu cầu bổ sung`, `Duyệt hồ sơ`, and `Từ chối` cannot fit at accessible widths.

**Fix:** stack them full-width with 8px spacing. All must be at least 44px high. Destructive action comes last and is visually separated.

#### Failure: icon-only 36px controls

Copying `/admin/news` would create undersized close, download, refresh, and navigation targets.

**Fix:** use `size="icon"` at 44×44. Every icon-only control needs an accessible name, for example:

- `aria-label="Làm mới danh sách"`
- `aria-label="Đóng trình xem giấy tờ"`
- `aria-label="Tải giấy tờ xuống"`

#### Failure: signed document URL expires while open

**Fix:** replace the broken viewer with:

> `Liên kết xem giấy tờ đã hết hạn.`

Action:

- `Tải lại giấy tờ`

Do not expose the storage URL in the UI.

#### Failure: decision result exists only in a toast

**Fix:** after a decision, update the status heading, history, and available actions. Move focus to a persistent confirmation:

> `Hồ sơ đã chuyển sang trạng thái “Cần bổ sung”.`

Use `role="status"`.

#### Failure: low-contrast semantic badges

Verify `--tl-live`, `--tl-green`, and muted foreground combinations against the actual dark background. Status must not rely on color alone; always include the text label and, where useful, an icon.

---

## 5. Exact empty, loading, error, and offline copy

Vietnamese should be primary. English may appear after the locale switch, not simultaneously.

### Seller application/setup

| State | Vietnamese | English | Action |
|---|---|---|---|
| No application/invite setup | `Bạn chưa thiết lập gian hàng.` | `You haven’t set up your shop yet.` | `Bắt đầu thiết lập` / `Start setup` |
| Loading | `Đang tải thông tin gian hàng…` | `Loading your shop details…` | None |
| Load error | `Không tải được thông tin gian hàng.` | `We couldn’t load your shop details.` | `Thử lại` / `Try again` |
| Save error | `Chưa lưu được thay đổi. Thông tin bạn nhập vẫn còn trên màn hình.` | `Your changes couldn’t be saved. Your entries are still on this screen.` | `Lưu lại` / `Save again` |
| Offline | `Bạn đang ngoại tuyến. Hãy kết nối mạng trước khi gửi.` | `You’re offline. Reconnect before submitting.` | `Thử lại` / `Try again` |
| Draft saved | `Đã lưu bản nháp lúc 14:32.` | `Draft saved at 2:32 PM.` | None |
| Submission in progress | `Đang gửi hồ sơ…` | `Submitting your application…` | Disable duplicate submit |
| Submission failed | `Chưa gửi được hồ sơ. Vui lòng kiểm tra kết nối và thử lại.` | `Your application wasn’t submitted. Check your connection and try again.` | `Gửi lại` / `Submit again` |

Never say `Đã gửi` until the server confirms receipt.

### Admin queue

| State | Vietnamese | English | Action |
|---|---|---|---|
| Loading | `Đang tải danh sách hồ sơ…` | `Loading applications…` | None |
| Empty queue | `Không có hồ sơ nào cần xem xét.` | `There are no applications to review.` | None |
| Empty filtered result | `Không có hồ sơ phù hợp với bộ lọc này.` | `No applications match this filter.` | `Xóa bộ lọc` / `Clear filters` |
| Query error | `Không tải được danh sách hồ sơ. Đây có thể là lỗi kết nối hoặc máy chủ.` | `We couldn’t load the applications. This may be a connection or server error.` | `Thử lại` / `Try again` |
| Offline | `Bạn đang ngoại tuyến. Danh sách có thể không phải dữ liệu mới nhất.` | `You’re offline. This list may be out of date.` | `Thử kết nối lại` / `Reconnect` |
| Stale cached data | `Đang hiển thị dữ liệu từ 14:32. Chưa thể cập nhật.` | `Showing data from 2:32 PM. Updates are currently unavailable.` | `Làm mới` / `Refresh` |

An error must never render as the empty-queue message.

### Admin detail

| State | Vietnamese | English | Action |
|---|---|---|---|
| Loading | `Đang tải hồ sơ người bán…` | `Loading the seller application…` | None |
| Not found | `Không tìm thấy hồ sơ này hoặc hồ sơ đã bị xóa.` | `This application could not be found or has been removed.` | `Về danh sách` / `Back to applications` |
| Load error | `Không tải được hồ sơ người bán.` | `We couldn’t load the seller application.` | `Thử lại` / `Try again` |
| Decision in progress | `Đang cập nhật trạng thái hồ sơ…` | `Updating the application status…` | Disable all decision buttons |
| Decision failed | `Chưa cập nhật được hồ sơ. Không có thay đổi nào được ghi nhận.` | `The application couldn’t be updated. No changes were recorded.` | `Thử lại` / `Try again` |
| Document loading | `Đang tải giấy tờ…` | `Loading document…` | None |
| Document error | `Không mở được giấy tờ này.` | `This document couldn’t be opened.` | `Tải lại giấy tờ` / `Reload document` |

---

# Nits

1. **Do not expose raw enums anywhere.** Map `under_review`, `pending_activation`, and all other values to the Vietnamese labels above.

2. **Use Vietnamese consistently in admin.** Replace mixed labels such as `Publish`, `failed`, or `draft` with localized strings. Cuong may understand English, but mixed terminology increases decision errors.

3. **Use Vietnamese date formatting:** `14:32, 9/8/2026`, not `08/09/2026`, which is ambiguous across locales.

4. **Keep status explanations out of badges.** Badges should contain only labels; the one-line explanation belongs directly below.

5. **Do not add a 19th prominent sidebar item without consolidation.** Put seller operations under a parent such as `Shop`, with child routes `Người bán` and later `Sản phẩm`. On admin mobile, provide a contextual `Shop` landing screen rather than attempting to expose every route in the four-tab bar.

6. **Withdrawal needs confirmation.** Exact dialog:
   > **Rút hồ sơ này?**  
   > ThePickleHub sẽ ngừng xem xét hồ sơ. Bạn có thể tạo hồ sơ mới sau này.

   Actions: `Giữ hồ sơ` and destructive `Rút hồ sơ`.

7. **Do not build public Shop discovery before inventory exists.** The correct pilot sequence is: invite seller → activate shop → create first product → publish enough products → then expose Shop to buyers.
<!-- Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4
     genre: editorial / modern-minimal (kế thừa "The Line") · macrostructure:
     Long Document (mua) + Workbench (bán) · theme: KHÔNG dùng theme Hallmark —
     nguồn token thật là docs/design-tokens.md + src/styles/the-line.css + shop.css -->

# 03 — Đặc tả UI/UX · Shop Phase 3 (S3–S6)

**Nguồn sự thật:** `docs/build-feature/shop-phase-3/02-final-analysis.md`.
Mọi câu ở đây mâu thuẫn với file đó đều thua.

**Phạm vi:** 7 màn (B08, B09, B10, B11, B12, S08, S09) + 4 thay đổi lẻ trên màn đã có.
B07/B13/B14/B15/A05 **đã cắt** — không xuất hiện ở bất kỳ đâu, kể cả trong một câu chữ dẫn tới.

**Ràng buộc chung, không thương lượng**

| # | Ràng buộc | Vì sao |
|---|---|---|
| R1 | Mobile-first **375px**, kiểm cả **320 / 414 / 768 / 1440**. Không cuộn ngang ở bất kỳ width nào | ~95% người dùng Việt, chủ yếu điện thoại |
| R2 | Mọi vùng chạm **≥ 44×44px** (`--shop-tap`) | Global done criteria đã ký ở `shop-marketplace-screen-tasks.md` |
| R3 | Chỉ dùng class `tl-shop-*` / `tl-pdp-*` / `tl-pcard-*` có sẵn trong `src/styles/shop.css`. Class mới chỉ được thêm ở §7 | F02: không hex thô, không font mới |
| R4 | **Không import gì từ `src/proto/`** (có test chặn) | Prototype là bản vẽ, không phải thư viện |
| R5 | **Không thêm dependency** — không thư viện form, không toast lib, không data tỉnh/thành | §8 bản phân tích |
| R6 | **Không thêm mục thứ 6 vào bottom nav.** Đường tới giỏ là **badge trên hàng breadcrumb của trang Shop** (§2.1) | ShopShell.tsx đã ghi luật này |
| R7 | ⚠️ **Cấm chuỗi `"Shop bị tạm ngưng"`** trong artifact production → dùng **`"Shop đang tạm ngưng bán"`**. Cấm luôn `tl-proto-banner`, `Bản mẫu — dữ liệu giả lập`, `pickle-gear-sai-gon` | `scripts/check-bundle-size.mjs:199–204` fail build |
| R8 | Mọi route mới qua `lazyRetry`, tách chunk mua / bán như P2b | Ngân sách bundle |
| R9 | **Không heading nào in nghiêng.** Nhấn mạnh bằng weight hoặc màu | Hallmark gate 38a |
| R10 | **Không bịa số.** Không "đã bán 12", không "giao trong 2 ngày", không đếm ngược phía người mua | §G bản chốt |

**Song ngữ.** Bề mặt Shop production hiện **chỉ có tiếng Việt** — `src/pages/shop/*` không import `useI18n` (đã kiểm: 0 kết quả). Đêm nay **giữ nguyên khuôn đó**: code ship chuỗi VI. Cột EN trong mọi bảng copy dưới đây là **bắt buộc phải có trong spec** và phải được dán vào comment ngay trên hằng số copy, để khi Shop vào i18n thì dịch đã sẵn, không phải viết lại. *ponytail: nối `useI18n` cho 7 màn mới = một slice riêng, không phải một dòng.*

---

## 1. Punch list từ `hallmark audit`

Chạy trên `src/pages/shop/ProductDetail.tsx`, `src/pages/shop/ShopStore.tsx`, `src/components/shop/ShopShell.tsx` (+ `src/styles/shop.css` vì đó là nơi hành vi thật nằm). **Xếp hạng, không sửa.**

### Critical (ships as slop nếu bỏ qua)

**C1 · Badge giỏ không có chỗ đứng — `missing affordance host`**
`ProductDetail.tsx:131`, `ShopStore.tsx:83`, `ShopHome.tsx:30` render trong `TheLineLayout`, **không bao giờ** dùng `ShopHeader`. `ShopHeader` (`ShopShell.tsx:55–65`) không có slot giỏ, dù CSS `.tl-shop-cart-count` đã tồn tại (`shop.css:464–479`) và `.tl-shop-iconbtn` đã có `position: relative` làm gốc toạ độ.
→ **Fix:** thêm `<ShopCartLink>` vào **hàng breadcrumb** của từng trang mua (§2.1). **Tuyệt đối không** đụng `tl-nav` trong `TheLineLayout` — badge giỏ sẽ hiện trên cả /live, /feed, /blog.

**C2 · Nguy cơ `disabled element with no explanation`**
`ProductDetail.tsx:274–309` là khuôn đúng phải giữ: khi shop không có kênh liên hệ đã duyệt, trang **in một câu** (`NO_CONTACT_COPY`), không hiện nút xám vô nghĩa.
→ **Fix:** `ordering_enabled=false` phải theo đúng luật đó. **Cấm** render nút "Thêm vào giỏ" ở trạng thái disabled.

**C3 · Sập phân cấp — nhiều primary chồng nhau**
`ProductDetail.tsx:284`: **mọi** kênh liên hệ đều là `tl-shop-btn--primary tl-shop-btn--block`. Thêm "Thêm vào giỏ" primary nữa thành 2–4 khối xanh xếp dọc.
→ **Fix:** đúng **một** primary mỗi màn. Khi bán được → Thêm vào giỏ là primary, nút liên hệ tụt xuống `.tl-shop-btn` thường. Khi `ordering_enabled=false` → nút liên hệ lấy lại primary.

**C4 · Nút chỉ có 5/8 trạng thái**
`shop.css:209–246` phủ default · hover · focus-visible · active · disabled. **Không có loading, error, success.** Mà toàn bộ nút Phase 3 đều bất đồng bộ (thêm giỏ, đặt đơn, huỷ, chuyển trạng thái).
→ **Fix:** hợp đồng 8 trạng thái ở §3, kèm đúng **một** rule CSS mới (§7.1).

### Major (trông như máy sinh)

**M1 · Nút trong thẻ = lồng phần tử tương tác**
`.tl-pcard` (`shop.css:1296`) là **một anchor bọc cả thẻ**. Nhét nút "Thêm vào giỏ" vào trong = button nằm trong link, screen reader đọc nút thành một phần nhãn link.
→ **Fix:** **không** có Thêm vào giỏ trên thẻ catalog. Chỉ PDP.

**M2 · `"—"` làm giá trị tiền**
`B09Checkout.tsx:254` render `—` khi phí ship = 0. Người đọc hiểu là "chưa tính", không phải "miễn phí". D3 cấm.
→ **Fix:** `fee > 0 ? formatVnd(fee) : "Miễn phí"`. Không bao giờ `0₫`, không bao giờ `—`.

**M3 · Toast đẩy layout / toast ăn mừng**
Chưa có hệ toast nào trong Shop. Bổ sung H5 (§H bản chốt) dễ được cài thành một `<div>` chèn giữa trang → đẩy nội dung xuống ngay dưới ngón tay vừa bấm.
→ **Fix:** toast là **fixed**, không chiếm luồng, không confetti, không dấu tích to (§2.2).

**M4 · Tiền không `tabular-nums`**
`.tl-shop-price`, `.tl-pcard-price`, `.tl-shop-stat-n` đã có. Component "nhãn — giá trị" mới (bảng tổng tiền) **phải** kế thừa, nếu không cột số nhảy giữa các dòng.
→ **Fix:** `.tl-shop-row` mới đặt `font-variant-numeric: tabular-nums` trên phần giá trị (§7.2).

**M5 · Nút `tel:` không kiểm định dạng**
S09 sẽ dựng `href="tel:"` từ SĐT người mua tự gõ. `contactCta.ts:52–56` đã có khuôn đúng cho việc này (E.164 mới cho ra `tel:`).
→ **Fix:** chỉ render nút gọi khi SĐT khớp `^0\d{9}$`; không khớp thì in số dạng chữ, không tạo link.

### Minor (gu, sửa rẻ)

**m1 · Lạm phát eyebrow** — `.tl-shop-eyebrow` tối đa **1 lần/trang** (mã đơn). Cấm tag kiểu `01 · SẢN PHẨM`. Nếu dùng thì tag **nằm trên** tiêu đề cùng một cột, không bao giờ tag-trái/tiêu-đề-phải (Hallmark gate 54).

**m2 · Dấu câu** — proto xài `&ldquo;`/`...`. Production dùng `“ ”` và `…` thật.

**m3 · `:hover` trần** — `shop.css:227, 463, 779, 1309` không bọc `@media (hover: hover)`, nên trên điện thoại state hover dính lại sau khi chạm. **Nợ cũ toàn repo — KHÔNG sửa trong slice này** (diff sẽ nổ ra ngoài phạm vi). Nhưng CSS mới ở §7 **không được** đẻ thêm `:hover` trần.

**m4 · Không có Hallmark stamp — và không được thêm** — hệ token thật của dự án là `docs/design-tokens.md` + `src/styles/the-line.css` + `src/styles/shop.css`. Cấm mang theme/token của Hallmark vào.

**Tổng: 4 critical · 5 major · 4 minor.**

---

## 2. User flow

### 2.1 Luồng chính — mua được hàng

```
/shop hoặc /shop/store/:slug
   └─ chạm thẻ sản phẩm
      → /shop/product/:slug (PDP)
         ├─ chọn phiên bản → [Thêm vào giỏ]
         │     ├─ chưa đăng nhập → /login?redirect=/shop/product/:slug
         │     │                    → đăng nhập xong quay lại ĐÚNG PDP (biến thể phải chọn lại)
         │     ├─ shop ordering_enabled=false → KHÔNG có nút; hiện câu + nút liên hệ shop
         │     └─ thành công → toast "Đã thêm vào giỏ" + [Xem giỏ]  (badge giỏ +n)
         └─ [Nhắn Zalo] / [Gọi điện]  (luôn có, ở mọi trạng thái)

/shop/cart  (RequireAuth)
   └─ nhóm theo shop → [Đặt hàng shop này]
      → /shop/checkout/:shopSlug  (RequireAuth)
         ├─ điền tên · SĐT · địa chỉ (1 ô) · ghi chú giao hàng
         ├─ chọn COD (mặc định) | Chuyển khoản trước
         ├─ soát lại hàng + tổng tiền (có phí ship)
         └─ [Đặt đơn · <tổng>]
            ├─ giá/phí/tồn đổi giữa chừng → cảnh báo role="alert", cập nhật số, BẮT bấm lại
            ├─ mạng lỗi → nút mở lại thành "Thử lại", câu "chưa có đơn nào được tạo"
            └─ thành công → navigate(replace) /shop/order/:code  + state.justPlaced
               (replace = bấm Back không quay về checkout ⇒ không đặt trùng)

/shop/order/:code  (B10 + B12 CÙNG MỘT TRANG)
   ├─ state.justPlaced → thêm khối "Đã gửi đơn tới người bán" ở đầu
   └─ luôn có: việc-cần-làm-tiếp · diễn biến · hàng · địa chỉ · thanh toán · [liên hệ shop]
      ├─ pending   → [Huỷ đơn]
      └─ shipped   → [Tôi đã nhận hàng]

/shop/orders  (RequireAuth) — danh sách, mỗi dòng nói VIỆC CẦN LÀM
```

### 2.2 Luồng người bán

```
/seller  →  tab "Đơn hàng"  →  /seller/orders  (S08)
   sắp xếp: đơn có hạn trả lời lên đầu, QUÁ HẠN lên trên cùng
   → /seller/orders/:code  (S09)
      pending   → [Xác nhận đơn]        | [Từ chối đơn] (bắt buộc lý do)
      confirmed → [Đã gửi hàng]          | [Huỷ đơn] (bắt buộc lý do)
      shipped   → [Ghi nhận đã giao]     | (huỷ chỉ còn admin)
      mọi state → [Gọi người mua] · [Sao chép địa chỉ giao]
```

### 2.3 Nhánh lỗi & trường hợp đặc biệt (phải dựng, không được bỏ)

| Tình huống | Xảy ra ở | Hành vi |
|---|---|---|
| Chưa đăng nhập bấm Thêm vào giỏ | PDP | `getLoginUrl(pathname + search)` → `/login?redirect=…`. **Không** lưu (variant, qty) qua sessionStorage — *ponytail, pilot noindex, lưu lượng ~0* |
| `ordering_enabled = false` | PDP · ShopStore · Cart · Checkout | Ẩn hoàn toàn đường đặt hàng, hiện câu + nút liên hệ. Sản phẩm **vẫn nằm trong giỏ** |
| Shop không `active` | Cart · Checkout | Y hệt trên, cùng một câu |
| Biến thể hết hàng / bị retire sau khi đã vào giỏ | Cart | Dòng đó có `.tl-shop-error` + nút "Bỏ khỏi giỏ" và "Xem sản phẩm". Nút đặt của **nhóm đó** đổi thành "Cần sửa giỏ" (disabled kèm lý do ngay bên cạnh) |
| Giá đổi giữa lúc điền checkout | Checkout | `role="alert"` trên cùng: nói dòng nào, từ bao nhiêu lên bao nhiêu; tổng cập nhật; nút đặt **reset về trạng thái chưa bấm** — người dùng phải bấm lần nữa |
| Phí ship đổi giữa chừng | Checkout | Cùng khuôn, riêng dòng phí |
| Bấm Đặt đơn 2 lần / F5 giữa chừng | Checkout | `client_token` sinh **một lần** khi mở trang (giữ trong `useRef`/`sessionStorage` theo `shopSlug`); gọi lại cùng token trả về **chính đơn đó** → điều hướng tới đơn đó, không báo lỗi |
| Vượt 5 đơn `pending` (D8) | Checkout | Lỗi có nghĩa: "Anh/chị đang có 5 đơn chờ shop xác nhận…" |
| Mở đơn không phải của mình / mã sai | Order detail | **Một câu trả lời cho cả hai**: "Không tìm thấy đơn này." Không tiết lộ đơn có tồn tại hay không |
| Hai người cùng bấm (mua huỷ + bán xác nhận) | Order detail 2 phía | Guarded UPDATE → bên thua nhận `.tl-shop-notice--warn`: "Đơn vừa được cập nhật ở nơi khác…" + tự refetch |
| Tài khoản chưa thuộc shop nào | `/seller/orders` | Dùng lại nguyên khuôn `SellerProducts.tsx:118–127` |
| Vai `support` / `fulfillment` | S09 | `support`: chỉ đọc, ẩn mọi nút hành động + một câu giải thích. `fulfillment`: có nút, không có nút huỷ |

---

## 3. Hợp đồng 8 trạng thái (kỷ luật Hallmark) — viết một lần, áp cho mọi nút

Mọi phần tử tương tác ở §4 tuân theo bảng này. Ở từng màn chỉ ghi **phần khác biệt**.

### 3.1 Nút `.tl-shop-btn` (mọi biến thể)

| Trạng thái | Biểu hiện | Ghi chú kỹ thuật |
|---|---|---|
| **default** | `shop.css:209–226` | — |
| **hover** | `background: var(--tl-border)` / primary → `--tl-green-dim` (`:227`, `:233`) | Không thêm `:hover` mới |
| **focus-visible** | `outline: 2px solid var(--tl-green)`, offset 2px (`:249–253`) | **Không animate**. Không `outline: none` ở bất cứ đâu |
| **active** | `translateY(1px)` (`:244`) | Phản hồi duy nhất mà điện thoại có |
| **disabled** | `opacity .45` + `cursor: not-allowed` (`:241`) + **luôn kèm một câu nói vì sao**, đặt cạnh nút, không phải `title` | Không bao giờ disabled câm |
| **loading** | `disabled` + `aria-busy="true"`; nhãn đổi sang **thể đang-làm**; `<Loader2 size={16} className="animate-spin">` **thay** icon cũ, không thêm bên cạnh | Rule mới §7.1 giữ độ sáng để đọc được nhãn. Nút **không tự mở lại** |
| **error** | Nút quay về default, nhãn đổi thành **"Thử lại"**; thông báo lỗi nằm ở `.tl-shop-notice--danger` có `role="alert"` ngay **trên** nút | Câu lỗi = `shopErrorMessage(err)` (`src/lib/shop/errors.ts`) — RPC đã raise tiếng Việt |
| **success** | **Im lặng.** Hoặc điều hướng, hoặc dữ liệu đổi tại chỗ. Ngoại lệ duy nhất: toast "Đã thêm vào giỏ" (§4.1) và nhãn "Đã sao chép" 2 giây (§4.7) | Cấm toast ăn mừng, cấm dấu tích toàn màn |

### 3.2 Ô nhập `.tl-shop-input` / `.tl-shop-textarea`

| Trạng thái | Biểu hiện |
|---|---|
| default | `shop.css:270–283`. **Nhãn luôn hiện ở trên**, không dùng placeholder thay nhãn |
| hover | không đổi border-width; đổi nền một bậc |
| focus-visible | outline xanh 2px, **border-width không đổi** → không nhảy layout |
| active/typing | y hệt focus (không thêm state thứ hai) |
| disabled | `opacity .55` + `cursor: not-allowed` + `aria-disabled` |
| **error** | `aria-invalid="true"` + `.tl-shop-error` **thay chỗ** `.tl-shop-hint` (cùng vị trí, không đẩy trang) + `aria-describedby` trỏ tới id của dòng lỗi |
| **success** | Không có tín hiệu riêng. Giá trị đúng là tín hiệu |
| **loading** | Không áp dụng (không có validate bất đồng bộ ở slice này) |

**Validate on blur**, revalidate on change sau lần blur đầu (touched pattern). Không validate từng phím.

### 3.3 Ô số lượng `.tl-shop-qty`

default/hover/focus-visible/active/disabled từ `shop.css:947–968`. **loading**: nút +/− `disabled` + `aria-busy` trên khối, số giữ nguyên (optimistic). **error**: rollback số về giá trị cũ + `.tl-shop-error` dưới dòng. **success**: số mới đứng yên, tổng nhóm cập nhật — không toast.

---

## 4. Từng màn hình

Ký hiệu: **[T]** = tái dùng nguyên; **[M]** = sửa màn đã có; **[N]** = mới.

---

### 4.0 [M] PDP `/shop/product/:slug` — thêm đường vào giỏ

**Mục đích:** biến trang "chỉ để liên hệ" thành trang mua được, mà không đánh mất câu nói thật về việc shop tự khai.

**Vị trí chèn:** thay khối `.tl-pdp-cta` (`ProductDetail.tsx:274–309`).

**Layout (không đổi lưới):** `.tl-pdp` 1 cột <900px, 2 cột ≥900px. Khối CTA vẫn nằm dưới `.tl-pdp-seller` — người mua đọc "ai bán, gửi từ đâu, đổi trả sao" **trước** khi bấm mua. Ở 375px, khối CTA nằm gọn trong 1 màn sau khi cuộn qua ảnh; **không** dùng sticky bar (`.tl-shop-stickybar` để dành, chưa cần: trang không dài).

**Thứ tự thông tin trong khối CTA:**
1. Chọn số lượng (`.tl-shop-qty`, max = min(10, tồn nếu biết)) — **chỉ hiện khi bán được**
2. `[Thêm vào giỏ]` — `.tl-shop-btn--primary .tl-shop-btn--block`
3. Nút liên hệ (đã có) — hạ xuống `.tl-shop-btn` **không** primary
4. `.tl-shop-hint` điểm đến (đã có, giữ nguyên chữ)

**Ma trận trạng thái của nút "Thêm vào giỏ":**

| Điều kiện | Hiển thị |
|---|---|
| bán được, có tồn / tồn `unknown` | Nút primary, đủ 8 state §3.1 |
| biến thể `out_of_stock` | Nút **disabled** + câu ngay dưới: "Phiên bản này đang hết hàng. Chọn phiên bản khác, hoặc nhắn shop để hỏi." (`.tl-pdp-opt:disabled` đã gạch ngang lựa chọn — giữ) |
| chưa chọn đủ phiên bản | Nút **disabled** + "Chọn <tên nhóm> trước." |
| `ordering_enabled = false` **hoặc** shop không `active` | **Ẩn hoàn toàn** nút + ô số lượng. Thay bằng `.tl-shop-notice` (không phải `--warn`, đây không phải lỗi của người dùng): **"Shop đang tạm ngưng bán."** + "Anh/chị vẫn liên hệ trực tiếp với shop được." Nút liên hệ **lấy lại primary** |
| chưa đăng nhập | Nút **vẫn hiện bình thường** (không disabled). Bấm → `navigate(getLoginUrl(pathname + search))` |
| đang gọi RPC | loading: nhãn "Đang thêm…" |
| RPC lỗi | error: `.tl-shop-notice--danger role="alert"` trên nút, nhãn nút → "Thử lại" |
| thành công | toast §4.1 + badge giỏ tăng. **Nút quay về default** (mua tiếp được) |

**Copy**

| Khoá | VI | EN |
|---|---|---|
| `pdp.addToCart` | Thêm vào giỏ | Add to cart |
| `pdp.addToCart.busy` | Đang thêm… | Adding… |
| `pdp.addToCart.retry` | Thử lại | Try again |
| `pdp.qty.label` | Số lượng | Quantity |
| `pdp.soldOut` | Phiên bản này đang hết hàng. Chọn phiên bản khác, hoặc nhắn shop để hỏi. | This option is sold out. Pick another one, or message the shop. |
| `pdp.pickVariant` | Chọn {tên nhóm} trước. | Choose a {group} first. |
| `shop.paused.title` | Shop đang tạm ngưng bán. | This shop has paused selling. |
| `shop.paused.body` | Anh/chị vẫn liên hệ trực tiếp với shop được. | You can still contact the shop directly. |

**A11y:** ô số lượng có `<label>` thật (`.tl-shop-sr` nếu không muốn hiện chữ). Nút Thêm vào giỏ có `aria-describedby` trỏ tới câu lý do khi disabled.

---

### 4.1 [N] Toast "Đã thêm vào giỏ"

**Vì sao tồn tại:** §H.5 — người dùng điện thoại vừa bấm cần một xác nhận nhìn thấy được, không phải đi tìm badge.

**Hình thức:** một dải **fixed** ở đáy, `bottom: calc(var(--shop-bottomnav) + var(--shop-safe-b) + 8px)`, `z-index: 45` (dưới sheet 70/71, trên sticky bar 35). **Không** chèn vào luồng ⇒ không đẩy nội dung. Class mới `.tl-shop-toast` (§7.3).

**Nội dung:** một dòng chữ + nút `[Xem giỏ]` (`.tl-shop-btn--sm`) + nút đóng 44×44 (`.tl-shop-iconbtn` thu nhỏ, `aria-label="Đóng thông báo"`).

**8 trạng thái:** toast không phải phần tử tương tác — nhưng **nút "Xem giỏ" bên trong nó thì có**, theo đủ §3.1 (loading/error không xảy ra: nó là `<Link>`).

**Hành vi:**
- Bọc ngoài là một `<div role="status" aria-live="polite">` **luôn nằm trong DOM**, nội dung mới được nhét vào — nếu chỉ mount khi có toast thì screen reader thường không đọc.
- Tự ẩn sau **6 giây**. **Không** tự ẩn nếu focus đang nằm trong toast (người dùng bàn phím).
- Thêm liên tiếp → thay nội dung, reset đồng hồ, **không** xếp chồng.
- Vào/ra bằng `opacity` + `translateY(8px)`, 160ms, `--ease-out`. `prefers-reduced-motion` đã bị `shop.css:350–358` vô hiệu hoá sẵn.
- **Không** dấu tích to, **không** confetti.

| Khoá | VI | EN |
|---|---|---|
| `toast.added` | Đã thêm vào giỏ | Added to cart |
| `toast.viewCart` | Xem giỏ | View cart |
| `toast.close` | Đóng thông báo | Dismiss |

---

### 4.2 [N] `<ShopCartLink>` — badge giỏ

**Vì sao:** C1. Không có chỗ nào cho nó ngày hôm nay.

**Đặt ở đâu:** hàng trên cùng của **thân trang** mua, cùng dòng với breadcrumb:

- `/shop/product/:slug`, `/shop/store/:slug`, `/shop/search`, `/shop/category/:slug`: bọc `nav.tl-shop-crumbs` hiện có và `<ShopCartLink>` vào một `div.tl-shop-topline` (§7.4) — crumbs `flex: 1`, cart link phải.
- `/shop`: không có breadcrumb → `div.tl-shop-topline` chỉ chứa cart link, căn phải, đặt **trên** `.tl-shop-herocard`.
- **KHÔNG** đụng `tl-nav` của `TheLineLayout` (badge sẽ lan ra toàn site).
- **KHÔNG** thêm mục thứ 6 vào BottomNav (R6).

**Hình thức:** `<Link to="/shop/cart" className="tl-shop-iconbtn">` + `<ShoppingBag size={20}>` + `<span className="tl-shop-cart-count">` (CSS đã có sẵn `shop.css:464–479`).

**8 trạng thái:**

| | |
|---|---|
| default | icon `--tl-fg-2`, badge chỉ hiện khi count > 0 |
| hover | `.tl-shop-iconbtn:hover` có sẵn |
| focus-visible | ring xanh toàn cục |
| active | `:active` chung |
| disabled | **không bao giờ** — chưa đăng nhập vẫn bấm được, `/shop/cart` sẽ tự đưa qua đăng nhập |
| loading | count chưa về → **không** render badge (không skeleton cho một con số 18px) |
| error | query lỗi → **không** render badge, không báo lỗi. Một badge sai còn tệ hơn không có badge |
| success | count đổi → badge đổi số, không animate |

**A11y:** `aria-label` động: `count > 0 ? "Giỏ hàng, ${count} món" : "Giỏ hàng"`. Badge số là `aria-hidden` (nhãn đã nói rồi).
**Đếm gì:** tổng `qty`, không phải số dòng. >99 hiện `99+`.
Ẩn hoàn toàn khi chưa đăng nhập (giỏ là dữ liệu của user).

---

### 4.3 [N] B08 — Giỏ hàng `/shop/cart`

**Route:** `/shop/cart` · `RequireAuth` · `lazyRetry` · `DynamicMeta noindex` · thêm vào `NOINDEX_PATTERNS`.

**Layout:** `TheLineLayout` → `<main className="tl-shop">` → `.tl-shop-page.tl-shop-page--narrow` (max 760px, giữa). Ở 1440 vẫn 760px — form và danh sách hàng không có lý do gì kéo ngang 1240px. Không có cột tóm tắt sticky.

**Thứ tự thông tin:**
1. `<h1 className="tl-shop-h1">Giỏ hàng</h1>`
2. Một câu giải thích — **chỉ khi có ≥ 2 nhóm shop** (§H.6). Một nhóm thì ẩn hẳn.
3. Vùng live region cho Hoàn tác (`role="status" aria-live="polite"`, luôn có trong DOM)
4. Từng nhóm shop = `.tl-shop-sellergroup`
   - `-head`: tên shop (link `/shop/store/:slug`) + pill "Đã xác minh" nếu có
   - Cảnh báo cấp nhóm (nếu shop tạm ngưng)
   - `-body`: từng dòng `.tl-shop-line`
   - `-foot`: "Tạm tính" + `[Đặt hàng shop này]`
5. **Không có nút "Đặt tất cả"** ở bất kỳ đâu — và câu giải thích ở cuối trang (chỉ khi ≥2 nhóm)

**Một dòng hàng** (`.tl-shop-line`): ảnh 68px (`.tl-shop-line-media`, giữ tỉ lệ trước khi ảnh về) · tên (link về PDP) · giá trị phiên bản · thành tiền (`.tl-shop-price`) · dòng cảnh báo nếu có · hàng điều khiển `[− n +] [Bỏ]` (+ `[Xem sản phẩm]` khi hết hàng).

**Phí ship ở giỏ:** hiện đúng một dòng ở `-foot`, dưới tạm tính: `fee > 0` → "Chưa gồm phí vận chuyển ({số}), tính ở bước đặt hàng." · `fee = 0` → "Shop này **miễn phí vận chuyển**." **Không bao giờ** `0₫`/`—`.

**Trạng thái toàn trang**

| | Hiển thị |
|---|---|
| **loading** | 3 khối skeleton `.tl-shop-sk` cao 88px, có `aria-busy="true"` + `<p className="tl-shop-hint">Đang tải giỏ hàng…</p>` |
| **rỗng** | `.tl-shop-empty` + icon `<ShoppingBag size={28}>` + tiêu đề + 1 câu + `[Xem sản phẩm đang bán]` → `/shop`. ⚠️ **Bỏ** câu "Sản phẩm anh/chị lưu vẫn nằm trong mục Đã lưu" — wishlist đã cắt, link sẽ treo (§3h critic-user) |
| **lỗi** | `.tl-shop-notice--danger role="alert"` + `[Thử lại]`. Câu: "Chưa tải được giỏ hàng. Sản phẩm anh/chị đã thêm vẫn còn." |
| **không có quyền** | không tồn tại — `RequireAuth` xử lý trước |
| **`ordering_enabled=false`** | Nhóm đó: `.tl-shop-notice--warn` "Shop đang tạm ngưng bán…" + nút nhóm đổi thành **`[Liên hệ shop]`** (link `usableContacts` đầu tiên) thay vì nút disabled. Nhóm khác **không** bị ảnh hưởng |
| **dữ liệu đổi giữa chừng** | `shop_cart_view` trả `unavailable_reason` → dòng đó có `.tl-shop-error` + hành động sửa. Nút nhóm → `disabled` + câu "Còn {n} món cần sửa trước khi đặt." **Không** có cờ `price_changed` (§B.S5 — giỏ không lưu giá tham chiếu) |

**Hoàn tác khi bỏ hàng:** optimistic xoá → notice ở live region: "Đã bỏ “{tên}” khỏi giỏ. [Hoàn tác]". Tồn tại **10 giây**. **Không** dùng `useConfirm` — bỏ một món khỏi giỏ là hành động đảo ngược được (Hallmark: undo > confirm).

**Copy**

| Khoá | VI | EN |
|---|---|---|
| `cart.title` | Giỏ hàng | Cart |
| `cart.multiShop` | Giỏ có sản phẩm của **{n} shop**. Mỗi shop tự gửi hàng nên anh/chị đặt và nhận **riêng từng shop** — phí vận chuyển cũng tính riêng. | Your cart has items from **{n} shops**. Each shop ships on its own, so you order and receive **per shop** — shipping is charged separately too. |
| `cart.noPlaceAll` | Không có nút “đặt tất cả” vì mỗi shop là một đơn riêng: gửi riêng, phí riêng, đổi trả theo chính sách riêng của từng shop. | There is no “order everything” button: each shop is its own order — shipped separately, charged separately, returned under that shop’s own policy. |
| `cart.checkoutShop` | Đặt hàng shop này | Order from this shop |
| `cart.subtotal` | Tạm tính | Subtotal |
| `cart.shipLater` | Chưa gồm phí vận chuyển ({fee}), tính ở bước đặt hàng. | Shipping ({fee}) is added at checkout. |
| `cart.shipFree` | Shop này **miễn phí vận chuyển**. | This shop ships **free**. |
| `cart.remove` | Bỏ | Remove |
| `cart.remove.aria` | Bỏ {tên sản phẩm} khỏi giỏ | Remove {product} from cart |
| `cart.undone` | Đã bỏ “{tên}” khỏi giỏ. | Removed “{name}” from your cart. |
| `cart.undo` | Hoàn tác | Undo |
| `cart.outOfStock` | Phiên bản này vừa hết hàng. Bỏ ra để đặt phần còn lại, hoặc chọn phiên bản khác. | This option just sold out. Remove it to order the rest, or pick another option. |
| `cart.unpublished` | Shop vừa gỡ sản phẩm này. Bỏ khỏi giỏ để đặt phần còn lại. | The shop just removed this product. Remove it to order the rest. |
| `cart.needsFix` | Còn {n} món cần sửa trước khi đặt. | {n} item(s) need fixing before you can order. |
| `cart.empty.title` | Giỏ hàng đang trống | Your cart is empty |
| `cart.empty.body` | Thêm sản phẩm từ chợ rồi quay lại đây. | Add something from the marketplace and come back. |
| `cart.empty.cta` | Xem sản phẩm đang bán | Browse what’s for sale |
| `cart.loadError` | Chưa tải được giỏ hàng. Sản phẩm anh/chị đã thêm vẫn còn. | We couldn’t load your cart. Nothing you added has been lost. |

**A11y:** mỗi nhóm shop là `<section aria-labelledby>` trỏ tới tên shop. Ô số lượng có nhãn ẩn `"Số lượng — {tên sản phẩm}"`. Thứ tự tab = thứ tự nhìn thấy.

---

### 4.4 [N] B09 — Đặt hàng `/shop/checkout/:shopSlug`

**Route:** `:shopSlug` (không phải id — nhất quán với `/shop/store/:slug` và với commit sửa slug tiếng Việt). `RequireAuth` · `noindex` · `NOINDEX_PATTERNS`.

**Layout:** `.tl-shop-page--narrow`, **một cột ở mọi width**. Macrostructure: Long Document — các mục đánh số, cuộn thẳng một mạch, tổng tiền + nút ở cuối. **Không** sticky summary, **không** hai cột ở 1440.

**Thứ tự (đã bỏ mục "Vận chuyển" riêng — nó chỉ còn là một dòng trong tổng tiền):**

```
h1  Đặt hàng
    Đơn này chỉ gồm sản phẩm của {shop}. Sản phẩm của shop khác trong giỏ vẫn nằm nguyên ở đó.
[cảnh báo dữ liệu đổi giữa chừng — nếu có]
1. Địa chỉ nhận hàng
2. Thanh toán
3. Kiểm tra lại       (danh sách hàng, chỉ đọc)
4. Chính sách của shop (deflist, chỉ đọc)
Tổng cộng             (bảng + nút)
```

#### Mục 1 — Địa chỉ (D4: KHÔNG dropdown tỉnh)

Bốn trường, tất cả `.tl-shop-field` (nhãn trên, hint dưới, lỗi **thay chỗ** hint):

| Trường | Nhãn VI / EN | Thuộc tính | Validate (không chặt hơn server) |
|---|---|---|---|
| Họ tên | Họ tên người nhận / Recipient name | `autoComplete="name"` | bắt buộc, ≥ 2 ký tự |
| SĐT | Số điện thoại / Phone number | `inputMode="tel"`, `autoComplete="tel"`, `type="tel"` | bắt buộc, `^0\d{9}$` |
| **Địa chỉ** | **Địa chỉ nhận hàng** / Delivery address | `<textarea>` `.tl-shop-textarea`, `rows=3`, `autoComplete="street-address"`, `maxLength=300` | bắt buộc, ≥ 12 ký tự |
| Ghi chú | Ghi chú cho người giao (không bắt buộc) / Note for the courier (optional) | `<textarea>` `rows=2`, `maxLength=200` | — |

Ô địa chỉ là **một ô free-text duy nhất**, nhưng nhãn + placeholder + hint ép đủ cấp:

- **placeholder:** `Số 12 ngõ 5 Trần Duy Hưng, phường Trung Hoà, quận Cầu Giấy, Hà Nội`
- **hint (luôn hiện):** "Ghi đủ **số nhà, đường, phường/xã, quận/huyện, tỉnh/thành**. Người bán chép đúng dòng này sang phiếu gửi hàng."
- **KHÔNG** có dropdown tỉnh/thành. Repo không có danh sách hành chính sau sáp nhập 2025; ship danh sách cũ là thứ người dùng nhận ra ngay.

**Prefill** từ đơn gần nhất của chính người mua (nếu có) — không dựng sổ địa chỉ, không nút "Đổi địa chỉ"/"Dùng địa chỉ đã lưu" như proto (bỏ hẳn: một form, sửa trực tiếp).

**Focus lỗi:** submit khi còn lỗi → focus ô lỗi **đầu tiên theo thứ tự trên-xuống** + `aria-invalid` + `aria-describedby`.

#### Mục 2 — Thanh toán (D2)

Hai radio trong `<fieldset>` + `<legend className="tl-shop-sr">`, dùng `.tl-shop-check` (đã 44px). `cod` **checked mặc định**.

| | VI | EN |
|---|---|---|
| `pay.cod.label` | Trả khi nhận hàng (COD) | Pay on delivery (COD) |
| `pay.cod.hint` | Anh/chị trả tiền trực tiếp cho người giao. ThePickleHub không giữ tiền của anh/chị. | You pay the courier directly. ThePickleHub never holds your money. |
| `pay.bank.label` | Chuyển khoản trước — shop sẽ gửi thông tin | Bank transfer first — the shop will send you the details |
| `pay.bank.hint` | Đặt xong, anh/chị nhắn shop qua Zalo hoặc gọi điện để nhận thông tin chuyển khoản. ThePickleHub không nhận tiền, không giữ tiền và không tự đối soát. | After you order, message or call the shop for the transfer details. ThePickleHub does not receive, hold, or reconcile any payment. |

**Cấm:** mã QR, ô nhập số tài khoản, tên ngân hàng, "đối soát tự động", trạng thái `awaiting_payment`, nút "tôi đã chuyển". Hai phương thức hành xử **y hệt nhau** về trạng thái đơn.

#### Mục 3 — Kiểm tra lại
`<ul>` các `.tl-shop-line`, **chỉ đọc** (không sửa số lượng ở đây — quay lại giỏ). Mỗi dòng: ảnh · tên · phiên bản · `SL {n}` · thành tiền.

#### Mục 4 — Chính sách của shop
`.tl-shop-deflist` với `shipping_note` / `return_note` thật của shop. Bỏ trống thì bỏ dòng, **không** bịa.

#### Tổng cộng

`.tl-shop-card` chứa 3 dòng `.tl-shop-row` (§7.2):

```
Sản phẩm (n)          1.500.000₫
Phí vận chuyển        30.000₫      ← hoặc: Miễn phí
────────────────────────────────
Anh/chị trả           1.530.000₫
```
+ dưới dòng phí ship: `.tl-shop-hint` "Phí này áp dụng cho mọi tỉnh thành. ThePickleHub chưa nối với đơn vị vận chuyển nên **không hứa ngày giao** — người bán sẽ đưa mã vận đơn để anh/chị tự tra."
+ dưới bảng: "Không có phí nào khác. ThePickleHub không thu phí của người mua."

**Nút đặt đơn** — `.tl-shop-btn--primary.tl-shop-btn--block`, nhãn **lặp lại số tiền**:

| Trạng thái | Nhãn / hành vi |
|---|---|
| default | `Đặt đơn · 1.530.000₫` |
| hover / focus-visible / active | theo §3.1 |
| disabled | khi form còn lỗi **đã touched**, hoặc giỏ nhóm này rỗng, hoặc `ordering_enabled=false`. **Luôn kèm câu lý do** ngay dưới nút |
| **loading** | `disabled` + `aria-busy` + spinner + **"Đang gửi đơn…"**. **Không tự mở lại**. Chỉ mở lại khi có lỗi trả về |
| **error** | notice `role="alert"` **trên** nút + nhãn nút → `Thử lại · 1.530.000₫`. Câu phải nói rõ **chưa có đơn nào được tạo** |
| **success** | không toast. `navigate('/shop/order/'+code, { replace: true, state: { justPlaced: true } })` |

Dưới nút: "Bấm “Đặt đơn” là gửi yêu cầu tới {shop}. Người bán xác nhận rồi mới gửi hàng."

**Trạng thái toàn trang**

| | Hiển thị |
|---|---|
| loading | skeleton dạng form: 4 khối `.tl-shop-sk` cao 68px + 1 khối cao 120px |
| rỗng (giỏ nhóm này trống) | `.tl-shop-empty`: "Không còn món nào của shop này trong giỏ." + `[Về giỏ hàng]` |
| lỗi tải | notice danger + `[Thử lại]` |
| **`ordering_enabled=false`** | Ẩn **toàn bộ** form + nút. Chỉ còn: `.tl-shop-notice` "Shop đang tạm ngưng bán." + "Sản phẩm vẫn nằm trong giỏ, anh/chị đặt được khi shop mở lại." + nút liên hệ shop + `[Về giỏ hàng]` |
| **dữ liệu đổi giữa chừng** | `.tl-shop-notice--warn role="alert"` trên cùng, nói **đúng dòng nào và đổi từ bao nhiêu sang bao nhiêu**; tổng tự cập nhật; nút đặt **reset về default** (bắt bấm lại) |
| vượt 5 đơn pending | notice danger, câu ở bảng copy |

**Copy lỗi**

| Khoá | VI | EN |
|---|---|---|
| `co.err.network` | **Chưa tạo được đơn.** Mất kết nối lúc gửi. **Chưa có đơn nào được tạo**, và giỏ hàng của anh/chị vẫn nguyên. Bấm lại để thử tiếp. | **The order wasn’t created.** The connection dropped. **No order exists yet** and your cart is untouched. Press again to retry. |
| `co.err.priceChanged` | **Giá vừa thay đổi trong lúc anh/chị điền.** {tên}: từ {cũ} lên/xuống {mới}. Tổng bên dưới đã tính lại — xem lại rồi bấm đặt lần nữa. | **A price changed while you were filling this in.** {name}: {old} → {new}. The total below is recalculated — check it and press order again. |
| `co.err.shipChanged` | **Phí vận chuyển vừa thay đổi**: từ {cũ} thành {mới}. Tổng đã tính lại — xem lại rồi bấm đặt lần nữa. | **Shipping just changed**: {old} → {new}. The total is recalculated — check it and order again. |
| `co.err.stock` | **{tên} vừa hết hàng.** Về giỏ để bỏ món này ra rồi đặt phần còn lại. | **{name} just sold out.** Go back to the cart, remove it, and order the rest. |
| `co.err.tooManyPending` | Anh/chị đang có **5 đơn chờ shop xác nhận**. Chờ shop xử lý xong một đơn, hoặc huỷ bớt, rồi đặt tiếp. | You already have **5 orders waiting for a shop to confirm**. Wait for one to be handled, or cancel one, then order again. |
| `co.err.phone` | Số điện thoại phải có 10 chữ số, bắt đầu bằng 0. Người bán cần số này để gọi khi giao hàng. | The phone number needs 10 digits starting with 0. The seller calls this number on delivery. |
| `co.err.address` | Ghi đủ số nhà, đường, phường/xã, quận/huyện và tỉnh/thành để người bán gửi được hàng. | Include house number, street, ward, district and province so the seller can actually ship it. |
| `co.err.name` | Nhập họ tên người nhận. | Enter the recipient’s name. |

---

### 4.5 [N] B10 + B12 — Chi tiết đơn `/shop/order/:code` (MỘT trang)

> **Ponytail lớn nhất của slice này:** B10 không phải một màn riêng. Nó là B12 cộng thêm một khối dẫn nhập, bật bằng `location.state?.justPlaced`. Một route, một chunk, một chỗ sửa. F5 mất state → về đúng B12, đó là hành vi đúng (lời chào chỉ nói một lần).

**Route:** `/shop/order/:code` · `RequireAuth` · `noindex` · `NOINDEX_PATTERNS` · `.tl-shop-page--narrow`.

**Thứ tự thông tin (dòng đầu trả lời "ai làm tiếp"):**

```
[khối "vừa đặt xong" — chỉ khi justPlaced]
eyebrow  Mã đơn PH-2608-0039           ← eyebrow DUY NHẤT của trang (m1)
h1       <câu việc-cần-làm-tiếp>
[dòng LÝ DO HUỶ + AI HUỶ — nếu cancelled, đặt NGAY DƯỚI h1]        ← §H.4
[hàng nút hành động]
Vận chuyển        (mã vận đơn, hoặc câu thật khi chưa có)
Diễn biến         (.tl-shop-timeline từ shop_order_events)
Người bán         + [Nhắn Zalo] [Gọi điện]      ← MỌI trạng thái, §H.1
Sản phẩm          + Tạm tính / Phí ship / Tổng
Địa chỉ nhận
Thanh toán
```

#### 5 trạng thái = 5 câu việc-cần-làm (giữ tuyệt đối, §G)

| status | h1 (VI) | h1 (EN) | notice dưới h1 (VI) |
|---|---|---|---|
| `pending` | Shop chưa xác nhận đơn | The shop hasn’t confirmed yet | Shop thường trả lời trong **1–2 ngày**. Chưa cần làm gì. Đổi ý thì huỷ được ngay bây giờ. |
| `confirmed` | Người bán đang chuẩn bị hàng | The seller is packing your order | Chưa cần làm gì. Khi gửi xong, người bán sẽ đưa mã vận đơn ở đây. |
| `shipped` | Hàng đang trên đường tới anh/chị | Your order is on its way | Nhận được hàng rồi thì bấm **“Tôi đã nhận hàng”** để đóng đơn. |
| `delivered` | Đơn đã xong | This order is complete | Cảm ơn anh/chị. Có vấn đề gì thì liên hệ shop ở dưới. |
| `cancelled` | Đơn đã huỷ | This order was cancelled | *(thay bằng dòng lý do — xem ngay dưới)* |

**Dòng huỷ (§H.4) — bắt buộc, đứng đầu, `.tl-shop-notice--warn`:**

| ai huỷ | VI | EN |
|---|---|---|
| người mua | **Anh/chị đã huỷ đơn này** lúc {dd/MM HH:mm}. | **You cancelled this order** at {dd/MM HH:mm}. |
| người bán | **{tên shop} đã huỷ đơn này** lúc {dd/MM HH:mm}. Lý do shop ghi: “{lý do}”. | **{shop} cancelled this order** at {dd/MM HH:mm}. Their reason: “{reason}”. |
| quản trị viên | **Quản trị viên ThePickleHub đã huỷ đơn này** lúc {dd/MM HH:mm}. Lý do: “{lý do}”. | **A ThePickleHub admin cancelled this order** at {dd/MM HH:mm}. Reason: “{reason}”. |

Không có lý do (chỉ xảy ra khi buyer tự huỷ) → bỏ hẳn vế "Lý do", **không** in "—".

#### Hàng nút hành động

| status | nút |
|---|---|
| `pending` | `[Huỷ đơn]` — `.tl-shop-btn--danger` |
| `confirmed` | *(không có nút huỷ — liên hệ shop)* |
| `shipped` | `[Tôi đã nhận hàng]` — `.tl-shop-btn--primary` |
| `delivered`, `cancelled` | *(không có)* |
| **mọi status** | `[Nhắn Zalo]` / `[Gọi điện]` từ `usableContacts` — ở khối "Người bán", **không** bị điều kiện hoá bởi status |

**Nút "Huỷ đơn" — 8 trạng thái:**
default `.tl-shop-btn--danger` · hover/focus/active theo §3.1 · **disabled** không dùng (nút chỉ tồn tại khi huỷ được) · **loading** "Đang huỷ…" + `aria-busy` · **error** notice danger + nhãn "Thử lại" · **success** trang tự refetch, h1 đổi sang câu `cancelled`, dòng lý do xuất hiện — **không toast**.
**Trước khi gọi RPC:** `useConfirm({ title: "Huỷ đơn này?", description: "Đơn sẽ bị huỷ và hàng được trả lại kho của shop. Không hoàn tác được.", confirmText: "Huỷ đơn", cancelText: "Giữ đơn", destructive: true })`. Đây là hành động **không đảo ngược** → confirm là đúng (khác với bỏ hàng khỏi giỏ).

**Nút "Tôi đã nhận hàng" (D7):** cùng khuôn, `useConfirm` với "Xác nhận đã nhận hàng?" / "Đơn sẽ chuyển sang trạng thái đã giao." Loading "Đang xác nhận…".

#### Khối "vừa đặt xong" (justPlaced)

`.tl-shop-notice--info` trên cùng, **không** confetti, **không** dấu tích to:
- COD: "**Đã gửi đơn tới người bán.** Bước tiếp theo là chờ {shop} xác nhận. Anh/chị trả tiền khi nhận hàng, không phải trả gì lúc này."
- bank_transfer: "**Đã gửi đơn tới người bán.** Anh/chị nhắn hoặc gọi shop để nhận thông tin chuyển khoản — nút ở mục *Người bán* bên dưới. ThePickleHub không nhận và không giữ tiền."

#### Các mục còn lại

- **Vận chuyển:** có mã → `<strong>` mono + "ThePickleHub chưa nối với đơn vị vận chuyển nên không theo dõi được tự động — anh/chị tra mã này trên trang của hãng." · chưa có → "Người bán chưa cung cấp mã vận đơn."
- **Diễn biến:** `.tl-shop-timeline`, mỗi `shop_order_events` một `<li>`: thời gian (`-when`) · việc gì (`-what`) · ai làm (`-who`, dùng vai chứ không dùng tên: "Người mua" / "{tên shop}" / "Quản trị viên"). Dòng cuối `.is-current`.
- **Thanh toán:** COD → "**Trả khi nhận hàng.**" (§G: cấm "Chưa thanh toán") · bank_transfer → "Chuyển khoản trước. Anh/chị trao đổi trực tiếp với shop; ThePickleHub không nhận và không giữ tiền của đơn này."
- **Tổng tiền:** 3 dòng như checkout, phí ship = 0 → **"Miễn phí"**.

**Trạng thái toàn trang**

| | Hiển thị |
|---|---|
| loading | skeleton: 1 khối 32px (h1) + 3 khối 100px |
| rỗng | không tồn tại (một đơn luôn có ít nhất 1 dòng) |
| lỗi tải | notice danger + `[Thử lại]` |
| **không tìm thấy / không phải đơn của mình** | **Một câu duy nhất cho cả hai**: `.tl-shop-empty` "Không tìm thấy đơn này." + "Có thể mã đơn không đúng, hoặc đơn này không thuộc tài khoản đang đăng nhập." + `[Xem đơn của tôi]`. **Không** phân biệt hai ca — phân biệt là rò rỉ |
| dữ liệu đổi giữa chừng | RPC trả 409-style → `.tl-shop-notice--warn`: "Đơn vừa được cập nhật ở nơi khác. Trang đã tải lại số liệu mới nhất." + tự refetch. Nút vừa bấm về default |

---

### 4.6 [N] B11 — Đơn của tôi `/shop/orders`

**Route:** `RequireAuth` · `noindex` · `.tl-shop-page--narrow`.

**Layout:** h1 → ô tìm → hàng tab (`.tl-shop-cats`, cuộn ngang được ở 320px) → danh sách thẻ.

**Tab (4, theo việc chứ không theo tên trạng thái):**

| key | VI | EN | match |
|---|---|---|---|
| all | Tất cả | All | mọi status |
| active | Đang tới | On the way | `pending`, `confirmed`, `shipped` |
| done | Đã xong | Done | `delivered` |
| cancelled | Đã huỷ | Cancelled | `cancelled` |

Mỗi tab hiện số đếm thật. `role="tab"` + `aria-selected` + `aria-current="page"` (khuôn đã có ở `SellerProducts.tsx:178–198`).

**Một dòng đơn** (`.tl-shop-card`, flex, gap 12): ảnh 56px · tên shop · tên món đầu + "+{n} món khác" · `{mã đơn} · {dd/MM} · {tổng}` (tabular-nums) · **câu việc-cần-làm** (`.tl-shop-hint` màu `--tl-fg-2`, **không** phải pill — pill là `nowrap` và câu này sẽ đẩy trang ngang ở 375px) · nút phụ nếu có.

| status | câu (VI) | câu (EN) | nút |
|---|---|---|---|
| `pending` | Shop chưa xác nhận — chưa cần làm gì. Huỷ được nếu đổi ý. | Waiting for the shop to confirm — nothing to do. You can still cancel. | — |
| `confirmed` | Người bán đang chuẩn bị hàng — chưa cần làm gì. | The seller is packing — nothing to do. | — |
| `shipped` | Đang trên đường tới anh/chị. | On its way to you. | `[Tôi đã nhận hàng]` |
| `delivered` | Đã giao xong. | Delivered. | — |
| `cancelled` | Đã huỷ{, do {ai}}. | Cancelled{ by {who}}. | — |

Cả thẻ có **đúng một** link chính (tên món → `/shop/order/:code`), đạt 44px chiều cao. Nút `[Tôi đã nhận hàng]` ở đây là link về trang chi tiết (không gọi RPC từ danh sách — một RPC tiền/kho không nên bắn từ một list).

**Trạng thái toàn trang**

| | Hiển thị |
|---|---|
| loading | 4 skeleton cao 92px + `aria-busy` |
| rỗng (chưa có đơn nào) | `.tl-shop-empty` + `<Package size={28}>` + "Anh/chị chưa có đơn hàng nào" + "Đặt đơn đầu tiên từ chợ nhé." + `[Xem sản phẩm đang bán]` |
| rỗng (do tìm/lọc) | `.tl-shop-empty` "Không có đơn nào khớp “{q}”" + `[Xoá tìm kiếm]` — **hai empty khác nhau, hai câu khác nhau** |
| lỗi | notice danger + `[Thử lại]`. ⚠️ **Bỏ** "mở đơn từ email xác nhận" (§G — email đó không tồn tại). Câu đúng: "Chưa tải được danh sách đơn. Đơn của anh/chị vẫn còn nguyên." |
| không có quyền | `RequireAuth` |
| `ordering_enabled=false` | **không ảnh hưởng** — đơn cũ vẫn xem được |
| phân trang | `[Xem thêm ({n} đơn)]`, tải thêm 10 mỗi lần |

---

### 4.7 [N] S08 — Đơn hàng của shop `/seller/orders`

**Route:** `RequireAuth` + kiểm membership · `SellerShell active="orders"` · `noindex`.
**Kèm theo:** đổi `SELLER_NAV` mục `orders` từ `ready: false` → `true` (`ShopShell.tsx:82`) — nếu quên, tab vẫn hiện "Sắp có".

**Layout:** biến thể trực tiếp của `SellerProducts.tsx` — cùng khuôn, cùng class, khác dữ liệu:
- `.tl-shop-page` (1240px)
- ≥768px: `<table className="tl-shop-table">` trong `[data-desktop-only]`
- <768px: `<ul>` thẻ `[data-mobile-only]`
- ⚠️ **Không** đặt `style={{display}}` inline lên hai khối đó (bug đã bị bắt ở `SellerProducts.tsx:389–393`)

**Sắp xếp (điểm cốt lõi của màn này):** đơn có `confirm_due_at` lên trước, **quá hạn lên trên cùng**, rồi tới hạn gần nhất, rồi tới đơn không có hạn theo ngày đặt giảm dần. Sắp theo ngày đặt sẽ chôn mất đơn sắp quá hạn.

**Tab:**

| key | VI | EN | match |
|---|---|---|---|
| todo | Cần xử lý | Needs you | `pending`, `confirmed` |
| shipping | Đang giao | Shipping | `shipped` |
| done | Đã xong | Done | `delivered`, `cancelled` |
| all | Tất cả | All | mọi status |

Mặc định mở tab **Cần xử lý**.

**Cột bảng (desktop):** Mã đơn · Việc cần làm · Hạn trả lời · Khách · Tổng · *(hành động)*
**Thẻ (mobile):** mã đơn (link, ≥44px) + pill trạng thái · dòng `{dd/MM HH:mm} · {n} món · {tổng} · {COD|Chuyển khoản}` · dòng hạn (nếu có) · nút `[Mở đơn]`.

**Hạn trả lời — đây là chỗ duy nhất `confirm_due_at` được hiện (D6):**
- còn hạn: `.tl-shop-hint` màu `--shop-warning` + `<Clock size={11}>` + "Còn {n} giờ để trả lời"
- quá hạn: viền thẻ `--shop-danger`, `<AlertTriangle size={16}>`, chữ `--shop-danger`, "**Quá hạn {n} giờ**"
- ⚠️ **Không** viết câu nào ngụ ý có job tự huỷ hay "quản trị viên sẽ vào xử lý". Không có job đó.

**Việc cần làm (cột / dòng):**

| status | VI | EN |
|---|---|---|
| `pending` | Cần anh/chị xác nhận | Needs your confirmation |
| `confirmed` | Cần đóng gói và gửi hàng | Needs packing and shipping |
| `shipped` | Đang giao — chờ người mua xác nhận | Shipping — waiting for the buyer |
| `delivered` | Xong | Done |
| `cancelled` | Đã huỷ | Cancelled |

**Trạng thái toàn trang**

| | Hiển thị |
|---|---|
| loading | y hệt `SellerProducts` (`:290–299`): `aria-busy` + hint + 3 skeleton 76px |
| rỗng — tab Cần xử lý | "Không có đơn nào đang chờ anh/chị" + "Đơn mới sẽ hiện ở đây kèm hạn phải trả lời." |
| rỗng — tab khác | "Không có đơn nào ở mục này" |
| rỗng — shop chưa có đơn nào bao giờ | "Shop chưa có đơn hàng nào" + "Khi có người đặt, đơn sẽ hiện ở đây." — **ba empty, ba câu** |
| lỗi | notice danger + `[Thử lại]` (khuôn `SellerProducts.tsx:301–316`) |
| **không có quyền** | không thuộc shop nào → khuôn `SellerProducts.tsx:118–127`. Vai `support` → xem được danh sách, `.tl-shop-notice--info` "Vai trò **support** chỉ xem được đơn. Chủ shop hoặc quản lý mới xử lý đơn." |
| **`ordering_enabled=false`** | `.tl-shop-notice--warn` trên đầu: "Shop đang tạm ngưng bán nên không nhận đơn mới. Đơn đang có vẫn xử lý bình thường." |
| dữ liệu đổi giữa chừng | refetch khi cửa sổ được focus lại; không polling |

*ponytail: **không** làm badge số đếm trên tab Đơn hàng của `SellerShell`. Nó bắt mọi trang seller phải query đơn. Thêm khi có kênh đẩy thật (Telegram — việc kế tiếp #1).*

---

### 4.8 [N] S09 — Chi tiết đơn của shop `/seller/orders/:code`

**Route:** dùng `:code` (không phải `:id`) — một khoá tra cứu cho cả hai phía, và mã đơn là thứ người bán đọc qua điện thoại.
`SellerShell active="orders"` · `.tl-shop-page--narrow` · `noindex`.

**Thứ tự:**

```
h1        Đơn PH-2608-0039
sub       Đặt lúc {dd/MM HH:mm} · {Trả khi nhận hàng | Chuyển khoản trước}
[dòng hạn trả lời — nếu pending]
Việc cần làm      ← khối hành động, đặt TRƯỚC mọi thứ khác
Địa chỉ giao      ← có [Gọi người mua] + [Sao chép địa chỉ giao]
Sản phẩm          + Tạm tính / Phí ship / Tổng
Thanh toán
Diễn biến
```

#### "Việc cần làm" theo trạng thái

| status | nút | ghi chú |
|---|---|---|
| `pending` | `[Xác nhận đơn]` primary · `[Từ chối đơn]` danger | Từ chối **bắt buộc lý do** |
| `confirmed` | ô `Mã vận đơn` (không bắt buộc) + `[Đã gửi hàng]` primary · `[Huỷ đơn]` danger | Huỷ **bắt buộc lý do** |
| `shipped` | `[Ghi nhận đã giao]` | notice: "Đơn cũng tự chuyển sang *đã giao* khi người mua bấm “Tôi đã nhận hàng”." |
| `delivered` / `cancelled` | không có nút | `.tl-shop-notice` "Đơn đã kết thúc. Không còn thao tác nào." |

⚠️ **Khác proto:** mã vận đơn **không bắt buộc** (proto disable nút khi trống). Người bán Việt hay giao tay/grab, ép mã vận đơn là ép họ bịa. Hint: "Có mã thì nhập để người mua tự tra. Không có cũng gửi được."

**Nút cần lý do** → mở `useConfirm`? **Không** — `useConfirm` không có ô nhập. Dùng khuôn tại chỗ: bấm `[Từ chối đơn]` → hiện `.tl-shop-field` với `<textarea>` bắt buộc + hai nút `[Gửi từ chối]` (danger) / `[Quay lại]`. Nút gửi **disabled** khi lý do rỗng, **kèm câu** "Nhập lý do để người mua biết vì sao." Lý do này hiện nguyên văn cho người mua ở B12 (§4.5) — nói rõ điều đó ngay dưới ô: "Người mua sẽ đọc đúng câu này."

**8 trạng thái** cho mọi nút ở đây: theo §3.1. Nhãn loading: "Đang xác nhận…" / "Đang gửi…" / "Đang ghi nhận…" / "Đang huỷ…".

#### Khối "Địa chỉ giao" — hai bổ sung bắt buộc (§H.2, §H.3)

```
Nguyễn Văn A
0912345678                       [ Gọi người mua ]
Số 12 ngõ 5 Trần Duy Hưng, phường Trung Hoà, quận Cầu Giấy, Hà Nội
Ghi chú: gọi trước 15 phút
                                 [ Sao chép địa chỉ giao ]
```

**`[Gọi người mua]`** — `<a href="tel:{sđt}" className="tl-shop-btn tl-shop-btn--sm">` + `<Phone size={15}>`.
Chỉ render khi SĐT khớp `^0\d{9}$` (M5). Không khớp → in số ra chữ, **không** tạo link.
8 trạng thái: default/hover/focus/active theo §3.1; **không** có disabled/loading/error/success (là một anchor, bấm là mở app gọi).

**`[Sao chép địa chỉ giao]`** — `<button>` + `<Copy size={14}>`.
Chép: `{tên}\n{sđt}\n{địa chỉ}\n{ghi chú nếu có}`.

| Trạng thái | Biểu hiện |
|---|---|
| default | "Sao chép địa chỉ giao" |
| hover / focus-visible / active | §3.1 |
| disabled | không dùng |
| loading | không dùng (clipboard là đồng bộ) |
| **success** | nhãn đổi thành "**Đã sao chép**" + `<Check size={14}>`, **2 giây** rồi về default. Đồng thời một `role="status" aria-live="polite"` ẩn đọc "Đã sao chép địa chỉ giao" |
| **error** | (clipboard bị chặn/không có API) `.tl-shop-hint` màu danger: "Trình duyệt không cho sao chép tự động. Anh/chị bôi đen phần địa chỉ ở trên rồi copy tay." |

⚠️ **Bỏ** câu "Số điện thoại chỉ hiện tới khi đơn kết thúc 30 ngày" (§G — không có job xoá). Thay bằng: "Số điện thoại này chỉ hiện với shop vì có đơn hàng thật."

#### Thanh toán (S09)
- COD: "**Trả khi nhận hàng.** Anh/chị thu tiền trực tiếp; ThePickleHub không giữ tiền của đơn này."
- bank_transfer: "**Người mua chọn chuyển khoản trước.** Anh/chị tự gửi thông tin tài khoản và tự xác nhận đã nhận tiền. ThePickleHub không nhận, không giữ và không đối soát khoản nào."
⚠️ **Cấm** câu "chờ quản trị viên đối soát sao kê" (không còn cơ chế đó).

**Trạng thái toàn trang:** loading (skeleton) · lỗi (notice + Thử lại) · **không tìm thấy / đơn của shop khác** → một câu duy nhất "Không tìm thấy đơn này." + `[Về danh sách đơn]` · vai `support` → ẩn hết nút hành động + `.tl-shop-notice--info` giải thích · **dữ liệu đổi giữa chừng** → guarded UPDATE thua: `.tl-shop-notice--warn` "Đơn vừa được cập nhật ở nơi khác — có thể người mua vừa huỷ. Trang đã tải lại." + refetch, nút về default.

---

## 5. Component

### 5.1 Tái dùng nguyên (không sửa)

| Thứ | Ở đâu | Dùng cho |
|---|---|---|
| `TheLineLayout` | `src/components/layout/TheLineLayout.tsx` | vỏ mọi trang mua |
| `ShopScrollShell` + `SellerShell` | `src/components/shop/ShopShell.tsx` | vỏ S08/S09 |
| `LoadingState`, `ErrorState` | `src/components/states/PageStates.tsx` | loading/lỗi cấp trang |
| `DynamicMeta noindex` | `src/components/seo/DynamicMeta` | mọi route mới |
| `useConfirm()` | `src/hooks/useConfirm.tsx` | huỷ đơn, xác nhận đã nhận hàng |
| `usableContacts` / `contactHref` / `CONTACT_LABEL` | `src/lib/shop/contactCta.ts` | nút liên hệ shop ở **mọi** trạng thái đơn |
| `formatVnd` | `src/lib/shop/publicCatalog.ts` | **mọi** số tiền mới (đừng dùng `vnd` của `productState` cho màn mua) |
| `publicMediaUrl`, `mediaBox` | `src/lib/shop/publicCatalog.ts` | ảnh sản phẩm trong dòng đơn/giỏ |
| `shopErrorMessage`, `isConflict` | `src/lib/shop/errors.ts` | mọi câu lỗi RPC |
| `getLoginUrl` | `src/lib/auth-config.ts` | chuyển hướng đăng nhập kèm `redirect` |
| `RequireAuth` | `src/components/auth/RequireAuth.tsx` | mọi route mới |
| class `tl-shop-*` | `src/styles/shop.css` | toàn bộ trình bày |

### 5.2 Component mới (chỉ 5 — tối thiểu)

| Component | File | Props (mô tả, không phải code) | Vì sao phải mới |
|---|---|---|---|
| `ShopCartLink` | `src/components/shop/CartLink.tsx` | không có prop; tự query count | C1. **Không** đặt vào `ShopShell.tsx`: file đó chứa `SellerShell` + `AdminShopFrame`, import từ trang mua sẽ kéo nav người bán/admin vào chunk người mua |
| `CartAddedToast` | cùng file `CartLink.tsx` | `open`, `onClose`; nội dung cố định | §4.1. Cùng file vì cùng chủ đề giỏ, không đẻ thêm file |
| `OrderStatusLine` | `src/components/shop/OrderStatusLine.tsx` | `status`, `side: "buyer" \| "seller"`, `cancelledBy`, `cancelReason`, `cancelledAt` | Câu việc-cần-làm dùng ở **4 chỗ** (B11 dòng, B12 h1, S08 dòng, S09 h1). Một chỗ sửa, không phải bốn |
| `OrderMoneyRows` | `src/components/shop/OrderMoneyRows.tsx` | `itemsTotalVnd`, `shippingFeeVnd`, `totalVnd`, `itemCount` | Luật "Miễn phí" (M2) phải nằm **một chỗ**. Dùng ở checkout, B12, S09 |
| `OrderTimeline` | `src/components/shop/OrderTimeline.tsx` | `events[]` (at, from, to, actorKind, reason) | Dùng ở B12 + S09. Render `.tl-shop-timeline` đã có |

### 5.3 Logic thuần (không React) — bắt buộc có unit test

| File | Nội dung |
|---|---|
| `src/lib/shop/orderState.ts` | Soi gương máy trạng thái SQL theo khuôn `productState.ts`: `ORDER_STATUS_BUYER_LINE`, `ORDER_STATUS_SELLER_LINE`, `ORDER_STATUS_TONE`, `canBuyerCancel(status)`, `canBuyerConfirmDelivery(status)`, `sellerActions(status, role)`, `TRANSITIONS` (cặp hợp lệ/không hợp lệ). Test khẳng định danh sách khớp SQL |
| `src/lib/shop/orderFormat.ts` *(hoặc gộp vào `orderState.ts`)* | `shippingLabel(fee)` → `"Miễn phí"` khi 0 · `telHref(phone)` → `null` nếu không khớp `^0\d{9}$` · `addressForClipboard(addr)` |

### 5.4 Hook mới

`src/hooks/shop/useCart.ts` — `useCartCount()`, `useCartView()`, `useCartMutations()` (add/setQty/remove/undo).
`src/hooks/shop/useOrders.ts` — `useBuyerOrders()`, `useOrder(code)`, `useSellerOrders()`, `useOrderTransition()`, `useOrderCreate()`.
Cùng khuôn React Query như `useSellerProducts.ts` (queryKey có `shopId`/`userId`, `staleTime`, `refetch` cho nút Thử lại).

---

## 6. Microcopy — bảng gộp những chuỗi then chốt

*(Các chuỗi theo màn nằm ở §4. Đây là những chuỗi dùng chung nhiều nơi.)*

| Khoá | VI | EN |
|---|---|---|
| `shop.paused` | Shop đang tạm ngưng bán. | This shop has paused selling. |
| `shop.paused.cartKept` | Sản phẩm vẫn nằm trong giỏ, anh/chị đặt được khi shop mở lại. | Your items stay in the cart; you can order once the shop reopens. |
| `order.contactShop` | Liên hệ shop | Contact the shop |
| `order.cancel` | Huỷ đơn | Cancel order |
| `order.cancel.busy` | Đang huỷ… | Cancelling… |
| `order.cancel.confirm.title` | Huỷ đơn này? | Cancel this order? |
| `order.cancel.confirm.body` | Đơn sẽ bị huỷ và hàng được trả lại kho của shop. Không hoàn tác được. | The order is cancelled and the stock goes back to the shop. This cannot be undone. |
| `order.cancel.confirm.yes` | Huỷ đơn | Cancel it |
| `order.cancel.confirm.no` | Giữ đơn | Keep it |
| `order.received` | Tôi đã nhận hàng | I’ve received it |
| `order.received.busy` | Đang xác nhận… | Confirming… |
| `order.received.confirm` | Xác nhận đã nhận hàng? Đơn sẽ chuyển sang “đã giao”. | Confirm you received this? The order moves to “delivered”. |
| `order.notFound` | Không tìm thấy đơn này. | We couldn’t find this order. |
| `order.notFound.body` | Có thể mã đơn không đúng, hoặc đơn này không thuộc tài khoản đang đăng nhập. | The code may be wrong, or this order doesn’t belong to the account you’re signed in with. |
| `order.conflict` | Đơn vừa được cập nhật ở nơi khác. Trang đã tải lại số liệu mới nhất. | This order was just updated elsewhere. The page has reloaded with the latest. |
| `money.shippingFree` | Miễn phí | Free |
| `money.shippingLabel` | Phí vận chuyển | Shipping |
| `money.itemsLabel` | Sản phẩm ({n}) | Items ({n}) |
| `money.totalBuyer` | Anh/chị trả | You pay |
| `money.totalSeller` | Tổng đơn | Order total |
| `money.noOtherFees` | Không có phí nào khác. ThePickleHub không thu phí của người mua. | No other fees. ThePickleHub charges buyers nothing. |
| `money.shipEveryProvince` | Phí này áp dụng cho mọi tỉnh thành. | This fee applies to every province. |
| `ship.noPromise` | ThePickleHub chưa nối với đơn vị vận chuyển nên không hứa ngày giao — người bán sẽ đưa mã vận đơn để anh/chị tự tra. | ThePickleHub isn’t connected to any courier, so we promise no delivery date — the seller gives you a tracking code to check yourself. |
| `pay.codShort` | Trả khi nhận hàng | Pay on delivery |
| `pay.bankShort` | Chuyển khoản trước | Bank transfer first |
| `common.retry` | Thử lại | Try again |
| `common.back` | Quay lại | Back |

**Giọng văn:** xưng "anh/chị", không "bạn". Câu ngắn, chủ ngữ rõ (ai làm gì). Không dấu chấm than. Không emoji. Không "tuyệt vời", "chúc mừng". Mỗi câu lỗi phải trả lời đủ ba việc: **hỏng gì · vì sao · làm gì tiếp**.

**Chuỗi bị cấm (§G) — không được xuất hiện ở bất kỳ đâu:**
`"Shop bị tạm ngưng"` · `"Đã hoàn tiền"` · `"Chưa thanh toán"` · `"Quá hạn thì quản trị viên vào xử lý"` · `"tự chuyển thành khiếu nại"` · `"Đơn tự huỷ sau 48 giờ"` · `"email xác nhận"` · `"SĐT chỉ hiện tới khi đơn kết thúc 30 ngày"` · `"đối soát sao kê"` · mọi nhắc tới VietQR, khiếu nại, đánh giá, wishlist, "Đã lưu".

---

## 7. CSS mới — đúng 4 khối, tất cả trong `src/styles/shop.css`

Không file CSS mới. Không token mới ngoài phần đã có. Không hex thô (gate 48).

**7.1 · Nút đang tải** (bù state thiếu, C4)
```
.tl-shop-btn[aria-busy="true"]:disabled { opacity: 1; cursor: progress; }
```
Một dòng. Không có nó thì nhãn "Đang gửi đơn…" mờ 45% ngay lúc người dùng cần đọc nó nhất.

**7.2 · Hàng nhãn — giá trị** (M4) — `.tl-shop-row`: flex, `justify-content: space-between`, `gap: 12px`, `font-size: 13.5px`, `padding: 6px 0`; phần giá trị `font-variant-numeric: tabular-nums; text-align: right`. (Thay cho `Row` của proto — proto không dùng được.)

**7.3 · Toast** — `.tl-shop-toast`: `position: fixed; left: 12px; right: 12px; bottom: calc(var(--shop-bottomnav) + var(--shop-safe-b) + 8px); z-index: 45;` flex, gap 10, `background: var(--tl-bg-elev)`, `border: 1px solid var(--tl-border-2)`, `border-radius: var(--tl-radius)`, `padding: 10px 12px`, `box-shadow: var(--shop-shadow-2)`. Từ 768px: `left: auto; right: 16px; max-width: 380px;`. Vào/ra: `opacity` + `translateY(8px)`, 160ms.

**7.4 · Hàng trên cùng** — `.tl-shop-topline`: flex, `align-items: center`, `gap: 8px`; `> .tl-shop-crumbs { flex: 1; min-width: 0; }`.

---

## 8. Responsive & accessibility

### 8.1 Kiểm ở 5 width

| Width | Phải đúng |
|---|---|
| **320** | Không cuộn ngang. Tab `.tl-shop-cats` cuộn ngang được. Nhãn nút "Đặt đơn · 1.530.000₫" **không xuống 2 dòng** — nếu tràn, cho phép xuống dòng bên trong nút bằng cách để `.tl-shop-btn--block` cao 2 dòng, **không** cắt chữ, **không** thu nhỏ font dưới 13px |
| **375** | Mục tiêu chính. Ở B12, h1 + dòng notice + hàng nút nằm trọn trong màn đầu |
| **414** | Không có gì thay đổi so với 375 |
| **768** | S08 chuyển từ thẻ sang bảng (`[data-desktop-only]` bật ở `min-width: 768px`). Trang mua vẫn 1 cột 760px |
| **1440** | `.tl-shop-page--narrow` vẫn 760px căn giữa. **Không** kéo form ngang. S08 dùng 1240px |

**Chi tiết mobile:**
- `.tl-shop-textarea` cho địa chỉ: `rows=3`, `resize: vertical` (đã có). Ở 375px với bàn phím bật, đảm bảo ô không bị header sticky che → không dùng `scroll-into-view` thủ công, để trình duyệt lo.
- Ô nhập `font-size: 15px` (`shop.css:281`) — **giữ nguyên**, đừng hạ, iOS sẽ tự zoom.
- Nút chính ở checkout là `--block` full-width; nút phụ xếp dọc dưới 560px (`.tl-shop-cta-row` đã có rule `flex: 1 1 100%`).
- Bảng tiền không bao giờ nằm trong `.tl-shop-tablewrap` cuộn ngang — dùng `.tl-shop-row`.
- Ảnh dòng đơn: `.tl-shop-line-media` rộng 68px, `.tl-shop-media` giữ `aspect-ratio: 1/1` → đặt chỗ trước khi ảnh về, không CLS.

### 8.2 Accessibility (WCAG 2.1 AA)

**Contrast** — mọi màu đến từ token đã được `src/styles/__tests__/contrast.test.ts` kiểm. Ba luật khi viết mới:
1. Chữ nhỏ trên `.tl-shop-card` dùng `--tl-fg-3`, **không** `--tl-fg-4` (fg-4 chỉ đạt 4.24:1 trên surface — ghi chú `shop.css:1015`).
2. Nền màu **luôn** đi kèm màu chữ tương ứng: `--tl-green` → `--shop-on-accent`; `--shop-danger-fill` → `--shop-on-danger`. Không bao giờ `color: white` thô.
3. Trạng thái không bao giờ chỉ báo bằng màu: dòng quá hạn ở S08 có **icon + chữ "Quá hạn" + màu**; dòng lỗi ở giỏ có **icon + câu + màu**.

**Bàn phím**
- Thứ tự tab = thứ tự nhìn thấy ở mọi màn.
- Focus ring 2px xanh, offset 2px (`shop.css:249–253`), **không animate**, không bị `outline: none` ở đâu.
- Toast: focus **không** tự nhảy vào; nhưng khi tab tới thì đồng hồ tự-ẩn dừng lại.
- `useConfirm` dùng Radix AlertDialog → focus trap + Escape có sẵn.
- Nút "Từ chối đơn" mở ô lý do → focus tự vào `<textarea>` đó.

**aria-live**
| Nơi | Vai trò |
|---|---|
| Toast "Đã thêm vào giỏ" | `role="status" aria-live="polite"` — wrapper **luôn trong DOM** |
| Hoàn tác bỏ hàng khỏi giỏ | `role="status" aria-live="polite"` |
| "Đã sao chép địa chỉ giao" | `role="status" aria-live="polite"`, nội dung ẩn `.tl-shop-sr` |
| Mọi lỗi chặn hành động (đặt đơn hỏng, giá đổi, transition thua race) | `role="alert"` (assertive) |
| Số kết quả danh sách đơn | `role="status"` (khuôn `SellerProducts.tsx:359`) |
| Khối skeleton | `aria-busy="true"` trên container + một `.tl-shop-hint` nói "Đang tải…" |

**Nhãn & ngữ nghĩa**
- Mỗi trang **một** `<h1>`. `ShopHeader`/`SellerShell` dùng `<p className="tl-shop-header-title">`, không phải h1 (khuôn đã có).
- Mỗi `<section>` có `aria-labelledby` trỏ tới `<h2>` của nó; h2 nào không muốn hiện thì `.tl-shop-sr`.
- Nút icon-only (đóng toast, badge giỏ) có `aria-label` tiếng Việt.
- Ô nhập: `<label>` thật, `aria-invalid`, `aria-describedby` trỏ tới hint **hoặc** lỗi (một trong hai, cùng một `id`).
- `<fieldset>` + `<legend>` cho nhóm radio thanh toán.
- Tab dùng `role="tab"` + `aria-selected`, **không** dùng `aria-current="page"` lẫn lộn (khuôn hiện tại dùng cả hai — mới thì chỉ `aria-selected`).
- `prefers-reduced-motion`: đã bị `shop.css:350–358` vô hiệu hoá toàn bộ animation trong `.tl-shop`. Toast mới nằm ngoài `.tl-shop` (fixed ở body) → **phải tự khai** `@media (prefers-reduced-motion: reduce)` cho riêng nó.

### 8.3 noindex (S6.1 — không cắt)

Thêm vào `NOINDEX_PATTERNS` (`functions/_middleware.ts:55–130`), **không** vào `SHOP_PUBLIC_PATTERNS`:
```
/^\/(?:vi\/)?shop\/cart(?:\/|$)/
/^\/(?:vi\/)?shop\/checkout(?:\/|$)/
/^\/(?:vi\/)?shop\/order(?:\/|$)/     ← phủ cả /shop/orders
/^\/(?:vi\/)?seller\/orders(?:\/|$)/
```
Hiện các đường dẫn này **không khớp pattern nào**. Đây là trang có tên, số điện thoại, địa chỉ nhà. Cập nhật cả hai file robots + `MIRRORED` (`src/App.tsx:571`) + regenerate `route-snapshot.json`. Mọi trang mới cũng đặt `<DynamicMeta noindex />` (nửa SPA của cùng câu trả lời).

---

## 9. Những gì đã cố tình KHÔNG làm

| Bỏ | Thêm lại khi nào |
|---|---|
| Giữ (variant, qty) qua sessionStorage khi khách chưa đăng nhập | Khi phễu cho thấy có rơi thật ở bước đăng nhập |
| Badge số đếm đơn trên nav người bán | Khi có kênh đẩy thật (Telegram — việc kế tiếp #1) |
| Toast dùng chung toàn app / thư viện toast | Khi có màn thứ ba cần toast |
| Hai cột / summary sticky ở checkout desktop | Không bao giờ, ở 760px không có gì để sticky |
| Dropdown tỉnh/thành | Khi có danh sách hành chính **sau sáp nhập 2025** đã kiểm chứng |
| Sổ địa chỉ, nút "Đổi địa chỉ" | Khi một người mua thật có 2 địa chỉ |
| Sticky commerce bar trên PDP | Khi PDP dài quá 2 màn ở 375px |
| Nối `useI18n` cho 7 màn mới | Slice riêng — chuỗi EN đã viết sẵn ở đây |
| Bắt buộc mã vận đơn | Không bao giờ — người bán Việt hay giao tay |

---

## 10. Danh sách kiểm cho agent code (dán vào PR)

- [ ] 320/375/414/768/1440 — không cuộn ngang ở cả 7 màn
- [ ] Mọi vùng chạm ≥ 44×44 (kể cả nút đóng toast, badge giỏ, nút Bỏ ở giỏ)
- [ ] Mỗi nút bất đồng bộ có đủ 8 trạng thái §3.1 — **đặc biệt là loading không tự mở lại và error đổi nhãn thành "Thử lại"**
- [ ] Không nút disabled nào thiếu câu giải thích bên cạnh
- [ ] `grep -r "Shop bị tạm ngưng" dist/` → rỗng · `node scripts/check-bundle-size.mjs` xanh
- [ ] `grep -r "src/proto" src/pages/shop src/components/shop` → rỗng
- [ ] Không chỗ nào render `0₫` hoặc `—` cho phí ship
- [ ] Nút liên hệ shop hiện ở **cả 5** trạng thái đơn phía người mua
- [ ] Đơn `cancelled` → dòng ai-huỷ + lý do nằm **trên** mọi thứ khác
- [ ] `/shop/order/:code` mở bằng đơn của người khác → đúng một câu, không lộ đơn có tồn tại
- [ ] 4 pattern noindex đã vào `_middleware.ts` + robots + `MIRRORED` + `route-snapshot.json`
- [ ] `SELLER_NAV.orders.ready` đã đổi thành `true`
- [ ] `orderState.ts` có unit test cặp transition hợp lệ/không hợp lệ, khớp danh sách trong SQL
- [ ] Toast tự khai `prefers-reduced-motion` (nó nằm ngoài `.tl-shop`)
```

---

Đường dẫn liên quan (tuyệt đối):

- Nguồn chốt: `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3/docs/build-feature/shop-phase-3/02-final-analysis.md`
- Chuẩn UI phải bám: `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3/src/styles/shop.css`
- Màn bị sửa: `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3/src/pages/shop/ProductDetail.tsx` (khối CTA dòng 274–309), `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3/src/components/shop/ShopShell.tsx` (dòng 82 `orders.ready`), `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3/functions/_middleware.ts` (`NOINDEX_PATTERNS`, dòng 55–140), `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3/src/App.tsx` (dòng 571 `MIRRORED`, 573–577 routes)
- Khuôn tái dùng: `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3/src/pages/shop/SellerProducts.tsx` (bảng-desktop/thẻ-mobile, 3 kiểu empty, loading, lỗi), `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3/src/lib/shop/contactCta.ts`, `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3/src/lib/shop/productState.ts` (khuôn cho `orderState.ts`), `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3/src/hooks/useConfirm.tsx`

Hai điều đáng gọi tên riêng, vì chúng là chỗ spec dễ bị đọc lướt:

1. **B10 không phải màn thứ 8.** Nó là `/shop/order/:code` với `location.state.justPlaced`. Đó là cắt bớt một route, một chunk và một bản sao logic trạng thái.
2. **Badge giỏ không có chỗ đứng trong code hiện tại** — `ShopHeader` có CSS badge nhưng không trang mua nào dùng `ShopHeader`, tất cả đều đi qua `TheLineLayout`. Nếu agent code không đọc kỹ §4.2, khả năng cao nó sẽ nhét badge vào `tl-nav` và badge giỏ hàng sẽ xuất hiện trên `/live`, `/feed`, `/blog`.

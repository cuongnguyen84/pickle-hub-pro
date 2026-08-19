# UI/UX critic — shop-catalog-phase-2a

> Nguyên văn output agent `ui-ux-critic` (có ý kiến GPT-5.6 `gpt-5.6-terra`, reasoning high).
> Prompt + reply đã lưu: `external/01-prompt-gpt56.md`, `external/02-reply-gpt56.md`.

## Đánh giá tổng thể

Prototype được duyệt **trước** khi ba quyết định "đã chốt" ra đời, nên nó mô tả một cửa hàng có giỏ, có đơn, có số tồn kho — Phase 2a không có cái nào. Bỏ số tồn kho là việc dễ; cái gãy thật là **trang sản phẩm mất lý do tồn tại**: không giỏ, không đơn, không ô liên hệ người bán trong bảng `shops`, và `ChatFAB` đã bị ẩn trên `/shop`. Người đứng cạnh sân bấm link Facebook, xem cây vợt, rồi… không có nút nào để làm gì tiếp.

Phần seller ngược lại: form 8 phần viết tử tế, copy VI tự nhiên hơn mức trung bình repo. Nhưng ma trận phiên bản và ô tải ảnh mới chỉ là ảnh chụp một trạng thái đẹp — với 16 phiên bản giày và 4G ở sân, cả hai đều sập.

**Sáu blocker. Bốn trong sáu sửa xong thì code ÍT ĐI, không nhiều hơn.**

## Luồng người mua — đứt ở đâu

```
Link Facebook/Zalo → /shop/product/:slug (deep link, lần đầu vào site)
  → xem ảnh, chọn màu/size → thấy giá, "Còn hàng", biết ai bán
  → ??? ← ĐỨT
```
`shops` (`20260811090000...sql:105-128`) có `slug,name,state,owner_user_id,city,intro,verified_*` — **không cột liên hệ nào**. `shop_applications.phone` là dữ liệu riêng tư thu ở Phase 1, không có consent công khai. `ChatFAB.tsx:44-51` ẩn nút chat trên `/shop` với lý do *"liên hệ người bán nằm trong đơn hàng"* — 2a không có đơn hàng. **Lý do đó hết hiệu lực đúng lúc nó cần nhất.**

Deep link từ Facebook nghĩa là **og:image quyết định có ai bấm vào không**. Không có `renderProduct`, không có `og-image-product` → link share vào group ra ô xám. Đó là kênh acquisition chính.

## 6 blocker

| # | Vấn đề | Sửa |
|---|---|---|
| **1** | **PDP không có hành động tiếp theo.** `B04Product.tsx:315-328` + StickyCommerceBar là "Thêm vào giỏ" → không có giỏ | 2 cột vào `shops`: `contact_channel CHECK (IN ('zalo','phone','facebook'))` + `contact_value`. Thu ở bước gửi duyệt sản phẩm đầu, consent **hiện nguyên văn**. CTA = `Nhắn Zalo cho shop` → `zalo.me/<phone>`. Shop chưa khai → CTA `Xem shop` + **chặn gửi duyệt** |
| **2** | **Pill trượt WCAG AA ở light mode** — đo thật trên `--tl-surface-2` light `#e6e2d5`: stock-ok **1.99:1**, used **1.99:1**, danger 3.65, warn 4.14, verified 4.46. Chữ 11.5px/600 cần 4.5. Light mode bật được qua `ShopShell.tsx:35-36`. **P5 tái diễn** — token chỉ đo trên nền dark | `[data-mode="light"] .tl-shop { --shop-stock-ok:#0b6b40; --shop-used:#a33c12; --shop-danger:#b3271c; --shop-warning:#6f4f08; --shop-verified:#14539f; }` (5.08/5.04/5.03/5.79/5.85). Thêm test contrast **cả hai mode** vào gate Q |
| **3** | **Chưa có quy tắc cho sửa sản phẩm ĐANG BÁN.** "Duyệt là lên luôn" chỉ trả lời lần đăng đầu. (a) sửa lên thẳng → ảnh bị tráo thành hàng nhái không ai thấy; (b) sửa về `pending_review` → sản phẩm biến mất, người bán sẽ không sửa gì nữa | Chia trường theo tầng. **Lên ngay:** còn/hết, giá, mô tả, phí ship, ngừng bán. **Phải duyệt:** tên, ảnh, danh mục, tình trạng mới/cũ, thông số. Trong lúc chờ, **sản phẩm vẫn Đang bán, buyer thấy bản đã duyệt cũ**. Rẻ nhất: `products.pending_changes JSONB` + `product_media.is_pending` — một cột, không một bảng. Danh sách hiện **2 chip**: `Đang bán` + `Bản sửa chờ duyệt` |
| **4** | **Tải ảnh nhiều file: 1 banner lỗi toàn trang cho N file.** `S06ProductNew.tsx:232-245`. Trên 4G ở sân, ảnh thứ 6 lỗi = mất công 5 ảnh trước. **Chỗ mất công người bán lớn nhất cả Phase 2a** | Trạng thái **trong từng ô ảnh**. 6 trạng thái/file. Ô quá 8MB **không có "Thử lại"** — chỉ `Chọn ảnh khác`. Upload **thẳng lên storage ngay khi chọn**, form chỉ giữ path. Banner tổng chỉ là tóm tắt **có link nhảy**. Ảnh bìa đổi bằng nút trong menu `⋯` 44px, **không kéo-thả** |
| **5** | **Ma trận phiên bản không dùng được với dữ liệu thật.** `Forms.tsx:267-295` — 2 màu × 8 size = 16 phiên bản = **~3.200px form + 16 mã hàng gõ bằng ngón cái**. Lỗi trùng SKU là banner không link nhảy | Thu thẻ xuống **hàng 64px** + bottom sheet. Hai phép cắt **giảm code**: (a) **tự sinh SKU**; (b) **giá riêng theo phiên bản là opt-in** — mặc định một giá. Trùng SKU báo **3 tầng** có link nhảy. Chip lọc `Tất cả/Còn/Hết/Có lỗi`. Trần tổ hợp (60) báo **trước khi sinh** |
| **6** | **"Xem trước như người mua" sẽ nói dối theo đúng thiết kế** nếu render từ state local: hiện giá chưa lưu, ảnh `blob:` buyer không tải được | Preview = **chính component PDP thật**, đọc qua **đúng view/RPC công khai**, khác duy nhất ở policy cho chủ shop đọc row chưa `active` của mình. Banner đặt **ngoài** component dùng chung. Test: DTO preview và DTO công khai **cùng schema** |

## 16 mục "nên sửa" / nit (rút gọn)

7. `.tl-shop [data-mobile-only]{display:block}` (`shop.css:1036`, 0,2,0) đè `.tl-shop-varcards{display:flex}` (0,1,0) → **mất gap**, thẻ dính nhau ở mobile. Sửa 1 dòng.
8. **53 chỗ `.tl-shop-btn--sm` cao 36px** trong khi tiêu chí done là ≥44. `@media (pointer:coarse){min-height:44px}` — hoặc bỏ lời tuyên bố 44px, đừng giữ cả hai.
9. Vùng cuộn `tabIndex={0}` **không có tên** (`S05Products.tsx:83`, `Forms.tsx:219`, `B03Category.tsx:166`). `<caption class="tl-shop-sr">` không đặt tên cho wrapper.
10. `aria-current="page"` dùng sai trên nút lọc (`S05Products.tsx:198,209`) → `aria-pressed`.
11. `--tl-fg-4` đang sống ở `ShopShell.tsx:171` (mục "sắp có") → `--tl-fg-3`.
12. **Copy về đơn hàng trong màn sửa nói về thứ không tồn tại** (`S07ProductEdit.tsx:121-138,188-190`). Xoá khối open-orders.
13. Phí ship và đổi trả hiện như **cam kết của nền tảng** (`B04Product.tsx:305-307`). Gắn nhãn khai báo: "Người bán khai…".
14. Autosave hứa sai khi ảnh đang tải (`S06ProductNew.tsx:92-94`). Chip 3 dòng.
15. Anchor `href="#id"` chưa chứng minh trong scroller riêng — repo đã dính đúng lỗi này. Gate phải **cuộn thật rồi đọc `scrollTop`**, không chụp ảnh.
16. Không có og:image sản phẩm → link Facebook ra ô xám. Kênh vào chính.
17. CLS lưới sản phẩm. `optimizeImageUrl` là transform CDN Supabase — **chỉ chạy trên bucket public**. Ảnh bìa PDP là LCP → **eager**.
18. `--shop-stock-low` thành token mồ côi khi bỏ "Chỉ còn N". Xoá cùng lúc.
19. Danh sách thiếu thao tác hằng ngày: menu `⋯` 44px → bật/tắt còn hàng.
20. **Bỏ SKU khỏi PDP** (`B04Product.tsx:288`) — mã kho nội bộ, buyer không dùng được.
21. Câu "Bắt buộc: danh mục, tên, ảnh, giá" mâu thuẫn ô tick bắt buộc ở phần 7.
22. **Không hiện pill "Chưa xác minh"** — với pilot vài shop, hầu hết sẽ chưa xác minh, đọc như cảnh báo.

## Accessibility (WCAG 2.1 AA)

- **1.4.3 Contrast — FAIL, blocker** (#2, #11)
- **2.5.5 / tiêu chí nội bộ 44px — FAIL** (#8). Đúng chữ WCAG thì 36px *qua* (2.5.5 là AAA), nhưng đây là tiêu chí done team tự đặt, và là màn hình một tay ngoài sân
- **4.1.2 Name/Role/Value — FAIL** (#9, #10)
- **1.3.1/2.4.1 Landmark — PASS ở seller** (`ShopShell.tsx:129`). **Cần kiểm `AdminShopFrame`** — `.tl-admin-body` là `div`; chỉ pass nếu `AdminLayout` đã có `<main>`, và **không được 2 `<main>` lồng nhau**
- **2.4.6 Heading — PASS.** Giữ kỷ luật `ShopHeader` dùng `<p>` và chèn `h2.tl-shop-sr` khi cần
- **1.4.10 Reflow** — P12 đã vá, nhưng **phép đo phải so mép phải với hộp scroller**. Ma trận mới phải đo lại ở 320/375/414/768
- `alt` = tên sản phẩm + tên phiên bản, **không** rỗng, không "ảnh sản phẩm"

## Đồng thuận Claude × GPT-5.6 (hai model độc lập → tín hiệu thật)

- Xoá nhánh `stock <= 3`, ô nhập số, quantity stepper, "Tạm tính". **Không giữ `stock = null` làm trạng thái thứ ba** — `in_stock BOOLEAN NOT NULL DEFAULT true`
- Thay cảm giác khan hiếm bằng **`availability_updated_at`**, nói rõ *shop* cập nhật chứ không phải nền tảng xác minh. **Cả hai model tự nghĩ ra cùng giải pháp**
- Card chỉ hiện `Hết hàng`, **không** hiện `Còn hàng` trên mọi thẻ
- Thẻ 200px/phiên bản không dùng được → hàng gọn + bottom sheet + tự sinh SKU + lỗi 3 tầng
- Trạng thái upload per-file; file thành công không bao giờ mất; lỗi quá dung lượng **không có** "Thử lại"
- `restricted` → **"Bị ẩn"**; `archived` → nhãn **"Đã ngừng bán"**
- Sản phẩm đang bán **không được biến mất** khi sửa; đổi còn/hết lên ngay
- Preview dùng **đúng component PDP qua đúng phép chiếu công khai**
- **Không** bật lại `ChatFAB` trên `/shop` — chat cộng đồng không phải kênh liên hệ người bán

## 3 bất đồng với GPT-5.6 — critic chốt

1. **CTA chính của PDP.** GPT: cấm mọi nhãn liên hệ, CTA phải là `Xem shop`. Critic: `Xem shop` là ngõ cụt; catalog không có đường chạm người bán sẽ làm shop pilot bỏ đi vì zero lead. **Chốt: đường Zalo có consent.** Lý do: GPT đúng nguyên tắc nhưng thiếu bối cảnh — ở VN Zalo *là* kênh giao dịch mặc định, và `zalo.me` **hoàn thành 100%** điều nó hứa. Nó cũng đang xảy ra ngoài đời: người mua đi tìm số trong ảnh — chính vì thế `S06ProductNew.tsx:247-248` mới phải cấm chèn số lên ảnh. Cấm kênh chính thức chỉ đẩy nó xuống chợ đen của caption. **Nếu Cuong không duyệt cột liên hệ**, `Xem shop` là phương án xuống cấp đúng — nhưng phải nói thẳng rằng 2a là **một cuốn catalogue để ngắm**.
2. **Cơ chế bản sửa.** GPT: revision bất biến đánh số (R17/R18) + UI diff. Critic: đúng nguyên lý, quá tay cho phase đang *cắt phạm vi*. **Chốt: `pending_changes JSONB` — một cột, không một bảng.** Nâng lên revision khi có shop thứ mười hoặc lần đầu bắt được vụ tráo hàng.
3. **HEIC.** GPT: nhận `.heic`, server transcode. Critic: repo **không có khâu xử lý ảnh server-side nào**; `optimizeImageUrl` chỉ là transform CDN, không giải mã HEIC. **Chốt: không xây transcoder.** `accept="image/jpeg,image/png,image/webp"` — iOS Safari **tự** chuyển HEIC→JPEG khi site không khai nhận HEIC. Cộng ~20 dòng canvas downscale client: xoá luôn bài toán 8MB, cắt thời gian upload 4G, bỏ được trạng thái `processing`.

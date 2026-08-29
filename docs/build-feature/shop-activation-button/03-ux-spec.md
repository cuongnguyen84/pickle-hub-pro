# Đặc tả UI/UX — Nút kích hoạt shop

**Phạm vi:** đúng scope đã chốt trong `02-final-analysis.md`. File đích: `/Users/cm10/pickle-hub-pro/src/pages/admin/shop/AdminShopApplicationReview.tsx`, `/Users/cm10/pickle-hub-pro/src/pages/shop/SellerHome.tsx`, `/Users/cm10/pickle-hub-pro/src/hooks/shop/useShopApplicationQueue.ts` (hoặc hook mới cạnh nó), `/Users/cm10/pickle-hub-pro/src/lib/shop/applicationState.ts`.

**Cảnh báo số dòng:** spec đọc trên working tree nhánh `feat/shop-production-phase-1`; coder phải branch từ `main` (ràng buộc thi công) — số dòng trong spec là mốc định vị, coder xác minh lại trên main trước khi sửa.

## 0. Kết quả `hallmark audit` trang review (punch list — không sửa trong audit, chỉ ghi nhận)

Trang này là admin form utilitarian trên nền "The Line" (`tl-shop-*`), không phải landing page — các gate cấu trúc page-level không áp. Findings liên quan trực tiếp đến khu vực ta sắp đụng:

- **MAJOR — "disabled thay vì đổi trạng thái":** sau khi `done` (dòng 100–107, 227–228), banner hiện ra nhưng toàn bộ form quyết định vẫn editable, chỉ nút submit bị disabled. Admin có thể gõ tiếp ghi chú không bao giờ được gửi. **Feature mới KHÔNG được lặp lại pattern này**: sau kích hoạt, cả section phải đổi sang trạng thái "đã kích hoạt" (nút biến mất), không phải nút disabled nằm trơ.
- **MINOR — copy `CONSEQUENCE.approve` lỗi thời sau feature này** (dòng 35–36): "Họ chưa đăng bán được cho tới khi hoàn tất bước tiếp theo" — sau khi ship, "bước tiếp theo" chính là section kích hoạt trên trang này. Sửa thành nêu đích danh (xem microcopy §4.5).
- **MINOR — trang không hiển thị trạng thái shop cho hồ sơ approved** — đúng lỗ hổng dữ liệu mà feature này lấp (hook queue chỉ select `shop_applications`).
- **MINOR — inline `style={{}}` rải rác** (dòng 110, 133, 147, 165…) — là pattern hiện có của trang; section mới theo cùng pattern, không tệ hơn, không cần dọn.
- Điểm tốt giữ nguyên: notice `role="status"`, error `role="alert"`, focus-visible toàn cục (`.tl-shop :is(...):focus-visible`, shop.css dòng 206), heading không italic, token AA đã retune (commit `aed296ab`).

**0 critical · 1 major · 3 minor.**

## 1. User flow

```
/admin/shop/applications ──mở hồ sơ──▶ /admin/shop/applications/:id
   │
   ├─ status ≠ approved HOẶC shop_id = null ──▶ trang như hiện tại, KHÔNG render section kích hoạt
   │
   └─ status = approved VÀ shop_id ≠ null ──▶ render section "Kích hoạt shop"
        │  (fetch thêm row shops: id/slug/name/state)
        ├─ đang tải state shop ──▶ dòng chờ nhỏ trong section
        ├─ tải state lỗi ──▶ lỗi inline + nút "Thử lại" (chỉ retry query, không đụng phần còn lại của trang)
        ├─ state = active ──▶ hiển thị "Đã kích hoạt" + link trang shop, KHÔNG có nút (idempotent khi F5/vào lại)
        ├─ state ∈ {restricted, suspended, closed} ──▶ notice trạng thái, KHÔNG có nút
        └─ state = pending_activation ──▶ form kích hoạt:
             1. Admin bấm link "Xem trước trang shop" (tab mới, /shop/store/:slug) — quyết định không mù
             2. Chọn phương thức xác minh (mặc định "Gặp trực tiếp", được phép để trống)
             3. Bấm "Kích hoạt shop" ──▶ confirm dialog (useConfirm)
                  ├─ Huỷ ──▶ về form, không đổi gì
                  └─ Kích hoạt ──▶ nút loading ──▶ RPC shop_activate
                        ├─ OK ──▶ invalidate query state shop ──▶ section re-render sang "Đã kích hoạt" + notice status
                        ├─ Lỗi admin_required ──▶ error inline (đăng nhập lại 2FA)
                        ├─ Lỗi state sai (đã restricted/… ở nơi khác) ──▶ error inline + gợi tải lại
                        └─ Lỗi mạng/khác ──▶ error inline trung thực "shop vẫn ở trạng thái cũ", nút bấm lại được
```

Trường hợp đua (2 tab admin): tab kia đã kích hoạt trước → RPC idempotent trả trạng thái hiện tại không lỗi → refetch → UI hiển thị "Đã kích hoạt". Không cần xử lý riêng.

## 2. Vị trí & anatomy trên trang review

Section mới đặt **giữa section "Người nộp" và "Ghi chú đã có"/"Quyết định"** — với hồ sơ approved thì kích hoạt là hành động chính, quyết định là quá khứ. Không sticky, không đưa vào form quyết định.

```
AdminShopFrame
 ├─ [banner done — như cũ]
 ├─ section "Người nộp" (như cũ)
 ├─ ★ section aria-labelledby="a03-activate"          ← MỚI, chỉ khi approved + shop_id
 │    ├─ h2.tl-shop-h2  "Kích hoạt shop"
 │    └─ div.tl-shop-card
 │         ├─ DefList:
 │         │    ["Trạng thái shop", <pill/label>]
 │         │    ["Trang shop", <a target=_blank>/shop/store/{slug} — Xem trước (mở tab mới)</a>]
 │         │    (nếu active: thêm ["Xác minh", label phương thức] khi verified_method có)
 │         ├─ (chỉ khi pending_activation) div.tl-shop-notice--warn: hệ quả công khai
 │         ├─ (chỉ khi pending_activation) label.tl-shop-field
 │         │    span.tl-shop-label "Phương thức xác minh (tuỳ chọn)"
 │         │    select.tl-shop-select  [Gặp trực tiếp | Giấy phép kinh doanh | Chưa xác minh]
 │         │    p.tl-shop-hint  ← copy trung thực, xem §4.2
 │         ├─ (khi có lỗi) p.tl-shop-error role="alert"
 │         └─ (chỉ khi pending_activation) button.tl-shop-btn.tl-shop-btn--primary.tl-shop-btn--block
 │              "Kích hoạt shop"
 ├─ section "Ghi chú đã có" (như cũ)
 └─ section "Quyết định" (như cũ)
```

Ghi chú ngoài scope nhưng nêu cho prompt-engineer quyết (1 dòng diff, không bắt buộc): với hồ sơ terminal (`isTerminal(row.status)`), form "Quyết định" hiện tại luôn fail server (`application_not_decidable`) — bọc `{canDecide(row.status) && ...}` sẽ tránh 2 form cạnh tranh. Nếu giữ scope cứng thì bỏ qua, server đã guard.

## 3. Trạng thái từng phần tử tương tác (kỷ luật 8 trạng thái)

**Nút "Kích hoạt shop"** (`tl-shop-btn--primary --block`):

| Trạng thái | Hành vi |
|---|---|
| default | Nền primary theo token có sẵn |
| hover | `.tl-shop-btn--primary:hover` có sẵn (`--tl-green-dim`) — không thêm CSS |
| focus-visible | Rule toàn cục `.tl-shop` (shop.css:206) — không thêm CSS |
| active | Mặc định browser + token có sẵn; không thêm hiệu ứng |
| disabled | Khi query state shop đang refetch sau mutation; `.tl-shop-btn:disabled` opacity 0.45 có sẵn |
| loading | `disabled` + `<Loader2 className="animate-spin">` + text đổi "Đang kích hoạt…" (giống nút "Gửi quyết định" dòng 229–231 — text đổi tự announce cho screen reader) |
| error | Nút TRỞ LẠI default (bấm lại được), lỗi hiển thị ở `p.tl-shop-error role="alert"` phía trên nút |
| success | Nút KHÔNG hiện nữa — section re-render sang trạng thái "Đã kích hoạt" (sửa đúng finding MAJOR ở audit) |

**Select phương thức xác minh** (`tl-shop-select`): default/hover/focus-visible dùng style có sẵn; disabled khi mutation pending; không có trạng thái error/invalid (trường tuỳ chọn, không validate); loading n/a; success n/a. Giá trị giữ nguyên sau lỗi RPC (không reset).

**Link xem trước trang shop**: thẻ `<a href="/shop/store/{slug}" target="_blank" rel="noopener noreferrer">`, kèm icon `ExternalLink` (lucide, size 13, `aria-hidden`) và chữ "(mở tab mới)" trong text — không dựa vào icon để truyền nghĩa. Focus-visible: rule toàn cục. Disabled/loading/error/success: n/a (link tĩnh). Lưu ý: trang `/shop/store/:slug` với shop `pending_activation` — admin đọc được qua policy admin; nếu trang public đó chặn shop chưa active với admin thì đây là bug chặn preview, coder phải xác minh khi test tay (nêu trong prompt như một điểm kiểm).

**Confirm dialog**: dùng `useConfirm()` (Radix AlertDialog) — focus trap, Esc = huỷ, focus trả về nút gọi: có sẵn, không làm gì thêm. `destructive: false` (đây là hành động "mở", không phá huỷ — không dùng nút đỏ).

**Section-level:** loading = một dòng `tl-shop-hint` "Đang tải trạng thái shop…" trong card (không skeleton — 1 row data); error tải = `tl-shop-error` + nút `tl-shop-btn tl-shop-btn--sm` "Thử lại".

## 4. Microcopy (VI là chính — khu admin và Seller Center hiện VI-only, không cần EN; xưng hô giữ đúng giọng hiện có: admin gọi "anh", seller gọi "anh/chị")

### 4.1 Notice hệ quả (trước nút, `tl-shop-notice--warn`, icon `AlertTriangle`)
> **Sau khi bấm:** shop hiện công khai trên /shop ngay lập tức — ai cũng xem được, kể cả người chưa đăng nhập, và seller đăng bán được. Chưa có bước hoàn tác trong giao diện này.

(Câu cuối trung thực với scope: suspend/re-activate đã chốt để sau, chỉ xử lý qua runbook.)

### 4.2 Select + hint
- Label: `Phương thức xác minh (tuỳ chọn)`
- Options: `Gặp trực tiếp` (value `gap-truc-tiep`, mặc định) · `Giấy phép kinh doanh` (`giay-phep-kinh-doanh`) · `Chưa xác minh` (value rỗng)
- Hint (trung thực, không nói quá): `Chỉ ghi lại cách anh đã xác minh người bán này — hệ thống không tự kiểm tra gì cả.`

### 4.3 Nút + dialog
- Nút: `Kích hoạt shop` / loading: `Đang kích hoạt…`
- Dialog title: `Kích hoạt shop "{tên shop}"?`
- Dialog description (useConfirm hỗ trợ xuống dòng qua `whiteSpace: pre-line`):
  > `Shop hiện công khai trên /shop ngay lập tức, ai cũng xem được.\nPhương thức xác minh sẽ ghi: {Gặp trực tiếp | Giấy phép kinh doanh | (không ghi)}.\nSau khi kích hoạt, anh tự báo seller qua Zalo.`
- confirmText: `Kích hoạt` · cancelText: mặc định (`Huỷ`)

### 4.4 Sau thành công / trạng thái active (KHÔNG dùng toast — trang này dùng notice inline, giữ nhất quán; `tl-shop-notice--info`, icon `Check`, `role="status"`)
> **Đã kích hoạt.** Shop đang công khai tại [Xem trang shop (mở tab mới)]. Nhớ báo seller qua Zalo — hệ thống không gửi thông báo tự động.

Vào lại trang khi đã active: cùng hiển thị này (không phân biệt "vừa bấm" và "đã bấm từ trước" — idempotent về mặt UI).

Trạng thái khác (`restricted/suspended/closed`, `tl-shop-notice--warn`):
> Shop đang ở trạng thái "{label}". Chỉ kích hoạt được shop đang chờ kích hoạt — trạng thái này xử lý theo runbook, không qua màn hình này.

### 4.5 Lỗi RPC (`activateErrorMessage`, cùng pattern `decisionErrorMessage`)
- chứa `admin_required` → `Phiên đăng nhập chưa đủ quyền. Đăng nhập lại bằng 2FA rồi thử lại.` (tái dùng nguyên văn)
- chứa mã lỗi state sai (coder khớp đúng chuỗi RAISE của RPC, ví dụ `shop_not_activatable`) → `Shop không còn ở trạng thái chờ kích hoạt — có thể đã đổi ở nơi khác. Tải lại trang để xem trạng thái mới.`
- mặc định → `Chưa kích hoạt được. Shop vẫn ở trạng thái cũ, chưa có gì công khai. Thử lại hoặc kiểm tra kết nối.`
- Sửa luôn `CONSEQUENCE.approve` (dòng 35–36): → `Shop được tạo ở trạng thái chờ kích hoạt và người nộp trở thành chủ shop. Sau khi duyệt, mục "Kích hoạt shop" xuất hiện ngay trên trang này để đưa shop lên công khai.`

### 4.6 Hai notice seller trong SellerHome (dòng 77–92)
- `pending_activation` (giữ `--warn` + `AlertTriangle`):
  > **Shop đã mở nhưng chưa hoạt động.** Quản trị viên sẽ kích hoạt sau khi xác minh với anh/chị — khi shop lên công khai, chúng tôi báo trực tiếp qua Zalo.

  (Bỏ hẳn câu "Chức năng đăng sản phẩm sẽ bật ở giai đoạn tiếp theo". KHÔNG thêm câu "anh/chị có thể đăng sản phẩm ngay" trừ khi coder xác nhận trên main rằng UI sản phẩm seller đã mở — trên nhánh spec đọc, nav Seller Center vẫn đánh dấu "Sản phẩm · sắp có" (`ShopShell.tsx` dòng 81). Copy không được hứa thứ UI chưa có — **cần xác nhận thực tế trên main trước khi thêm**.)
- `active` (giữ `--info` + `Check`):
  > **Shop đang hoạt động** — ai cũng xem được tại [trang shop của anh/chị → `/shop/store/{slug}`, mở tab mới]. Bước tiếp theo: đăng sản phẩm đầu tiên.

  (Câu "đăng sản phẩm đầu tiên" chỉ kèm link nếu route seller products đã ready trên main; nếu chưa thì để chữ trơn, trỏ vào mục trong cột trái.)
- Đồng thời cân nhắc cập nhật card "Bước tiếp theo" (dòng 109–116) nếu nội dung "giai đoạn 2 và 3" đã sai trên main — coder xác minh, không tự bịa.

## 5. Component & data

- **Tái dùng, không tạo component file mới:** `AdminShopFrame`, `DefList`, toàn bộ class `tl-shop-*` (card/notice/select/hint/error/btn), `useConfirm()`, icon lucide `Check`/`AlertTriangle`/`Loader2`/`ExternalLink`. Section kích hoạt viết inline trong `AdminShopApplicationReview.tsx` (trang đã là 1 file tự chứa — theo pattern).
- **Hook mới (đặt trong `useShopApplicationQueue.ts` — cùng file, đúng phía admin):**
  - `useShopState(shopId: string | null)` — query `shops` select `id, slug, name, state, verified_method`, enabled khi có shopId; queryKey riêng (vd `["shop","admin","shop-state",shopId]`).
  - `useActivateShop()` — mutation gọi RPC `shop_activate` với `{_shop_id, _verified_method: value || null}` (tên tham số khớp migration coder viết); `onSuccess` invalidate key shop-state.
  - `activateErrorMessage(err)` — map lỗi như §4.5, cạnh `decisionErrorMessage`.
- **`SHOP_STATE_LABEL`:** map nhãn state hiện đang định nghĩa cục bộ trong `SellerHome.tsx` (dòng 18–24) — nâng lên `src/lib/shop/applicationState.ts` export, SellerHome và trang review cùng import. Không duplicate.
- **Không thêm thư viện, không thêm CSS mới** — mọi style đã tồn tại trong `shop.css`.

## 6. Responsive & accessibility

- Section nằm trong `tl-admin-body`; `DefList` tự stack dưới 560px; nút `--block` full-width; select full-width theo `tl-shop-select` có sẵn — **không cần breakpoint mới**. Coder kiểm bằng mắt ở 320/375/414/768px: không tràn ngang, label select không đè, text link preview được wrap (URL slug tiếng Việt có thể dài — nếu tràn ở 320px, cho phép `overflow-wrap: anywhere` trên dd chứa link).
- Landmark: `aria-labelledby="a03-activate"` theo đúng quy ước `a03-*` của trang.
- `role="status"` cho notice thành công, `role="alert"` cho lỗi (class + role như các chỗ hiện có).
- Focus: dialog do Radix quản; sau khi dialog đóng vì thành công, focus trả về vị trí nút cũ — nút biến mất thì Radix trả focus về body; chấp nhận được vì notice `role="status"` announce; không cần focus management thêm.
- Touch target: `tl-shop-btn` và `tl-shop-select` đã đạt min-height theo `--shop-tap`; không thu nhỏ nút chính bằng `--sm`.
- Contrast: chỉ dùng token có sẵn (đã AA sau `aed296ab`) — cấm inline màu mới.
- Link tab mới: có chữ "(mở tab mới)" trong văn bản, icon `aria-hidden`.

## 7. Điểm cần xác nhận (không đoán — chuyển vào prompt cho coder như bước verify)

1. Trên **main**: seller đã đăng/publish sản phẩm được qua UI chưa (nav "Sản phẩm" ready?) → quyết định 2 câu copy có điều kiện ở §4.6.
2. Trang public `/shop/store/:slug` có render được shop `pending_activation` cho admin không (để link preview không mù) — nếu không, ghi rõ trong PR là preview chỉ đúng sau active, sửa copy link thành "Trang shop (sẽ mở khi kích hoạt)".
3. Chuỗi lỗi chính xác RPC `shop_activate` RAISE (coder viết migration trước rồi khớp `activateErrorMessage` theo đúng chuỗi, có pgTAP che).

---

**File liên quan:** `/Users/cm10/pickle-hub-pro/src/pages/admin/shop/AdminShopApplicationReview.tsx` · `/Users/cm10/pickle-hub-pro/src/pages/shop/SellerHome.tsx` · `/Users/cm10/pickle-hub-pro/src/hooks/shop/useShopApplicationQueue.ts` · `/Users/cm10/pickle-hub-pro/src/lib/shop/applicationState.ts` · `/Users/cm10/pickle-hub-pro/src/components/shop/ShopShell.tsx` (chỉ đọc, không sửa) · `/Users/cm10/pickle-hub-pro/src/styles/shop.css` (chỉ dùng lại class, không thêm) · `/Users/cm10/pickle-hub-pro/src/hooks/useConfirm.tsx` (tái dùng nguyên trạng).

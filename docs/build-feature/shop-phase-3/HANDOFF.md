# BÀN GIAO — Shop Phase 3

> Chốt 18/08/2026. Đọc file này trước, mọi thứ khác là chi tiết.
> Worktree `.claude/worktrees/shop-phase-3` · nhánh `feat/shop-phase-3` · **PR #610**
> Preview: https://feat-shop-phase-3.pickle-hub-pro.pages.dev/shop

---

## 1. Trạng thái

| | |
|---|---|
| PR | **#610**, 9 commit, **chưa merge** |
| CI | 7/7 xanh (lần chạy cuối còn quality/smoke/visual đang chạy lại cho commit cuối) |
| Migration | **4 file ĐÃ áp production** |
| Ledger migration | ❌ **CHƯA — việc bắt buộc, xem §2** |
| Shop `thepicklehub` | **ĐANG NHẬN ĐƠN THẬT** (`ordering_enabled = true`, ship 30.000₫) |
| Coverage | 84.15% (ngưỡng 83%) |
| Bundle | INITIAL 227.7/280 KB · CODE 1605.5/1800 KB |
| PO nghiệm thu iPhone | ✅ đã xác nhận OK |

**4 migration đã áp prod, thứ tự không đảo:**
`20260818090000_shop_cart_items` → `20260818100000_shop_orders` → `20260818110000_append_only_actor_null` → `20260818120000_shop_phase3_projection_and_address`

---

## 2. 🔴 Việc BẮT BUỘC còn lại

### 2.1 Ledger 4 migration
Không chạy thì `check-migration-drift.mjs` (`DRIFT_STRICT=1`) **đỏ mọi commit trên main**.

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
 ('20260818090000','shop_cart_items'),
 ('20260818100000','shop_orders'),
 ('20260818110000','append_only_actor_null'),
 ('20260818120000','shop_phase3_projection_and_address')
ON CONFLICT (version) DO NOTHING;
```
*(Agent bị classifier chặn ghi vào bảng migration nên không tự chạy được.)*

### 2.2 Quyết định về `ordering_enabled`
Shop đang nhận đơn thật. Nếu chưa muốn mở cho người ngoài:
```sql
ALTER TABLE public.shops DISABLE TRIGGER shops_guard_privileged_columns_trg;
UPDATE public.shops SET ordering_enabled = false WHERE slug = 'thepicklehub';
ALTER TABLE public.shops ENABLE TRIGGER shops_guard_privileged_columns_trg;
```
⚠️ Không bọc `DISABLE/ENABLE TRIGGER` thì câu UPDATE bị **nuốt im lặng** — công tắc chạy đúng thiết kế.

### 2.3 Merge PR #610

---

## 3. Đã làm gì

**Người mua:** thêm vào giỏ (badge + toast) → giỏ nhóm theo shop, sửa số lượng, bỏ có hoàn tác → đặt hàng COD hoặc chuyển khoản, một shop một đơn → `/shop/orders` 4 tab → huỷ khi shop chưa xác nhận, bấm "Tôi đã nhận hàng", liên hệ shop ở **mọi** trạng thái.

**Người bán:** `/seller/orders` sắp theo hạn trả lời, **đơn quá hạn lên đầu** → xác nhận / từ chối kèm lý do (người mua đọc nguyên văn) / ghi nhận đã gửi + mã vận đơn / ghi nhận đã giao → gọi người mua một chạm, sao chép địa chỉ giao. Vai `support` chỉ xem.

**Nền:** đặt đơn là một transaction có `FOR UPDATE`, idempotent theo `client_token`, trừ kho qua sổ; huỷ hoàn kho bằng dòng sổ mới. Mọi chuyển trạng thái là guarded UPDATE có audit. Tiền là generated column trong Postgres. Mọi trang có PII đều noindex.

**Kiểm chứng:** pgTAP 1 625 assertion / 47 file · race harness 225 assertion (6 kịch bản, advisory-lock barrier) · vitest 202 file / 3 125 test · 4 phép thử đỏ-trước-xanh chạy thật.

---

## 4. CHƯA LÀM — cắt có chủ ý, không phải thu hẹp

**Wishlist · Đánh giá sản phẩm · Trả hàng · Khiếu nại/dispute.**

Khối lượng đo được vượt xa phạm vi (12 màn prototype = 2 422 dòng, hệ số port ≈ 1,9×), và với đúng một shop mà chủ shop cũng là admin thì khiếu nại hiện là một cuộc gọi Zalo.

Điều kiện an toàn để cắt **đã làm đủ**: nút liên hệ shop có mặt ở mọi trạng thái đơn cả hai phía, và admin chuyển được trạng thái bất kỳ kèm lý do + audit.

---

## 5. Nợ kỹ thuật mang sang

| # | Việc | Vì sao chưa làm |
|---|---|---|
| 1 | **Telegram ping khi có đơn mới** | Repo chưa có edge function gửi Telegram dùng chung (`errors-telegram-alert` tự đọc bảng lỗi của nó). Làm đúng cần một slice riêng. Vì chưa có kênh đẩy nên UI **không hứa** "shop trả lời trong 48 giờ" với người mua |
| 2 | **`68px` chiều cao buybar là số đo cứng**, không phải token | Không có `--shop-buybar-h` sẵn; chữ dài hơn làm thanh cao lên thì lệch vài px |
| 3 | **`ask-model.mjs` không tồn tại** | Agent `ui-ux-critic` không lấy được ý kiến GPT-5.6 ⇒ audit UI là **một chiều**, chưa có đối chứng |
| 4 | **Biên coverage mỏng** | 84.15% / ngưỡng 83%. Nợ nhiều nhất **không phải Shop**: `RegistrationModal.tsx` (102 statement chưa phủ), `i18n/index.tsx` (88), `SellerProductForm.tsx` (76) |
| 5 | **32 inline style còn lại** trong 6 file màn mua | Đều là giá trị dùng một lần (chiều rộng từng dòng khung xương, tiêu điểm ảnh bìa theo dữ liệu). Đặt class cho chúng là đẻ class dùng-một-lần |
| 6 | **User rác prod** `0bbe10dc-b091-41f5-a448-473e3c997d99` | Nợ từ phiên trước |
| 7 | **Rendition JPEG cũ còn EXIF** ⇒ publish fail vĩnh viễn | Không có backfill; cách chữa là bảo seller up lại ảnh |
| 8 | **`owner_user_id` lộ qua REST anon** | **Bắt buộc sửa trước khi bật indexing** `/shop` |
| 9 | **User rác trên Supabase LOCAL** `uicheck+r6@thepicklehub.net` | Chỉ local, không đụng prod |

---

## 6. Chưa ai kiểm được bằng máy

1. **Cart / Checkout / Orders / OrderDetail với dữ liệu thật ở 390px** — cần đăng nhập prod, agent không có credential. Mới đo được ở trạng thái đang tải và rỗng.
2. **Trạng thái shop tạm ngưng trên trình duyệt** — prod chỉ có 1 shop và nó đang `active`. Chỉ có test jsdom đứng sau.
3. **`ordering_enabled = false` trên PDP/giỏ/checkout** — cùng lý do.

---

## 7. Bài học — đọc trước khi làm UI lần sau

### 7.1 Cách đo layout thật (thứ lẽ ra phải dùng từ đầu)
`resize_window` của Chrome MCP **không hoạt động trên máy này**. Đừng báo "BỊ CHẶN" rồi đi tiếp — **Playwright nằm sẵn trong `node_modules`**:

```js
import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 640 } });
await p.goto(url, { waitUntil: "networkidle" });
// Liệt kê mọi phần tử tràn ngang:
await p.evaluate(() => {
  const W = innerWidth, over = [];
  document.querySelectorAll("main.tl-shop, main.tl-shop *").forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > W + 1) over.push({ cls: el.className, right: Math.round(r.right) });
  });
  return over;
});
```
Script phải nằm **trong worktree** (`scripts/tmp-*.mjs`) mới import được `playwright`; xoá sau khi đo.

⚠️ **Thu nhỏ `.tl-root` bằng JS KHÔNG trung thực** — `max-width: 100vw` và mọi đơn vị `vw` vẫn tính theo cửa sổ thật. Phải dùng viewport thật.

### 7.2 Hai bug layout cùng một gốc, cùng bị che
Cả hai **có sẵn từ trước**, cùng bị `.tl-shop { overflow: hidden }` che. Sửa cái thứ nhất làm lộ cái thứ hai — **không phải hồi quy, mà là lớp sơn bong ra**.

- **Bug 1 — cắt dọc.** `.tl-shop` là `height: 100%; overflow: hidden`, tự nhận quyền cuộn và trông chờ `.tl-shop-scroll` bên trong. Đúng cho màn người bán (`ShopScrollShell`), **sai cho màn người mua** vì chúng đi qua `TheLineLayout` vốn đã có `.tl-scroll`. Đo ở 390×640: `main.tl-shop` clientHeight 640 / scrollHeight 1121 — **481px không có đường tới**.
- **Bug 2 — tràn ngang.** `.tl-shop` là flex column, `.tl-shop-page` có `margin: 0 auto`. **Auto margin theo trục ngang của flex item HUỶ `stretch`** ⇒ co theo `fit-content` = 813px trên màn 390px.

Cả hai sửa trong một rule ở `src/styles/shop.css`:
```css
.tl-scroll main.tl-shop, .tl-scroll .tl-shop {
  height: auto; min-height: 100%; flex: 0 0 auto; overflow: visible; display: block;
}
```
**Trên desktop không ai thấy** vì nội dung (626px) thấp hơn viewport (713px) và `fit-content` ≤ container. Đó là lý do bug sống sót qua một đợt audit UI đọc code và một vòng test trình duyệt chạy ở 500 và 1335px.

### 7.3 Ba loại xanh giả đã bắt được trong đợt này
1. **Fixture chọn sai làm assertion đúng thành vô nghĩa** — test "xoá tài khoản không xoá đơn" xanh vì dùng variant `stock_on_hand IS NULL` ⇒ không sinh ledger ⇒ không chạm FK cần kiểm.
2. **Slice regex mở quá rộng** — test "hàm phải có `set_config`" cắt từ đầu hàm **đến hết file**, nên `set_config` của một hàm khác gánh hộ; xoá `set_config` khỏi hàm thật vẫn xanh.
3. **`npm run test` xanh không chứng minh được default của `App.tsx`** — mọi test tự dựng `QueryClient` riêng nên không bao giờ chạm default toàn cục.

### 7.4 Bẫy môi trường
- **`vi.importActual` trên module kéo theo supabase client** ⇒ CI không có `.env` nên **cả suite chết ở khâu mocking**, trước cả test đầu tiên. Máy dev có `.env` nên xanh. Kiểm bằng cách tạm gỡ `.env` + `.env.local` rồi chạy lại.
- **`PostgrestError` không có trường `status`** — chỉ `{message, details, hint, code}`. Mọi predicate lọc theo `error.status` là no-op với lỗi PostgREST.
- **React Query pause retry khi tab ẩn**: retryer gọi `focusManager.isFocused()`; tab không visible ⇒ **pause thay vì reject** ⇒ `mutateAsync` **không bao giờ settle**. Triệu chứng: nút kẹt "Đang gửi…", 0 console error, server đã trả 409. Mutation của Shop nay `retry: false`.
- **Seed `ordering_enabled` / `stock_on_hand` qua psql bị trigger nuốt im lặng** (`UPDATE 1` nhưng không đổi). Phải bọc `ALTER TABLE … DISABLE/ENABLE TRIGGER`.

### 7.5 Rò danh tính — cùng bất biến, ba tên cột
`buyer_user_id` → `actor_user_id` → `cancelled_by`. Vì `profiles` cho **mọi** user đăng nhập đọc toàn bộ, một uid là đủ tra ra hồ sơ đầy đủ của khách. Nay được canh ở **cả hai** chỗ: GRANT theo cột **và** danh sách cột của view `my_shop_orders`.

⚠️ **View không `security_invoker` bỏ qua CẢ RLS CẢ GRANT-theo-cột** — danh sách SELECT của view là hàng rào duy nhất, phải có test canh. (Lý do phải TẮT invoker: `authenticated` không có SELECT trên `buyer_user_id` ⇒ view 42501 cho mọi người.)

### 7.6 Bug production tìm ra ngoài phạm vi
`delete-account` **vỡ vĩnh viễn** với bất kỳ ai từng để lại dấu vết ở 4 bảng có `actor_user_id` FK `ON DELETE SET NULL` + trigger append-only raise vô điều kiện: `inventory_movements`, `product_moderation_events`, `product_submission_events`, `shop_contact_moderation_events`. Migration `20260818110000` vá cả bốn, cho qua **đúng một** trường hợp: FK null hoá actor, không phải người sửa sổ.

---

## 8. Quyết định sản phẩm đã chốt (PO lật ngược được bằng một dòng)

| # | Quyết định |
|---|---|
| D1 | `shops.ordering_enabled` mặc định **FALSE** — vừa là cổng nghiệm thu, vừa là nút tắt khẩn cấp (không dùng `restricted` vì làm shop biến mất khỏi catalog) |
| D2 | COD mặc định + `bank_transfer` qua kênh liên hệ shop. **Không cột ngân hàng, không QR, không đối soát tự động, không trạng thái `awaiting_payment`** |
| D3 | `shops.shipping_fee_vnd` phẳng, hiển thị **"Miễn phí"** khi 0 — không bao giờ "0₫" hay "—" |
| D4 | Địa chỉ **một ô free-text** ép đủ cấp — không dropdown tỉnh/thành (repo không có danh sách sau sáp nhập 2025) |
| D5 | Người mua huỷ tự do khi `pending`; sau đó liên hệ shop |
| D6 | **Không** đếm ngược phía người mua; hạn 48h chỉ ở phía người bán, **không** job tự huỷ |
| D7 | Người mua bấm được "Tôi đã nhận hàng" |
| D8 | Trần 5 đơn `pending`/người mua, `qty` 1..10 |
| D9 | Chủ shop tự mua **không bị chặn** (để nghiệm thu được) |
| D10 | Rollback = revert commit frontend, schema ở lại |

**Ba phát sinh ngoài kế hoạch:** view `my_shop_orders` (không có nó thì chủ shop mở "Đơn của tôi" sẽ thấy tên/SĐT/địa chỉ **khách hàng của mình**) · cap 200 đơn/màn · ảnh trên thẻ `/shop/orders` là **logo shop**, không phải ảnh sản phẩm (dòng đơn snapshot tên/giá chứ không snapshot ảnh).

---

## 9. Máy trạng thái đơn (5 trạng thái, không có `completed`)

```
pending   --confirm(seller|admin)--------> confirmed
confirmed --ship(seller|admin)-----------> shipped
shipped   --deliver(buyer|seller|admin)--> delivered
pending   --cancel(buyer|seller|admin)---> cancelled
confirmed --cancel(seller|admin)---------> cancelled
shipped   --cancel(admin)----------------> cancelled
```
`seller` = `owner|manager|fulfillment`. **`support` không transition được gì.** Actor huỷ ≠ buyer ⇒ `_reason` bắt buộc.

**Mã lỗi** — `reason` nằm trong `error.details` (chuỗi JSON):
`PT409` `price_changed|shipping_fee_changed|insufficient_stock|variant_unavailable|product_unavailable|stale_status` · `PT403` `ordering_disabled|shop_inactive` · `PT429` `too_many_pending` · `42501` `forbidden` · `22023` `invalid_payload`

---

## 10. Đường dẫn

- Kịch bản nghiệm thu iPhone 18 case: `docs/build-feature/shop-phase-3/TEST-IPHONE.md`
- Bản tick được trên điện thoại: https://claude.ai/code/artifact/990c96d6-125a-4aa6-ac40-1c7276dc74ed
- Audit trail 4 vòng + audit UI: `docs/build-feature/shop-phase-3/` (`00-idea` · `01-task-analysis` · `02-critic-*` · `02-final-analysis` · `03-ux-spec` 945 dòng · `rounds/`)
- Bản đồ phase gốc: `docs/proposals/shop-marketplace/production-implementation-map.md`

# TỔNG KẾT — Shop Phase 3 (đêm 17→18/08/2026)

> Chạy qua đêm theo `/build-feature`. Toàn bộ raw output từng bước ở `docs/build-feature/shop-phase-3/`.
> **Code nằm ở worktree `.claude/worktrees/shop-phase-3`, nhánh `worktree-shop-phase-3`, CHƯA commit, CHƯA push, CHƯA áp prod.**

---

## 1. Yêu cầu và bản phân tích đã chốt

PO yêu cầu "chia task và hoàn thành phase 3" trong một đêm. Phase 3 theo bản đồ đã ký = **P3a** (wishlist, giỏ, checkout một-shop, tạo đơn idempotent, giữ tồn kho) + **P3b** (đơn/huỷ/trả/khiếu nại/đánh giá), với thanh toán vẫn Option B′ (không KYC, không ngân hàng, đối soát tay) và P4 vẫn khoá.

Bản phân tích đầu tiên chia thành 13 lát cắt. Hai agent phản biện chạy song song **không mâu thuẫn nhau**, và critic-feasibility đo bằng số: 12 màn prototype = 2 422 dòng, hệ số port sang production ≈ 1,9×, pgTAP P2b = 1 414 dòng cho một bề mặt nhỏ hơn ⇒ **13 lát cắt là bất khả thi về số học, không phải "rủi ro cao"**. Phạm vi chốt lại còn **6 lát cắt**.

## 2. Phản biện đã xử lý ra sao

| Điểm | Xử lý |
|---|---|
| 5 khẳng định kỹ thuật sai trong bản phân tích đầu | Sửa hết trước khi viết dòng code nào. Nặng nhất: kế hoạch định gọi lại `product_variant_adjust_stock` — hàm đó đòi `is_shop_manager()`, **người mua sẽ nổ `insufficient_privilege`**, tức là mọi đơn hàng đều hỏng |
| "Bundle chỉ còn 9 KB headroom" | **Sai** — đó là backstop đã bị bỏ chặn. Gate thật còn ~226 KB. Phase 3 hoàn toàn khả thi |
| COD-only có giết tính năng không | Giữ COD làm mặc định, **thêm nhánh chuyển khoản không tốn schema** (shop tự gửi thông tin qua nút liên hệ có sẵn). Không QR, không cột ngân hàng |
| Bẫy CI sẽ làm đỏ build lúc 3h sáng | Chuỗi `"Shop bị tạm ngưng"` là marker chống lọt prototype ⇒ đổi thành `"Shop đang tạm ngưng bán"`. Ghi vào mọi prompt |
| Nền tảng hứa điều không giữ được | Bỏ hết: "Đã hoàn tiền", "quá hạn thì quản trị viên xử lý", "tự chuyển thành khiếu nại", "SĐT chỉ hiện 30 ngày", "email xác nhận" — **không có job nào làm những việc đó** |
| Rủi ro người thật đặt đơn lúc 5h sáng khi chưa ai nghiệm thu | Công tắc `shops.ordering_enabled` **mặc định TẮT**, PO tự bật bằng một dòng SQL |
| Đặt-rồi-bỏ để đánh sập tồn kho | Trần 5 đơn `pending`/người mua + `qty` 1..10. 4 dòng SQL thay cho cả hệ thống giữ chỗ có TTL |

## 3. Thiết kế UI/UX

Spec 945 dòng dựng từ 7 màn prototype đã duyệt (B08, B09, B10, B11, B12, S08, S09), giữ nguyên nguyên tắc quan trọng nhất của bản gốc: **trạng thái đơn viết thành câu việc-cần-làm** ("Người bán đang chuẩn bị hàng — chưa cần làm gì") chứ không phải chip trạng thái trơ. Hai rút gọn đáng kể: B10 (đặt hàng thành công) **gộp** vào `/shop/order/:code` bằng `location.state.justPlaced` — bớt một route, một chunk, một bản sao logic; và badge giỏ đặt ở hàng breadcrumb của từng trang Shop chứ không nhét vào nav chung (nếu không, badge giỏ hàng sẽ xuất hiện trên `/live`, `/feed`, `/blog`).

## 4. Kết quả — 4 vòng

| Vòng | Làm gì | Review độc lập | Test trình duyệt |
|---|---|---|---|
| 1 | Tầng dữ liệu: 4 bảng, 3 RPC, máy trạng thái | **Chưa đạt** — 2 lỗi chặn | Không có UI để test |
| 2 | Song song: sửa SQL + dựng giỏ/checkout/chi tiết đơn | Coder A đạt | **9/12 pass, 1 FAIL** |
| 3 | Sửa bug + `/shop/orders` + `/seller/orders` + đóng gói | **Chưa đạt** — 1 lỗi chặn | **11/12 pass, 0 FAIL** |
| 4 | 3 việc sửa lỗi cuối | **Chưa đạt** → sửa 2 dòng → **ĐẠT** | — |

Review vòng 4 bắt được một điều đáng giá: fix `retry` của vòng 4 là **no-op** — predicate đọc `error.status`, mà `PostgrestError` chỉ có `{message, details, hint, code}`, **không có `status`**. Và `npm run test` xanh **không chứng minh được gì**, vì mọi test đều tự dựng `QueryClient` riêng nên không bao giờ chạm default của `App.tsx`. Đã đổi thành `mutations: { retry: false }` (không lọc 4xx được thì đừng hứa là lọc được), và chặn đường "probe PASS mà bỏ qua ca đắt nhất".

**Gate cuối cùng, tất cả xanh:**
- pgTAP **1 625 assertion / 47 file** (trước Phase 3: 1 457)
- race harness **225/225** (6 kịch bản đua thật, dùng advisory-lock barrier chứ không `Promise.all`)
- vitest **200 file / 3 053 test**, lint **0 error**
- build xanh · bundle INITIAL 227.7/280 KB · CODE 1602.8/1800 KB

**Ba lỗi nghiêm trọng do review/test bắt được, không phải do agent tự khai:**

1. **Vòng 1 suýt gài một quả bom vào production.** RPC ghi uid người mua vào `inventory_movements`, mà bảng đó có FK `ON DELETE SET NULL` + trigger append-only chặn UPDATE vô điều kiện ⇒ **`delete-account` sẽ vỡ vĩnh viễn với mọi người mua**. Coder tự chấm 29/29 đạt; bài test canh đúng việc đó lại **xanh giả** vì dùng một variant không đếm tồn nên không sinh dòng ledger nào để mà vướng. Điều tra ra: lỗi này **đã có sẵn trên production ở 4 bảng** — hôm nay chỉ vài seller dính, sau Phase 3 sẽ lan ra mọi người mua. Đã vá bằng migration `20260818110000`.
2. **Bug chặn trên trình duyệt thật.** Khi giá đổi giữa lúc điền form, nút "Đặt đơn" kẹt vĩnh viễn ở "Đang gửi đơn…" — người mua vào ngõ cụt, phải tự F5. Lint xanh, unit test xanh, build xanh, pgTAP xanh, bảng mã lỗi map đủ 11 `reason` — chỉ trình duyệt thật mới thấy. Root cause **không** phải catch block mà là `mutations: { retry: 1 }` toàn cục: React Query pause retry khi tab không visible ⇒ `mutateAsync` không bao giờ settle. Đã vá tận gốc (25 mutation Shop khác cũng đang dính cùng bẫy).
3. **Rò danh tính lần thứ ba.** Cùng một bất biến ("uid người dùng không bao giờ ra REST") rò qua ba tên cột khác nhau ở ba vòng: `buyer_user_id` → `actor_user_id` → `cancelled_by`. Vì `profiles` cho mọi user đăng nhập đọc toàn bộ, người bán chỉ cần một uid là tra ra hồ sơ đầy đủ của khách. Vòng 4 đã đóng và **thêm test canh cả ba**.

## 5. Đã làm — người dùng thao tác được gì

**Người mua:** xem sản phẩm → thêm vào giỏ (badge + toast có nút "Xem giỏ") → giỏ nhóm theo shop, sửa số lượng, bỏ có hoàn tác → đặt hàng COD hoặc chuyển khoản, một shop một đơn → xem `/shop/orders` chia 4 tab → chi tiết đơn, huỷ khi shop chưa xác nhận, bấm "Tôi đã nhận hàng", liên hệ shop ở **mọi** trạng thái.

**Người bán:** `/seller/orders` sắp theo hạn phải trả lời, **đơn quá hạn lên đầu** → xác nhận / từ chối kèm lý do (người mua đọc nguyên văn) / ghi nhận đã gửi + mã vận đơn / ghi nhận đã giao → gọi người mua bằng một chạm, sao chép địa chỉ giao để dán vào form vận chuyển. Vai `support` chỉ xem, không có nút hành động nào.

**Nền:** đặt đơn là một transaction nguyên tử có khoá `FOR UPDATE`, idempotent theo `client_token`, trừ kho qua sổ, huỷ thì hoàn kho bằng dòng sổ mới; mọi chuyển trạng thái là guarded UPDATE có audit; tiền là generated column trong DB, không nhận tổng từ client; mọi trang có PII đều noindex.

## 6. Đã CẮT — báo cáo trung thực là "chưa làm", không phải "đã thu hẹp"

**Wishlist · Đánh giá sản phẩm · Trả hàng · Khiếu nại/dispute.**
Lý do: khối lượng đo được vượt xa một đêm, và với đúng một shop mà chủ shop **chính là** admin thì khiếu nại hiện tại là một cuộc gọi Zalo. Điều kiện an toàn đã làm đủ: nút liên hệ shop hiện ở **mọi** trạng thái đơn cả hai phía, và admin có quyền chuyển trạng thái bất kỳ kèm lý do + audit.

## 7. Việc của Cuong — theo thứ tự

### a) Xem giao diện thật (chưa ai thấy ở đúng chiều rộng iPhone)
`resize_window` của công cụ test **vô hiệu suốt cả hai vòng** — mọi case chạy ở 500px và 1335px. Cần mắt người ở **320 / 375 / 1440px** cho `/shop/cart`, `/shop/checkout/:slug`, `/shop/order/:code`, `/shop/orders`, `/seller/orders`, `/seller/orders/:code`.
Hai điểm cụ thể: thẻ đơn **quá hạn** ở `/seller/orders` đang canh giữa trong khi thẻ khác canh trái (lệch nhịp thị giác); và độ dài câu việc-cần-làm ở `/shop/orders` trên iPhone.

### b) Review code trước khi merge
54 file chưa commit. Migration đụng thứ đang chạy trên production:
`20260818110000` **`CREATE OR REPLACE` 4 hàm trigger đang phục vụ Phase 1/2a** (kho + duyệt sản phẩm). Thân sai ở đây làm hỏng ngay luồng người bán đang dùng.

### c) TRƯỚC khi áp migration lên prod — 3 câu SQL bắt buộc
```sql
SELECT DISTINCT event_category FROM public.audit_logs;
SELECT DISTINCT resource_type  FROM public.audit_logs;
SELECT DISTINCT reason         FROM public.inventory_movements;
```
`20260818100000` **DROP rồi ADD lại 3 CHECK** trên bảng production đang chạy. Repo đang drift kinh niên (10 migration áp qua Management API không vào git). Một giá trị prod nằm ngoài danh sách ⇒ `ADD CONSTRAINT` nổ giữa chừng, và lúc đó CHECK cũ **đã bị DROP rồi**.
Thêm: dump `pg_get_functiondef` của `product_public_projection` và 4 hàm trigger **trước** khi áp — không có bản cũ nào lưu trong migration để dán lại.

### d) Thứ tự áp migration — không đảo
`20260818090000` → `20260818100000` → `20260818110000` → `20260818120000`
(file cuối đọc hai cột do file thứ hai tạo). Cả 4 kết bằng `NOTIFY pgrst, 'reload schema'` ⇒ **không áp trong giờ livestream** (sự cố PGRST002 ngày 02/08).

### e) Sau khi áp
1. `npx supabase gen types typescript --project-id ajvlcamxemgbxduhiqrl --schema public > src/integrations/supabase/types.ts`
2. Ledger cả 4 migration (`DRIFT_STRICT=1` fail cả hai chiều)
3. **Bật bán cho shop nội bộ** (mặc định TẮT):
   `UPDATE shops SET ordering_enabled = true, shipping_fee_vnd = <phí thật> WHERE slug = '<slug-shop>';`
   ⚠️ Trigger `shops_guard_privileged_columns_trg` sẽ **nuốt im lặng** câu này nếu chạy dưới danh tính không phải admin (`UPDATE 1` nhưng giá trị không đổi) — đó là công tắc hoạt động đúng thiết kế.
4. Tự đặt một đơn thử end-to-end (chủ shop tự mua **không bị chặn**, có chủ đích để nghiệm thu được).

### f) Nợ mang sang, chưa đụng
- Xoá auth user rác prod `0bbe10dc-b091-41f5-a448-473e3c997d99`
- Rendition JPEG cũ còn EXIF ⇒ publish fail vĩnh viễn (cách chữa: seller up lại ảnh)
- `owner_user_id` lộ qua REST anon — bắt buộc sửa trước khi bật indexing
- Telegram ping khi có đơn mới — **hoãn có lý do**: repo không có edge function gửi Telegram dùng chung, làm đúng cần một slice riêng. Vì chưa có kênh đẩy, UI **không hứa** "shop trả lời trong 48 giờ" ở phía người mua

## 8. Giả định đã tự quyết (PO lật ngược được bằng một dòng, không cần migration)

| # | Giả định |
|---|---|
| D1 | `ordering_enabled` mặc định **TẮT** |
| D2 | COD mặc định + chuyển khoản qua kênh liên hệ shop; không QR, không cột ngân hàng |
| D3 | `shipping_fee_vnd` phẳng trên `shops`, hiển thị "Miễn phí" khi 0 (không bao giờ "0₫" hay "—") |
| D4 | Địa chỉ **một ô free-text** ép đủ cấp — không dropdown tỉnh/thành (repo không có danh sách sau sáp nhập 2025, ship nhầm danh sách cũ là thứ người dùng nhận ra ngay) |
| D5 | Người mua huỷ tự do khi `pending`; sau đó liên hệ shop |
| D6 | Bỏ đếm ngược phía người mua; hạn 48h chỉ ở phía người bán, **không** job tự huỷ |
| D7 | Người mua bấm được "Tôi đã nhận hàng" |
| D8 | Trần 5 đơn `pending`/người mua, `qty` 1..10 |
| D9 | Chủ shop tự mua **không bị chặn** |
| D10 | Migration áp prod sau khi pgTAP xanh; rollback = revert commit frontend, schema ở lại |

Ba phát sinh ngoài kế hoạch, cần PO biết: **view `my_shop_orders`** (không có nó thì chủ shop mở "Đơn của tôi" sẽ thấy tên/SĐT/địa chỉ **khách hàng của mình**); **cap 200 đơn/màn**; **ảnh trên thẻ `/shop/orders` là monogram shop, không phải ảnh sản phẩm** (dòng đơn snapshot tên/giá chứ không snapshot ảnh — muốn ảnh thật cần một quyết định về read model).

## 9. Audit trail

`docs/build-feature/shop-phase-3/` — `00-idea` · `01-task-analysis` · `02-critic-feasibility` · `02-critic-user` · `02-final-analysis` · `03-ux-spec` (945 dòng) · `rounds/` (prompt, báo cáo coder, code review, test report, verdict cho từng vòng 1–4).

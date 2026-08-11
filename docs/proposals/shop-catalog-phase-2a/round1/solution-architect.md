# Solution architect — shop-catalog-phase-2a

> Nguyên văn output agent `solution-architect`, 2026-08-11.

## Tóm tắt kiến trúc

Phase 2a thêm cụm bảng catalog (`product_categories` seed cứng, `products`, `product_variants`, `product_media`) nối đúng pattern Phase 1: deny-by-default + policy **và** GRANT, guard trigger ghim cột đặc quyền, chuyển trạng thái chỉ qua `SECURITY DEFINER` RPC, `is_shop_member()` làm vị từ.

Mô hình dữ liệu chốt ở một điểm quan trọng: **giá và tồn kho luôn nằm trên variant**, sản phẩm không có tuỳ chọn vẫn sinh đúng 1 dòng variant — Phase 3 chỉ cần tham chiếu `variant_id`, không bao giờ phải rẽ nhánh product-hay-variant.

Câu hỏi lớn nhất không phải RLS mà là **2a nên dừng ở đâu**: recon nói map tách kiểm duyệt sang P2b, brief gộp vào 2a — và vì P2a không có mặt tiền người mua, hàng đợi kiểm duyệt trong 2a sẽ duyệt những sản phẩm chưa ai mua được.

## Nền chung — 2 câu trả lời không đổi giữa các phương án

### Q1 — SKU unique per-shop, partial, case-insensitive

`UNIQUE (shop_id, upper(btrim(sku))) WHERE sku IS NOT NULL AND sku <> '' AND status <> 'archived'`

- **Global thua nghiệp vụ.** SKU là mã kho của người bán, thường chép từ mã nhà sản xuất. Global unique nghĩa là shop B không lưu được `PG-CP-W40` vì shop A dùng trước, và thông báo lỗi không giải thích được ("mã này shop khác đang dùng" — họ đâu thấy shop khác).
- **Per-product là mức tối thiểu** mà prototype nêu lý do (`S06ProductNew.tsx:301-308`: trùng SKU giữa Trắng/40 và Đen/40 → in phiếu gửi nhầm). Nhưng cho phép một shop có 2 sản phẩm cùng mã — đúng tình huống quét mã trong kho rồi lấy nhầm hàng.
- **Per-shop đúng mức**: trong một kho, một mã trỏ đúng một thứ. Loại trừ `archived` để đăng lại hàng cũ với mã cũ không bị chặn. Cho phép SKU rỗng (fixture `p-10` draft có `sku: ""`) — lưu NULL, NULL không đụng nhau.
- Giữ `shop_id` trung thực trên variant **không cần trigger**: `products` có `UNIQUE (id, shop_id)`, `product_variants` khai `FOREIGN KEY (product_id, shop_id) REFERENCES products(id, shop_id)`. Postgres tự bảo đảm.

### Q2 — Bật/tắt còn-hết hàng: guarded UPDATE, không RPC

```sql
UPDATE public.product_variants
   SET in_stock = _new, updated_at = now()
 WHERE id = _id AND in_stock = _expected
RETURNING in_stock;
```

0 dòng = có người đổi trước → client hiển thị trạng thái server trả về, không ghi đè. **Không phải read-client-write**: điều kiện nằm trong `WHERE`, không nằm trong đầu client. Không cần `FOR UPDATE` — một `UPDATE` một dòng đã khoá dòng đó. Hai lần chạm trên mạng chập chờn: lần hai khớp 0 dòng → idempotent (một RPC kiểu `SET in_stock = NOT in_stock` thì lật hai lần — đó là lý do không làm kiểu đó).

`in_stock` **không** nằm trong nhóm cột bị guard trigger ghim: người bán tắt hàng lúc 11h đêm không được rơi vào hàng chờ duyệt lại.

Kèm theo: guard trigger trên `products` chia cột làm hai nhóm, ghi rõ trong migration — **nội dung** (title, description, media, category, condition, attributes) vs **vận hành** (price_vnd, in_stock, archived). Sửa nhóm vận hành không kích hoạt duyệt lại. Rủi ro chấp nhận: duyệt ở 2.450.000₫ rồi sửa thành 24.500.000₫ không qua duyệt — chuyện giá nhìn thấy được, admin suspend được; đổi lại người bán không mất hiển thị mỗi lần giảm giá.

## Option A — Trọn gói theo brief (private staging + publish-on-approve)

**16 nửa ngày** · 2a.1=3.5 · 2a.2=4.5 · 2a.3=3.5 · 2a.4=3.5 · 2a.5=1
**Data:** migration mới (4 bảng, 2 enum, ~16 policy, 3 trigger, 3 RPC, 2 bucket) + `supabase/config.toml` → **🔴 RED, cần Cuong ký**

Theo **brief**, không theo map: kiểm duyệt vào 2a.

- **Q3 media:** hai bucket. `shop-media-staging` (private) nhận mọi upload; `shop-media` (public) chỉ chứa ảnh đã duyệt. Khi approve, edge function `shop-media-publish` (service role, xác thực qua `_shared/admin-aal.ts`) copy staging→public rồi cập nhật `product_media.public_path`. Seller/admin đọc staging bằng `createSignedUrl` — **net-new**: hook `useShopMediaUrls` ký theo lô (`createSignedUrls` số nhiều, tránh N+1), TTL 1h, refresh timer, và luật runtime-cache trong `vite.config.ts` phải **loại trừ** URL đã ký (cache URL hết hạn = ảnh vỡ trong PWA và WebView native).
- **Q4 state machine:** `draft | pending_review | active | needs_changes | restricted | archived` (đúng 6 trạng thái prototype, `ListingStatusBadge` dùng lại nguyên). seller INSERT→draft; `shop_product_submit()` draft|needs_changes→pending_review (validate server: có category, title ≥8 ký tự, ≥1 ảnh, ≥1 variant giá >0, tick cam kết hàng thật); admin `shop_product_decide()` pending_review→active|needs_changes|restricted (`FOR UPDATE` + early-return khi terminal); seller `shop_product_set_listing()` active↔archived. `restricted` chỉ admin gỡ. **Sửa nội dung sau khi duyệt → quay lại `pending_review`, ẩn khỏi người mua**, có cảnh báo trước khi lưu (`S07ProductEdit.tsx:65-72`).
- **Q5 public read:** policy, **không** view. Cơ chế thật là **không tạo cột bí mật nào** trên `products` — lý do từ chối gửi thẳng người bán (`moderation_note`), suy nghĩ riêng của admin nằm trong `audit_logs.metadata` (đã admin-only, `resource_type='shop_product'` đã có ở `20260811090000...sql:674-681`). Một policy là đủ: `USING (status='active' AND EXISTS(shop active))`. Variants/media dùng helper `product_is_public(_id)` `STABLE SECURITY DEFINER`. Thêm test schema fail nếu ai thêm cột `%internal%`.

**Wins:** thoả đúng chữ của ràng buộc media; vòng duyệt hoàn chỉnh.
**Loses:** 16 nửa ngày ≈ 4 tuần buổi tối; thêm edge function trên đường duyệt — đúng loại bề mặt blob-loss đã đốt repo 3 ngày 27–29/07; `config.toml` = RED thứ hai.
**Forecloses:** khoá cứng chi phí vận hành: ảnh sống ở 2 chỗ, cần dọn orphan, mỗi màn phải biết đang xem staging hay public.

## Option B — Catalog trước, hàng đợi kiểm duyệt sau (KHUYẾN NGHỊ)

**10 nửa ngày** · 2a.1=3 · 2a.2=4.5 · 2a.3=1.5 · 2a.4=0.5 · 2a.5=0.5
**Data:** một migration (4 bảng, 2 enum, ~16 policy, 3 trigger, 3 RPC, 1 bucket) → 🔴 RED (migration), **không** đụng `config.toml`, không edge function.

Theo **map**: mặt tiền người mua là P2b, nên hàng đợi duyệt dựng ở 2a sẽ gác một cánh cửa chưa tồn tại. 2a giao **hợp đồng** kiểm duyệt đầy đủ trong DB, **hoãn UI**.

- **Q3 media:** một bucket `shop-media`, **public, đường dẫn không đoán được**: `<shop_id>/<product_id>/<uuid>.webp`. Dòng `product_media` bị RLS che → không ai liệt kê được. Storage policy theo thư mục: `INSERT/UPDATE/DELETE` yêu cầu `(storage.foldername(name))[1] = shop_id` **và** `is_shop_member(...)` — chặt hơn tiền lệ `og-images`, nơi *bất kỳ* authenticated nào cũng xoá được ảnh người khác (`20260415000001_create_og_images_bucket.sql:40-44`, **lỗ có sẵn đáng ghi TODO**). Khi `restricted` hoặc archive: **xoá cứng object**. Giá phải trả, nói thẳng: ảnh draft ai có URL vẫn xem được. Mô hình đe doạ thật là "người bán chia sẻ link ảnh cái vợt họ sắp đăng bán" — không phải bí mật. Nếu không chấp nhận → **B′**: bucket private + ký theo lô, **+1.5 nửa ngày**, và vì 2a không có người tiêu thụ công khai nên B′ *không* cần đường ống publish.
- **Q4:** y hệt A. Khác duy nhất: **không có màn admin**. Với 2–5 shop pilot, Cuong duyệt bằng `select shop_product_decide('<uuid>','approve')` trong SQL editor. RPC vẫn đúng: `is_admin()` (⇒ AAL2), `FOR UPDATE`, audit — UI sau này gọi đúng hàm đó.
- **Q5:** policy giống A, **bật ngay từ 2a** kể cả khi chưa có route người mua, và pgTAP chứng minh anon thấy 0 dòng draft/pending/needs_changes/restricted/archived và 0 dòng của shop không `active`. Rẻ (0.5 nửa ngày), là thứ P2b dựa vào.

**Wins:** 10 nửa ngày; trả lời câu hỏi đắt nhất chưa ai biết — *một shop Việt Nam có thật sự ngồi nhập 15 sản phẩm bằng điện thoại không?* Nếu 2 tuần sau có 3 sản phẩm, 5.5 nửa ngày UI duyệt chưa cần viết. Bề mặt RED chỉ còn đúng migration.
**Loses:** admin chạy SQL ~2 tuần; ảnh draft "unlisted" chứ không "private".
**Forecloses:** không gì.

## Option C — Ống dẫn mỏng (đủ vòng seller→admin, chỉ sản phẩm đơn giản)

**11 nửa ngày** · 2a.1=3 · 2a.2=2.5 · 2a.3=2.5 · 2a.4=2.5 · 2a.5=0.5

Đi hết vòng draft→gửi duyệt→yêu cầu sửa→gửi lại→duyệt, có UI cả hai đầu, nhưng **mỗi sản phẩm đúng 1 variant**. Bỏ `VariantMatrix`, bỏ đặt giá hàng loạt, bỏ toàn bộ trạng thái `duplicate-sku`.

**Wins:** kiểm chứng vòng kiểm duyệt bằng người thật sớm nhất.
**Loses:** shop bán giày không đăng được hàng (`giay` là 1 trong 6 danh mục seed); đặt cược rằng rủi ro nằm ở vòng duyệt, trong khi rủi ro lớn hơn là **chẳng ai nhập liệu**.

## Khuyến nghị: Option B

Trong 2a **không có mặt tiền người mua**, nên toàn bộ UI kiểm duyệt của A và C đang gác một cánh cửa chưa dựng. 5.5 nửa ngày của A và 2.5 của C tạo 0 giá trị cho người mua ở 2a, trong khi ẩn số chưa ai trả lời được là *người bán có nhập liệu không*. B trả lời ẩn số đó trong ~2.5 tuần, giữ hợp đồng RPC nguyên để P2b chỉ gắn UI, và **thu bề mặt RED xuống đúng một file migration** — repo này đã mất 3 ngày vì blob-loss ăn edge function.

**A thua** vì trả 6 nửa ngày phụ trội cho đường ống staging→public và một tiền lệ signed-URL vĩnh viễn, để bảo vệ ảnh cái vợt mà người bán đang định công khai. **C thua** vì đặt cược sai chỗ: tiết kiệm ở ma trận biến thể (thứ người bán giày cần) để chi cho UI duyệt (thứ chưa ai cần).

Nếu Cuong không lay chuyển về media riêng tư → **B′** (+1.5 nửa ngày, tổng 11.5), vẫn rẻ hơn A 4.5, vì phần đắt của A không phải "private" mà là "publish-on-approve".

## Increments

1. **2a.1 — migration + pgTAP.** 4 bảng, 2 enum, seed 6 danh mục (đúng `fixtures.ts:201-208`, kèm `name_vi`/`name_en`), policy + GRANT + guard trigger + 3 RPC. Verify: `supabase test db --local` xanh, ≥30 assertion, tối thiểu — anon không thấy draft/pending/needs_changes/restricted/archived; member shop A không đọc/ghi shop B; seller không tự set `status='active'`; SKU trùng cùng shop → 23505; SKU trùng khác shop **được phép**; `decide` 2 lần không sinh 2 chuyển; guarded UPDATE `in_stock` với `_expected` sai trả 0 dòng.
2. **2a.5 — public read model.** Gộp cùng migration: policy public + `product_is_public()` + test chặn cột `%internal%`.
3. **2a.2 — S05 danh sách.** Route `/seller/products`, lật `ready: true` ở `ShopShell.tsx:80`.
4. **2a.2 — S06/S07 tạo & sửa**, gồm ma trận biến thể, validate client dùng chung `productValidation.ts` với luật server.
5. **2a.3 — ảnh.** Bucket + storage policy theo thư mục + upload hook (8 MB, JPEG/PNG/WebP/HEIC, canvas downscale ~30 dòng, **không thêm dependency**). Verify: member shop B không upload vào thư mục shop A (**42501 thật, không phải UI ẩn nút**).
6. **2a.4 — hợp đồng duyệt, không UI.** Runbook 5 dòng cho Cuong chạy SQL.

**Điểm dừng-và-nhìn: sau bước 5.** Pilot nhập bao nhiêu sản phẩm sau 14 ngày; bao nhiêu bị "yêu cầu sửa" (nếu 0 thì UI duyệt là hàng đợi rỗng); người bán có nhập nổi biến thể trên điện thoại không.

**Ngân sách & SEO:** không thêm dependency; 3 route seller lazy, ~18–22 KB gz vào nhóm CODE (đang 1455/1800, tổng 1822/1970) — không chạm INITIAL. Không route công khai mới ở 2a ⇒ **không** cần handler `functions/_lib/render/`, không đụng sitemap. `/seller/*` đã phủ bởi `_middleware.ts:86` và `robots.txt:18-21`. Khi P2b dựng `/shop/product/:slug`: cần `render/shop-product.ts`, `sitemap-shop.xml`, cặp hreflang, bump `pr:v34` — **mặc định route đó được index**, pattern noindex hiện tại chỉ khớp `/shop/sell`.

**Song ngữ:** Phase 1 đã ship Seller Center **VI cứng trong JSX** (`SellerHome.tsx:18-24`). Không nhân rộng: 2a thêm `src/lib/shop/strings.ts` dạng `Record<key,{vi,en}>` cho chrome 3 màn mới (+0.5 nửa ngày), ghi nợ backfill 4 màn Phase 1 vào `docs/milestones.md`. Nội dung người bán nhập **không** có cột `_en` — chữ của người bán, không dịch.

## Điều agent không chắc

- **Số shop pilot thật.** Khuyến nghị đứng trên giả định 2–5 shop. Nếu đã có 15 người bán chờ, "admin chạy SQL" sập ngay và A/C đúng hơn. Không tìm thấy allowlist ở đâu trong repo.
- **`restricted` vs `suspended`.** Prototype dùng `restricted` (`fixtures.ts:45-51`), brief hỏi `suspended`. Chọn theo prototype; nếu Cuong đọc "suspended" là trạng thái *khác* thì đó là 7 trạng thái và agent đang thiếu một cái.
- **Ranh giới nội dung-vs-vận hành cho `price_vnd`.** Đánh đổi sản phẩm chứ không phải kỹ thuật; không có dữ liệu thị trường VN để nói nó an toàn.
- **Cỡ ảnh iPhone.** Giả định HEIC ~2–4 MB nên ngưỡng 8 MB đủ. Chưa đo máy thật; nếu HDR 12 MP thường vượt thì 2a.3 đội thêm ~0.5 nửa ngày.
- **`shopFrom`/`shopRpc` có gánh nổi catalog không.** Builder ở `shop-client.ts:23-35` chưa có `in()`, `or()`, `range()` — danh sách sản phẩm có lọc + tìm kiếm nhiều khả năng cần thêm 2–3 method.
- **`docs/slo.md`** — chưa mở file đó ở worktree này để trích đúng câu.

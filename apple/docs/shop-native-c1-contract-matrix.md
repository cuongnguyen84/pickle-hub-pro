# Shop native iOS — C1/P2b public contract matrix

**Nguồn khóa:** `feat/shop-production-phase-2b` @ `7b52cc37`  
**Acceptance:** P2b Product Owner acceptance PASS locally (2026-08-12).  
**Nguyên tắc:** native chỉ gọi các public RPC dưới đây; không select bảng marketplace private.

## Public RPCs

| Native use case | RPC | Inputs | Output |
| --- | --- | --- | --- |
| Home/search/category/store products | `shop_public_search` | `_q`, `_category_slug`, `_shop_slug`, `_condition`, `_in_stock_only`, `_sort`, `_cursor_at`, `_cursor_id`, `_limit` | `{rows,total,has_more}` |
| Categories | `shop_public_categories` | `_only_stocked` | `[{slug,name,sort_order,product_count}]` |
| PDP + contacts + slug redirect | `shop_public_product` | `_slug` | `{found,redirect_to?,product?,contacts?}` |
| Public store + contacts + redirect | `shop_public_shop` | `_slug` | `{found,redirect_to?,shop?,contacts?}` |

Không public RPC nào nhận privilege flag. `product_public_projection(...,_as_seller)` là implementation nội bộ và không được native gọi.

## Card DTO → native

| Public field | Native meaning | Rule |
| --- | --- | --- |
| `id` | Product stable UUID | Identity/data only; navigation ưu tiên `slug`. |
| `slug` | Product route | Không dùng làm ownership key. |
| `title` | Product title | Server value. |
| `condition` | `new` / `used` | Controlled vocabulary. |
| `category.slug/name` | Category identity/display | Native enum chỉ map slug đã biết; unknown slug phải fail closed hoặc dùng DTO presentation riêng. |
| `shop.slug/name/verified` | Public seller summary | Card không có shop UUID/region/contact. Không tự sinh UUID. |
| `price_min/max` | Server-derived VND range | `Int`, nullable; native không suy lại từ private stock. |
| `availability` | `in_stock/out_of_stock/unknown` | `unknown` = “Liên hệ shop để hỏi số lượng”, không phải còn hàng. |
| `cover.public_path` | Approved rendition key | Ghép với public bucket `shop-product-media`; reject absolute/signed/token paths. |
| `cover.alt_text,width,height` | Accessibility/layout metadata | Không dùng filename/private metadata. |
| `created_at` | Cursor/sort metadata | UTC ISO-8601. |

## PDP projection → native

| Public field | Native mapping/rule |
| --- | --- |
| `option_groups` | Display order của option groups. |
| `variants[].option_values` | Selection theo key/value, không theo index. |
| `variants[].price_vnd` | Giá variant, integer VND. |
| `variants[].availability` | Server-derived tri-state; public `stock_on_hand` phải `null`. |
| `variants[].media_id` | Map atomically tới `media[].id`; null fallback `primary_media_id`. |
| `media[].public_path` | Approved public rendition only. Public `path` phải `null`. |
| `media[].position` | Position 0/main ordering; `primary_media_id` là canonical primary answer. |
| `shop.shipping_note/return_note` | Trust copy do seller cung cấp. |
| `contacts[].href` | Server-derived outbound destination; native không dựng URL từ raw contact. |

Public reader phải reject/không decode thành buyer data nếu thấy `stock_on_hand`, draft/original path, `internal_note`, `client_token`, signed token hoặc cleanup metadata có giá trị.

## Contract decisions reflected in native integration

- Discovery/search/category dùng cùng `shop_public_search`, không query từng table.
- Pagination cursor hiện theo `created_at + id`; sort contract nhận `recent`, `price_asc`, `price_desc`.
- Public availability là tri-state. Model fixture cũ `nil stock == available` không được tái dùng làm production truth.
- Card DTO và PDP DTO khác shape; không tạo variant/shop UUID giả để ép card vào `ShopProduct`.
- Product/store redirect dùng slug response trong cùng RPC, không gọi existence probe riêng.
- Locale redirect `/vi/shop/store/<old-slug>` làm mất `/vi` là finding chưa chốt; native không sửa web behavior.

## Native integration status

Native tích hợp DTO/transport read-only trực tiếp từ contract snapshot `7b52cc37`; không checkout branch web.

1. DTO `Decodable` riêng cho card, PDP, store, category và contact. **Đã hoàn thành.**
2. `ShopPublicAPI`/`SupabaseShopPublicAPI` chỉ gọi bốn public RPC trên. **Đã hoàn thành và đã bật qua `SupabaseShopRepository`.**
3. Refactor discovery presentation để dùng card summary trực tiếp, không tạo domain object giả. **Đã hoàn thành.**
4. Decoding fixtures và negative leakage/path tests. **Đã hoàn thành.**
5. Chạy anonymous integration trên local Supabase P2b. **Đã hoàn thành:** 4/4 RPC trả HTTP 200; categories/search/not-found product/not-found shop đúng shape trên DB sạch.

`SupabaseShopRepository` hiện là dependency mặc định cho launch thường. Simulator screenshot hooks dùng `MockShopRepository` tách biệt; lỗi production không fallback sang fixture.

Closed-pilot probe 2026-08-12: Supabase project được native cấu hình trả HTTP 404 / `PGRST202` cho cả bốn RPC. Đây là environment/deployment mismatch; không bật Release pilot flag cho tới khi probe trả 200. Local Supabase vẫn trả 200 cho 4/4 RPC.

Remote migration ledger read-only xác nhận nhiều migration local/remote đang lệch và workspace hiện tại không chứa file migration định nghĩa bốn RPC C1 (chúng chỉ có ở nhánh web P2b snapshot). Native agent không tự push một ledger không đầy đủ hoặc checkout đè worktree dirty.

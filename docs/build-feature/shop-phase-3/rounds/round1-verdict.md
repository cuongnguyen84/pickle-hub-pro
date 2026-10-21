# VERDICT VÒNG 1

**CHƯA ĐẠT** — 3 lỗi chặn (C1, C2 + A26 xanh giả), 5 mục nên sửa, 4 ghi nhận.

- Code review đầy đủ: `round1-code-review.md`
- Test trình duyệt: **không có** (vòng 1 không sinh UI nào) ⇒ bước `tester` bỏ qua đúng quy trình, không phải bỏ sót.
- Prompt sửa lỗi cho vòng 2: `round2-prompt.md`

## Cái ĐẠT, không mở lại
Máy trạng thái · khoá tồn kho `FOR UPDATE` + thứ tự tăng dần · idempotency (kể cả nhánh `unique_violation`) · guarded transition + chống hoàn kho hai lần · hợp đồng lỗi chính · tính idempotent của migration khi áp lại · `shops_guard_privileged_columns()` sửa đúng 1 dòng, không mất cửa thoát `shop.slug_write`.

## Cái CHẶN
| # | Vấn đề | Hệ quả |
|---|---|---|
| C1 | `shop_order_create` ghi `actor_user_id` = uid người mua vào `inventory_movements`, bảng đó có FK `ON DELETE SET NULL` + trigger append-only raise vô điều kiện | `delete-account` **vỡ vĩnh viễn cho mọi người mua**. Bug đã có sẵn trên prod ở **4 bảng**, vòng này làm nó lan từ "vài seller" ra "mọi người mua" |
| C1b | A26 dùng variant `stock_on_hand IS NULL` ⇒ không sinh ledger ⇒ không chạm FK | Test canh đúng việc đó **xanh giả** |
| C2 | `GRANT SELECT (actor_user_id)` trên `shop_order_events` cho `authenticated` | `buyer_user_id` lộ ra REST **qua cột khác** — bất biến §E.10 bị phá; A19 không bắt vì chỉ canh bảng `shop_orders` |

## Điều chỉnh quy trình cho vòng 2
Blocker là SQL thuần và đã được đặc tả đến từng dòng, còn khối lượng lớn nhất còn lại là UI (S3–S6). Vòng 2 chạy **hai coder song song trên hai tập file rời nhau**:
- **Coder A** — sửa lỗi SQL theo `round2-prompt.md`. Sở hữu `supabase/**`, `scripts/qa/**`, `src/lib/__tests__/shop-schema-parity.test.ts`, `src/lib/shop/__tests__/orderState.test.ts`.
- **Coder B** — UI S3+S4 (giỏ hàng, checkout, đơn đặt thành công) theo `round2-ui-prompt.md`. Sở hữu `src/pages/shop/**`, `src/components/shop/**`, `src/hooks/shop/**`, `src/App.tsx`, `src/styles/shop.css`, `src/lib/shop/errors.ts`, `src/integrations/supabase/shop-schema.ts`, `functions/_middleware.ts`.

Lý do lệch khỏi trình tự tuần tự của /build-feature: phiên chạy qua đêm, mục tiêu PO là "người dùng thao tác được ngay", và hai tập file không giao nhau nên chạy song song không tạo xung đột.

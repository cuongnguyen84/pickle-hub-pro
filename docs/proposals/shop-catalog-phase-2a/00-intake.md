# Intake — shop-catalog-phase-2a

**Ngày:** 2026-08-11
**Base:** `1fac6b4f` (Phase 1 — closed-pilot gate, seller application, admin review)
**Worktree:** `feat/shop-production-phase-2a`, sạch 0 file bẩn

## Ý tưởng

Production catalog cho Shop marketplace (Phase 2a): schema
categories/products/variants/SKU/inventory, product moderation state machine,
RLS deny-by-default cho 7 actor, media storage boundary, chiến lược concurrency
cho inventory.

## Đã chốt trước khi vào panel (không mở lại)

- Không cart / checkout / payment / returns / disputes / reviews — đó là Phase 3.
- Không thu CCCD, không thu tài khoản ngân hàng.
- "Quy chế người bán v1" **chưa tồn tại** → không tạo nội dung pháp lý giả, không
  ghi nhận acceptance cho văn bản không có thật. Là blocker của Product Owner.
- Prototype 37 màn = visual/interaction specification. Không đưa fixture,
  scenario-switch hay đếm-từ-fixture vào production.
- Authorization identity = `auth.users.id`. Email chỉ để admin tra ra UUID.
- Không apply migration remote, không deploy, không merge main.

## Cuong trả lời (2026-08-11)

| Câu | Trả lời | Hệ quả thiết kế |
|---|---|---|
| Danh mục quản lý thế nào? | **Seed cố định trong migration**, không CRUD | Không có bảng admin-managed + màn CRUD + bề mặt RLS thứ ba. 6 danh mục nằm trong migration; thêm CRUD khi có shop thật đòi. |
| Duyệt xong thì sao? | **Duyệt là lên luôn** | `approved` = người mua thấy ngay. Không tách `published`. Người bán gỡ bằng "Ngừng bán". Ít trạng thái nhất, khớp prototype (`active`). |
| Tồn kho? | **Chỉ còn hàng / hết hàng** | Không cột số, **không** bảng `inventory_movements` ở 2a. Boolean trên từng variant. Số thật + trừ kho an toàn đi cùng Phase 3, nơi có thứ thực sự tiêu thụ nó. |

Ba câu trả lời đều cắt phạm vi xuống. Panel cần soi phần **còn lại** chứ không
đề xuất thêm thứ đã bị cắt.

## Câu hỏi mở panel phải soi

1. Scope của SKU uniqueness constraint (per-shop? per-product? global?)
2. Concurrency cho trạng thái còn/hết hàng — không read-client-write
3. Ranh giới private/public cho media: draft vs published product
4. Product moderation state machine + ai được chuyển trạng thái nào
5. Public read model tránh lộ draft / pending / rejected / suspended

## Bối cảnh kỹ thuật mới so với Phase 1

Docker 27.4.0 + Supabase CLI 2.111.0 **có sẵn** → lần này chạy được database
disposable thật. Nghĩa là 24 pgTAP assertion của Phase 1 (viết rồi, chưa chạy)
và pgTAP của 2a đều có thể chuyển từ *specified* sang *verified locally*.
Panel nên tính điều này khi đánh giá rủi ro.

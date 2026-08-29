# Ý tưởng gốc (2026-08-29)

> E xem nhánh đang phát triển shop - thiết kế lại nút giỏ hàng và đơn hàng của tôi thành nút float trên nền shop - nút giỏ hàng cần 2 light nổi bật

- Nhánh: feat/shop-production-phase-1
- Nút "Giỏ hàng" và "Đơn hàng của tôi" trong Shop → chuyển thành nút float (FAB) nổi trên nền shop.
- Nút giỏ hàng cần hiệu ứng "2 light" (2 điểm sáng/highlight) để nổi bật.

## Quyết định orchestrator (bước 1)
- Nhánh `feat/shop-production-phase-1` không chứa code người mua → làm tại worktree
  `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-fab` (nhánh `feat/shop-floating-cart`, từ `origin/main` 3e5f6365).
- Mọi agent code/test làm trong worktree đó (node_modules symlink về repo gốc). Tài liệu build-feature vẫn ở repo gốc.

# Tiến độ Shop theo phase — chốt 17/08/2026 (bảng phase gốc: production-implementation-map.md §1)

| Phase | Scope đã ký | Trạng thái |
|---|---|---|
| 0 — Implementation map | Bản đồ triển khai | ✅ 100% (11/08) |
| 1 (P1) — Seller onboarding | Pilot gate · hồ sơ (draft→submit→resubmit) · admin queue/duyệt/yêu-cầu-sửa · audit · shells | ✅ 100% prod (#578) + hoàn thiện: nút kích hoạt shop thay script tạm (#584 16/08) |
| 2 (P2a) — Catalog seller | Profile · sản phẩm/variant/SKU · tồn kho · media · submit-review · state machine + RLS | ✅ 100% prod (#578) + vá: iPhone JPEG fallback (#584); nối publish leg logo/bìa bị bỏ trống (#603 17/08) |
| 2 (P2b) — Moderation + public | Admin duyệt sản phẩm · discovery + PDP + trang shop công khai | ✅ 100% prod (#578/#580) + UI card-first 5 vòng theo chuẩn PO (#603) |
| 3 (P3a) — Wishlist/cart/checkout/order/inventory-reservation | ⛔ CHƯA BẮT ĐẦU — đúng kế hoạch (16/08: full-build = RED; chỉ bàn sau soak Wave 1 chạm ngưỡng) |
| 3 (P3b) — Đơn/huỷ/trả/dispute/review | ⛔ Sau P3a |
| 4 — Payment / public launch | ⛔ Khoá tường minh (approval riêng + legal; Option B′ không-KYC/bank hiệu lực) |

**Kết luận: Phase 0-2 XONG TRỌN trên production (kể cả nợ ẩn của chính nó). Phase 3-4 đứng chờ đúng cổng.**

## Lớp vận hành Wave (giữa Phase 2 và 3, PO chốt 16/08)
- Wave 0 nội bộ: ✅ đang chạy — shop ThePickleHub (thepicklehub.net@gmail.com) sống trọn vòng đời trên prod: đăng ký → duyệt → kích hoạt → đăng sản phẩm từ iPhone → duyệt → logo/bìa → trang công khai hoàn chỉnh. Indexing OFF.
- Wave 1 (3-5 seller quen): 🔴 chờ (1) fix bug nút "Đưa lên trang shop" iOS Safari, (2) PO ký gate phễu 3 số + ngưỡng P3a + legal. Thêm seller = `scripts/add-shop-pilot-member.sh <email>`.
- Soak 2-4 tuần → số liệu quyết mở Phase 3.

## 🔴 VIỆC KẾ TIẾP ĐÃ ĐỀ XUẤT: điều tra bug nút "Đưa lên trang shop" (iOS Safari, PO tái hiện 17/08)
Đã biết: server khỏe từng khúc (prepare trả plan đúng dưới danh tính seller — probe qua Management API với set_config jwt.claims; source objects đúng path/size trong draft bucket; edge fn prod phản hồi đúng anon probe 403; CORS `*`; verify_jwt=false; CSP connect-src https: không chặn; schema cache OK). Click từ iPhone không thấy tới gateway — NHƯNG `function_edge_logs` prod ghi thiếu nặng (24h chỉ 1 dòng toàn hệ thống) nên KHÔNG kết luận từ absence. Workaround đã dùng: `scripts/publish-shop-profile-media-manually.sh` (logo+cover của shop PO đã live bằng đường này). Hướng điều tra: repro trên Chrome desktop với seller pilot + bắt console/network iPhone thật; nghi vấn còn lại: supabase.functions.invoke từ bundle preview/prod, hoặc lỗi client trước fetch.

## Ghi chú lịch sử 3 đợt ship
- 16/08 sáng #578/#580 `4ea32d3e`/`c6c043b2`: closed pilot Phase 1-2 trọn bộ.
- 16/08 tối #584 `1854cf5c`: shop_activate RPC + admin UI · iOS JPEG fallback end-to-end · polyfill randomUUID. Migration 20260816090000 + 20260816120000 + ledger + edge fn đã áp prod.
- 17/08 #603 `8f833e5a`: UI card-first 5 vòng (audit trail docs/build-feature/shop-ui-polish/) + logo/cover publish leg (migration 20260817090000 + edge publish_profile, đã áp prod trước merge). Prod verify bundle + smoke 200.

## Backlog không chặn
Bulk-approve admin (PO hoãn) · admin UI pilot allowlist · pill suspended rỗng + filter đếm sai (bug P2b, chờ PO chốt chữ) · nút Nhắn Zalo chờ PO duyệt URL zalo.me/2932845421782592643 · visual baseline capture (/shop, /shop/sell đã vào spec) · monogram 22px PDP · gate pending-cleanup theo shop state cả 2 arm (P3 review) · test-hardening aria-label 1 dòng · bundle Total headroom ~9 KB (cần đợt dọn trước feature JS lớn) · owner_user_id lộ REST anon (bắt buộc TRƯỚC indexing) · fixture QA seed ảnh thật · B14 delete-account.

# Vòng 5 — Báo cáo coder (logo + banner shop: nối publish leg)

Commit `058fbe4e` (12 file, +933/−88), chưa push.

## Đã làm
- **Migration `20260817090000_shop_profile_media_publish.sql`**: `shop_profile_media_publish_prepare` (authz manager/admin, refuse shop không active, plan target deterministic `<shop>/profile/<purpose>/<media>/v<version>/live.webp`); vá `..._publish_commit` GIỮ NGUYÊN signature (không 42725): equality check khoá deterministic (đóng stale-plan race), refuse shop hết active, DELETE pending cleanup jobs cùng transaction (mirror product); `shop_media_referenced_objects` thêm arm profile (biểu thức identical với prepare); `shop_public_shop` copy verbatim + THÊM `logo_path`/`cover_path`/`cover_focal_y` (subselect `public_path IS NOT NULL` = security boundary), anti-enumeration giữ byte-identical.
- **Edge fn `shop-media-lifecycle`**: action `publish_profile`; `copyRenditionToPublic()` factor dùng chung với `publish` (contract cũ giữ); per-item độc lập (cover fail không kéo logo); path từ plan DB; log không URL/token.
- **Client**: `usePublishProfileMedia` (pattern usePublishProduct + lazy-import gotcha); ProfileSlot auto-publish sau finalize + trạng thái trung thực "Đã xác minh nhưng chưa lên trang shop công khai" + nút retry "Đưa lên trang shop"; gỡ copy sai "Trang shop công khai chưa mở" (2 chỗ); `usePublicShop` +3 field; ShopStore render banner 120/160px object-position theo focal_y (alt="", không DOM khi null) + logo 72px fallback monogram.
- **pgTAP**: file mới 20 test; reconcile test +2 (plan 19).

## Gates
db reset OK · pgTAP mới 20/20 · full **44 files / 1457 PASS** · vitest 185 files / 2761 pass, statements **83.28%** · lint 0 error · tsc 0 · build + bundle PASS (headroom 9.1 KB, client +0.6 KB) · smoke edge local: 401/403/400 đúng chỗ (gotcha mới: edge runtime container mount functions từ worktree CŨ — docker restart không đủ, phải `supabase stop/start` từ worktree hiện tại) · fixture reseeded.

## Khai báo rõ
1. 2 test cũ pin contract cũ được cập nhật CÓ CHỦ ĐÍCH (`shop_phase2a_media_ordering.test.sql`, `scripts/shop-p2b-media-lifecycle.test.mjs`): trước commit bằng khoá tuỳ ý — nay equality check từ chối, đúng thiết kế AC11; thêm assert refuse-khoá-sai.
2. Chưa test tay happy path browser (upload thật → publish → thấy trên store) — việc tester.
3. `publish_profile` partial-fail trả 502 + `{ok:false, published, failed}` — client retry idempotent; muốn 200-partial thì đổi 1 dòng.
4. Khi ship prod: migration + deploy edge fn PHẢI cùng đợt (migration đứng riêng vô hại; UI mới cần cả hai).

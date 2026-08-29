# Vòng 2 — Báo cáo coder (F1/F2/F6)

- **F1** `SellerHome.tsx`/`ProductStats`: `total` = đúng 4 nhóm hiển thị (approved + pending_review + needsFix(needs_changes+rejected) + draft), không còn cộng archived/suspended. Empty theo `total === 0`.
- **F2**: prop `shopState` cho ProductStats; nút "Đăng sản phẩm đầu tiên" chỉ render khi `shopState === "active"`. Không đổi copy.
- **F6** `SellerProducts.tsx`/`Thumb`: `useEffect(() => setBroken(false), [src])`.
- Test: +2 case SellerHome.copy (archived-only → empty; pending_activation → không nút), +1 case Thumb (error → ImageOff, rerender src mới → img lại).

Diff (`git diff 09ee93af --stat`): 4 file, +71/−8. Commit duy nhất `3ca76cb7 fix(shop): round-2 review fixes`, chưa push.

AC-R2: **6/6 PASS** — lint 0 error · tsc 0 · vitest 185 files / 2745 pass, statements **83.14%** · build + bundle exit 0 (headroom 9.9 KB có sẵn) · diff đúng 4 file · copy test chỉ append.

Ghi chú: shop toàn archived thấy "Chưa có sản phẩm nào" (chấp nhận — archived = đã cất đi); `archived` có sẵn trong TS union (chỉ suspended thiếu); prop shopState type string (diff tối thiểu).

# Vòng 2 — Prompt cho coder (trích nguyên văn từ round1-verdict.md §2, soạn bởi prompt-engineer + Codex đồng thuận)

Vòng 2 — chỉ sửa delta dưới đây trong worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-activation-button`. **KHÔNG đụng** migration `20260816090000_shop_activate_rpc.sql`, RPC, pgTAP, section "Kích hoạt shop", SellerHome — tất cả đã pass vòng 1.

**Fix 1 — Copy xác minh trên trang công khai đang dối người mua (blocker).**
Bối cảnh: `shop_activate` cho phép method `gap-truc-tiep` (không xem giấy tờ), nhưng RPC public chỉ trả boolean `verified = verified_at IS NOT NULL`, và copy công khai hiện claim "đã xem giấy tờ". Sửa copy thành trung thực với MỌI method (theo wording đã duyệt ở prototype `src/proto/shop/screens/B01Home.tsx:89`), không thêm migration, không đổi contract RPC:

1. `src/pages/shop/ShopStore.tsx`
   - dòng ~90: sr-text `"đã được xác minh giấy tờ"` → `"đã được ThePickleHub xác minh"`
   - dòng ~106: `"ThePickleHub đã xem giấy tờ kinh doanh của shop này."` → `"ThePickleHub đã xác minh shop này — đối chiếu giấy tờ hoặc gặp trực tiếp người bán."`
   - dòng ~107 (nhánh chưa verified): `"Shop chưa gửi giấy tờ để xác minh."` → `"Shop chưa được ThePickleHub xác minh."`
2. `src/components/shop/ProductCard.tsx` dòng ~77: sr-text `"shop đã được xác minh giấy tờ"` → `"shop đã được ThePickleHub xác minh"`
3. `src/pages/shop/ProductDetail.tsx`
   - dòng ~260: sr-text như trên → `"shop đã được ThePickleHub xác minh"`
   - dòng ~270: `"tình trạng xác minh giấy tờ của shop (nếu có)"` → `"tình trạng xác minh của shop (nếu có)"`
4. `src/components/shop/ProductPreview.tsx` dòng ~236: `"Shop đã được quản trị viên xác minh giấy tờ — đây không phải cam kết chất lượng."` → `"Shop đã được quản trị viên xác minh (đối chiếu giấy tờ hoặc gặp trực tiếp) — đây không phải cam kết chất lượng."`

Sau khi sửa: `grep -rn "giấy tờ" src/pages/shop src/components/shop` không còn dòng nào claim ĐÃ xem giấy tờ dựa trên boolean `verified` (các chỗ form nộp hồ sơ / seller-side nói về việc NỘP giấy tờ thì giữ nguyên).

**Fix 2 — Nút huỷ "Cancel" tiếng Anh trong dialog tiếng Việt (1 dòng).**
`src/pages/admin/shop/AdminShopApplicationReview.tsx`, call `confirm({...})` dòng ~62-69: thêm `cancelText: "Huỷ"` cạnh `confirmText: "Kích hoạt"`. (Root cause: `useConfirm` default `Cancel` khi language=en, dialog này hardcode tiếng Việt.)

**Acceptance criteria bổ sung (chỉ delta):**
- `npx tsc --noEmit` pass; `npm run test` pass (không test mới bắt buộc — copy thuần; nếu có test snapshot copy cũ thì cập nhật).
- Không file nào khác thay đổi ngoài 5 file trên; không migration mới.
- Trang công khai sau kích hoạt gap-truc-tiep không còn chữ "giấy tờ" trong claim xác minh.

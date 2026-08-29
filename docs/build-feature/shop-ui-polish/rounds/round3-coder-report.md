# Vòng 3 — Báo cáo coder (card-first theo reference PO)

Commit `51925550` (trên 8 commit vòng 1-2, chưa push). 7 file, +265/−131.

- §1: 12 token sub-theme vào 2 block (dark default + light: card #ffffff, shadow 2 tầng nhẹ, chip active đảo ink↔bg). Hex chỉ trong token block (grep xác nhận).
- §2: ProductCard viết lại — media 1:1 cố định (gỡ inline aspectRatio), title clamp 2, meta 1 dòng bỏ "Còn hàng", foot giá 16.5px/700 + nút tròn 34px `→` là span aria-hidden (cả card = 1 link, 0 button — test xanh). Hover lift + shadow-2, active scale .98. Skeleton mới cùng khung 1:1.
- §5: grid 2 cột từ 320px; status "N sản phẩm"; câu sparse chuyển SAU grid nguyên văn.
- §3: chips pill token, active nền fg chữ bg weight 650.
- §4: ShopStore — storehead không banner, monogram 72, pill "Đã xác minh", Liên hệ chỉ khi có contacts, h2 "Sản phẩm" + grid lên trên fold, footer "Thông tin shop" gom deflist + câu đầy đủ + NO_CONTACT_COPY. Không câu nào mất chữ.
- §6: ShopHome bỏ heading "Ngành hàng", h2 toàn cục 17px/700; PDP radius card qua CSS.
- Test: CatalogResults assertion cập nhật ("Còn hàng" phải VẮNG, sparse sau grid); +3 cặp contrast INK_ON_FILL.

AC: lint 0 error · tsc 0 · vitest 185 files / 2751 pass, statements 83.12% · build + bundle exit 0 (headroom 9.8KB, JS net ~0) · contrast xanh 2 mode + 3 assertion mới · grep 4/4 câu trung thực còn nguyên · 1 commit không push.

Checklist §8: 6/10 pass bằng code/test/grep; 4 dòng chuyển tester/PO (kiểm mắt 320-768, B01 fold, dark mode bằng mắt, force states).

Cần reviewer/PO xác nhận:
1. `.tl-shop-cat` là class DÙNG CHUNG — SellerProducts + 3 trang admin tự nhận style chip mới (AA cả 2 mode). Coder theo lệnh redesign, không fork class.
2. `.tl-shop-h2` 17px/700 toàn cục — heading seller/admin cũng đổi cỡ (spec ghi "toàn cục").
3. Tuỳ chọn §3 (tap chip bỏ lọc ở ShopCategory) BỎ QUA — trang đó không render CategoryChips, làm là vượt diff ngắn nhất.
4. Câu sparse giữ nguyên văn kể cả "— " mở đầu — đứng một mình sau grid hơi lạ; sửa là quyết định copy của PO.

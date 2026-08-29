# Round 1 — Verdict (Bước B, prompt-engineer)

## Verdict: CHƯA ĐẠT — vì 2 defect từ code review (F1, F2), KHÔNG phải vì tester.

Tổng hợp:
- **Tester: 9 PASS · 1 PARTIAL · 2 SKIP · 0 FAIL** — mọi hạng mục nhìn được đều đúng spec trên UI thật; TC-01 kiêm luôn bằng chứng runtime cho Bước 0.2 (RLS join trả cột + mint draft OK) → điều kiện treo ở sai lệch #8 của coder: ĐÓNG.
- **Code review: 2 defect phải sửa** (F1 total cộng cả archived/suspended; F2 nút "Đăng sản phẩm đầu tiên" không gate theo state) + F6 tuỳ chọn rẻ. Cả 3 đều là nhánh dữ liệu mà 12 TC vòng này không dựng được (fixture không có shop toàn-archived / shop chưa active có 0 sản phẩm) — tester 0 FAIL không phủ nhận 2 defect này.
- TC-11 (responsive) SKIP đúng dự báo (Chrome MCP không resize được — bài học cũ đã ghi memory) → chuyển Cuong kiểm tay iPhone, không chặn vòng.

### Phân xử 2 observation của tester

**Obs #2 — public catalog loại sản phẩm thiếu approved cover: CHỦ ĐÍCH, xác nhận.** Migration `20260813090000_shop_p2b_public_read.sql` dòng 183/298: search/catalog đòi `EXISTS (… m.public_path IS NOT NULL)` — thiết kế "one derivation, two doors" cố ý chặn ngay tầng RPC để 5 bề mặt không cãi nhau. Fallback "Chưa có ảnh" của ProductCard GIỮ làm defensive (đúng như tester đề nghị). Không hành động.

**Obs #3 — pill suspended RỖNG + filter "Ngừng bán (0)": bug CÓ SẴN từ P2b, KHÔNG do vòng này → BACKLOG, không gộp vòng 2.** Căn cứ: DB enum thêm `suspended` ở `20260812090000_shop_p2b_status_suspended.sql`, nhưng TS `ProductStatus` union (shop-schema.ts:132) và 3 map `Record<ProductStatus,…>` (LABEL/HINT/TONE trong productState.ts) chưa học giá trị này — toàn bộ các file đó nằm NGOÀI diff vòng 1. "Ngừng bán (0)" thực ra đếm ĐÚNG (archived=0; sản phẩm kia là suspended, không có chip riêng). Fix tử tế = mở rộng union + 3 map + có thể thêm chip lọc + **copy VI mới chưa được PO duyệt chữ** ("Đã gỡ"?) → quá 1-2 dòng và dính quyền copy. Ghi backlog: _"SELLER-SUSPENDED-LABEL: dạy seller UI trạng thái suspended (union + 3 map + chip?), cần PO chốt chữ."_ Lưu ý: fix F1 bên dưới (total tính từ nhóm hiển thị) tự vá luôn hệ quả suspended lọt vào total của dashboard.

Đếm vòng: coder đã chạy 1 lần → vòng 2/6.

---

## Prompt vòng 2 cho `coder` (delta fix — draft bởi Codex, tôi tinh chỉnh)

> Làm trong worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-ui-polish` (branch `feat/shop-ui-polish`, tiếp trên HEAD hiện tại `09ee93af`). Sửa đúng 3 lỗi sau với diff tối thiểu; không refactor, không lặp lại spec vòng 1, không đụng file nào khác ngoài 4 file nêu dưới.
>
> **1. F1 — `src/pages/shop/SellerHome.tsx`, component `ProductStats`:** `total` hiện cộng `Object.values(c)` — dính cả `archived` và `suspended` (RPC `product_status_counts` GROUP BY mọi status; lưu ý `suspended` có trong DB nhưng KHÔNG có trong TS union `ProductStatus` — đừng thêm nó vào union, đó là backlog riêng). Sửa: tính `total` từ đúng các nhóm 4 ô hiển thị: `approved + pending_review + needs_changes + rejected + draft` (tái dùng `needsFix` nếu tiện). Empty state vẫn theo `total === 0`. Hệ quả chấp nhận (ghi chú trong báo cáo, không cần sửa copy): shop chỉ còn hàng archived sẽ thấy "Chưa có sản phẩm nào" — chấp nhận được vì archived nghĩa là "đã cất đi".
>
> **2. F2 — cùng file:** nút/Link "Đăng sản phẩm đầu tiên" trong empty state chỉ render khi shop `state === "active"`; state khác giữ nguyên dòng "Chưa có sản phẩm nào" không nút. Truyền state từ `s.state` của caller vào `ProductStats` (thêm 1 prop là đủ). Không đổi bất kỳ copy VI sẵn có nào.
>
> **3. F6 — `src/pages/shop/SellerProducts.tsx`, component `Thumb`:** thêm `useEffect` phụ thuộc `src` reset `broken` về `false` khi `src` đổi — hết kẹt ImageOff vĩnh viễn sau khi seller thay ảnh. Giữ nguyên `onError`.
>
> **Test tối thiểu (cùng commit):**
> - `SellerHome.copy.test.tsx` (CHỈ THÊM, không sửa/xoá assert cũ): (a) counts chỉ có `{ archived: 3 }` (mock trả key thừa được vì hook type là Partial record — cast nếu cần) → vẫn hiện "Chưa có sản phẩm nào"; (b) `mount("pending_activation")` + counts rỗng → KHÔNG có link "Đăng sản phẩm đầu tiên"; assert cũ ở `mount("active")` (có nút) phải còn xanh nguyên trạng.
> - `SellerProducts.thumb.test.tsx`: 1 case — ảnh onError → ImageOff, rồi rerender với src mới → `<img>` hiện lại (broken đã reset).
>
> **Acceptance criteria:**
> - AC-R2-1. `npm run lint` 0 error · `npx tsc -b` exit 0.
> - AC-R2-2. `npm run test -- --coverage` toàn bộ pass, statements ≥83%.
> - AC-R2-3. `npm run build` exit 0 VÀ `node scripts/check-bundle-size.mjs` exit 0.
> - AC-R2-4. `git diff 09ee93af --name-only` CHỈ chứa: `SellerHome.tsx`, `SellerProducts.tsx`, `SellerHome.copy.test.tsx`, `SellerProducts.thumb.test.tsx`.
> - AC-R2-5. Diff `SellerHome.copy.test.tsx` không xoá/sửa assert sẵn có (dán diff vào báo cáo).
> - AC-R2-6. Đúng MỘT commit `fix(shop): round-2 review fixes`, không push (`git ls-remote origin feat/shop-ui-polish` rỗng).
> - Báo cáo cuối: diff stat + kết quả từng AC + sai lệch (nếu có).

## Test case delta cho `tester` vòng 2 (setup y hệt vòng 1, rút gọn)

- **TC-R2-1 (F2):** đăng nhập seller có shop `pending_activation` (fixture có; nếu không, UPDATE state qua SQL local) + 0 sản phẩm → `/seller`: thấy "Chưa có sản phẩm nào" KHÔNG có nút "Đăng sản phẩm đầu tiên", KHÔNG có hàng CTA.
- **TC-R2-2 (F1):** shop active, SQL local: UPDATE toàn bộ products của shop sang `archived` → `/seller`: hiện empty state "Chưa có sản phẩm nào" + nút (vì active), KHÔNG phải 4 ô toàn 0. (Xong khôi phục status cũ hoặc db reset.)
- **TC-R2-3 (regression dashboard):** shop active với products trạng thái trộn (fixture gốc) → `/seller`: 4 ô số đúng như TC-03 vòng 1, CTA row đủ 2 nút, bấm ô về `/seller/products`.
- **TC-R2-4 (F6, best-effort):** khó dựng onError→đổi-src thật trên UI — test đơn vị đã phủ; tester chỉ cần xác nhận `/seller/products` thumbnail vẫn như TC-01 (regression). Nếu không dựng được case broken: SKIP có lý do.
- **TC-R2-5:** console 0 error trong các TC trên.

Đạt vòng 2 khi: AC-R2-1…6 pass (tôi re-review diff) + TC-R2-1/2/3/5 pass (TC-R2-4 cho phép SKIP).

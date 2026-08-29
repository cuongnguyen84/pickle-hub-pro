## Round 1 — Bước A: Code review + test case

### Cách kiểm
Diff 21 sửa + 4 mới. SQL: trích body 5 RPC từ migration nguồn và migration mới, `diff -u` bằng máy — chỉ có hunk compare_at khác; header/chữ ký/SECURITY DEFINER/search_path giữ. Không migration nào sau nguồn ALTER lại. Codex review độc lập (brief 84 KB).

### Lỗi
| # | Vấn đề | Kết luận |
|---|---|---|
| B1 | `discountPct()` trả `0` khi floor ra 0 (1.999.999/2.000.000) → PDP hiện `-0%`, hint form `-0%`, VariantEditor `-0%`; card gate ≥1 nên không badge → PDP lệch card (AC5) | **Thật, sửa**: trả `null` khi < 1. SQL tuỳ chọn `NULLIF(...,0)` |
| B2 | `reconcileRows` (`variantMatrix.ts` ~155/175): bật ma trận cho sp đơn đang giảm → `compareAtVnd` luôn "" → full-row replace **xoá giá gốc âm thầm** | **Thật, sửa**: seed thêm `compareAtVnd`, `?? seed?.compareAtVnd` |
| B3 | Helper SQL coi "" là NULL thay vì raise | Bác — an toàn hơn cho trường tuỳ chọn |
| B4 | Test ProductCard dùng textContent | Nhẹ, `.tl-shop-sr` vào accessible name; khuyến nghị getByRole |
| B5 | `parseCompareAt().value` đổi input sai thành null | Bác — validate trước ở cả 2 đường |
| B6 | `.tl-pdp-price > span { nowrap }` áp cả span khoảng giá 22px → có thể tràn 320px | Rủi ro, tester/user nhìn |

Đã xác minh OK: `--shop-tap 44`, `.tl-crumb min-height`, aria-invalid style, header comment, pgTAP plan 90→95 / 73→75 đúng, fixture p2b hợp lệ.

### Verdict 16 AC
1-4 đạt (code; màu/vị trí/responsive chờ tester; AC4 thực tế "giảm -30%" chấp nhận) · **5 chưa đạt** (B1) · 6 đạt-chờ tester · 7 đạt · 8 đạt-chờ tester · 9 đạt · **10 đạt nhưng B2** · 11-12 đạt-chờ tester · 13-16 đạt.
**Verdict code review: CHƯA ĐẠT** (B1, B2 — sửa nhỏ).

### Test case cho tester (http://localhost:8081)
Giới hạn: không sp nào có compare_at trên public (migration chưa áp prod, DB local chết). [LOGIN] cần đăng nhập; [SAU MIGRATION] chỉ chạy được sau khi áp migration prod. Không login được → "skip: không login".

- **TC1** /shop khách: không "Quản lý shop", không `.tl-shop-crumbs`; card render; console không lỗi mới.
- **TC2** Card không suy diễn: không `.tl-pcard-off`/`.tl-shop-price-was`. Shop đóng cờ → skip.
- **TC3** PDP: disclaimer nguyên văn "Giá, giá gốc và tình trạng hàng do shop tự khai. ThePickleHub kiểm duyệt nội dung trước khi hiển thị."; giá như cũ, không `.tl-pdp-off`, không strike, buybar không strike.
- **TC4** Dropdown khách: không "Kênh người bán"/"Đơn mở shop".
- **TC5 [LOGIN]** Dropdown chủ shop: dưới "Giải đấu của tôi" link "Kênh người bán" href /seller, trước Creator/Admin; click đóng + tới /seller; EN "Seller hub".
- **TC6 [LOGIN]** /shop topline: `nav.tl-shop-crumbs[aria-label="Lối tắt người bán"]` link "Quản lý shop →" /seller, ≥44px.
- **TC7 [LOGIN]** /seller/products/new: Giá 1000000; ô `#p-compare` label "Giá gốc (₫) — không bắt buộc", inputmode numeric; rỗng → hint "Giá trước giảm…"; nhập 1000000 + Lưu nháp → alert "Giá gốc phải lớn hơn giá bán.", aria-invalid, activeElement=#p-compare, không tạo; `1.250.000` → "Chỉ nhập số, không dấu chấm."; `1250000` → hint "Người mua thấy: 1.250.000₫ gạch ngang · -20%" + trust hint; xoá Giá → "Nhập giá bán trước để tính % giảm."
- **TC8 [LOGIN + SAU MIGRATION]** Lưu thật → mở lại, VariantEditor ô Giá gốc = 1250000.
- **TC9 [LOGIN]** VariantEditor: cột "Giá gốc (₫)" sau "Giá (₫)", input aria-label "Giá gốc <combo>", placeholder "không giảm"; thấp hơn → đỏ + lỗi + Lưu disabled "Còn ô chưa hợp lệ"; lớn hơn → "Người mua thấy -N%"; bulk "Giá gốc" → tiêu đề "Đặt giá gốc cho N phiên bản cùng lúc" → áp/hoàn tác; ≥1 dòng → trust hint. **Đừng Lưu** trước migration.
- **TC10 [SAU MIGRATION]** card `.tl-pcard-off` "-20%" phải; sp đơn strike "1.250.000₫"; khoảng giá không strike; accessible name chứa "giảm -20%" và "giá gốc 1.250.000₫"; hết hàng+giảm → cả hai. PDP đơn: strike → giá → badge; buybar strike không badge; % = card. PDP ma trận: chưa chọn → badge max; chọn giảm → strike+badge; chọn không giảm → biến mất.

Không kiểm được Chrome MCP (viewport): ẩn strike <414/<360, không xuống dòng 320/375/414, B6.

### Đề xuất vòng 2
1. `discount.ts`: `discountPct` → null khi <1 (+test 1999999/2000000). Tuỳ chọn NULLIF trong search.
2. `variantMatrix.ts`: seed thêm `compareAtVnd`; `kept?.compareAtVnd ?? seed?.compareAtVnd ?? ""` (+test); SellerProductForm truyền seed.
3. ProductCard test getByRole.

# Round 4 — Code review (Bước A, prompt-engineer)

Diff: `51925550..b0234b11` (8 file, +146/−47, 1 commit — đã push, remote = `b0234b11`, PO xem preview không bị chặn). Reviewer độc lập: Codex CLI — 2 lần đầu treo vì prompt qua argv làm codex rơi vào chờ stdin ("Reading additional input from stdin…"); lần 3 đưa prompt qua stdin (`codex exec - < file`) chạy OK, exit 0 (2 finding + 7 mục sạch). Ghi nhận cho các vòng sau: **dùng dạng stdin cho prompt dài.**

## VERDICT: ĐẠT KỸ THUẬT — 0 defect chặn. 1 delta test-hardening 1 dòng gộp vòng sau. PO chấm thẩm mỹ trên preview như kế hoạch.

### Tự kiểm (trước Codex)

- **Herocard không rò sang `.tl-shop-hero` sell landing:** shop.css chỉ có 2 rule descendant `.tl-shop-hero` (:1604, :1606) — CSS class match nguyên token, không prefix-match, `.tl-shop-herocard` là token khác → độc lập bằng cấu trúc. Coder còn ghi comment lý do ngay trong CSS. PASS.
- **Token hex đúng công thức comment:** tôi tính tay từng kênh màu cả 5 hex tính sẵn — dark strong 16% green trên `#131416` → `#2d3620` ✓, weak 5% → `#1b1f19` ✓; light strong 12% trên `#eeebe1` → `#dbdcc9` ✓, weak 4% → `#e8e6d9` ✓; chip light fg 5% trên trắng → `#f3f3f3` ✓. Không hex ngoài token block. PASS.
- **SVG:** JSX camelCase hợp lệ, `aria-hidden="true"`, `pointer-events:none`, stroke currentColor 1 màu — đúng spec §2.4 (Codex xác nhận không cần `focusable=false` trên trình duyệt hiện đại). PASS.
- **4 chỉnh nhỏ đúng như duyệt:** (1) bỏ `aria-label` ProductCard + test đổi sang `getAllByRole("link", { name: /…/ })`; (2) cặp contrast `chip-ink/chip-bg` thêm, kéo theo chip-bg light → hex đúng dự liệu spec; (3) `--mono-accent` chết + import `monogramAccent`/`CSSProperties` + comment stale ShopMonogram — dọn đủ 3 chỗ; (4) câu sparse đổi đúng nguyên văn đã duyệt, test cập nhật khớp. PASS cả 4.
- **Test không nới coverage:** assertion sparse giữ nguyên văn mới, link vẫn assert đủ (1 link + href + name chứa title); chống xanh giả: tự chạy CatalogResults + contrast trong worktree → **88/88 pass** (66→+2 cặp contrast hero, tổng pairs mới đều đo). Copy giữ 100% (h1/sub/placeholder/nút không đổi ký tự nào — soát diff).
- Trạng thái input đúng spec §2.5: chỉ thêm hover border, có comment giải thích vì sao không có disabled/loading/error.

### Finding Codex + phán quyết

| # | Codex | Phán quyết |
|---|---|---|
| C1 | MAJOR — test link mới không red-proof: nếu ai thêm lại `aria-label={card.title}`, name vẫn match regex `/Giày Court Pro/` → regression không bị bắt; cũng chưa chứng minh name chứa giá/shop | **ĐỒNG Ý logic, HẠ MAJOR → MINOR** (lỗi ở lớp test-hardening, không phải production; hành vi runtime đúng). Delta 1 dòng vòng sau: thêm `expect(links[0].getAttribute("aria-label")).toBeNull()` (hoặc siết regex name có giá). Không chặn. |
| C2 | MINOR — `input:hover` có thể đè `border-color` của focus indicator | **BÁC bằng bằng chứng:** focus indicator toàn cục của khu shop là **outline** 2px `--tl-green` (shop.css:245 `:is(a,button,input,…):focus-visible { outline… }`), không phải border — hover chỉ đổi border, outline giữ nguyên khi hover+focus chồng nhau. Không suy yếu focus. |
| C3-C9 | SẠCH: SVG a11y đủ; overflow hidden chặn art âm không scroll ngang, art sau nội dung không che chữ 360-414px; pair contrast đặt trên tint-strong là phía bảo thủ đúng; 3 stop gradient không phải lỗi kỹ thuật; accessible name chứa "Hết hàng"/"Chưa có ảnh" là hữu ích cho SR; herocard/hero độc lập; không lỗi JSX/logic/touch/hex | Đồng ý — trùng tự kiểm. |

### Ghi chú tồn (không chặn)

1. **Delta C1** (1 dòng assert aria-label null) — gộp vào vòng chỉnh kế tiếp sau khi PO phán, không đáng 1 commit riêng lúc này.
2. **B01 fold 320 + screenshot 4 breakpoint × 2 mode** (spec §7.3-7.4): không có coder report kèm vòng này để đối chứng bằng chứng — giao tester kiểm trên preview đã push (cùng lượt PO xem); diff không chứa compensation margin h2 nghĩa là coder kết luận "không cần" — tester xác nhận card đầu còn ló fold 320×568.
3. Hero mobile ≤200px trần PO (spec §6): kiểm mắt trên preview, máy không đo được đáng tin.

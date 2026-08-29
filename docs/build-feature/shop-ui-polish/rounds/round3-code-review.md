# Round 3 — Code review (Bước A, prompt-engineer)

Diff: `3ca76cb7..51925550` (7 file, +265/−131, 1 commit). Reviewer độc lập: Codex CLI — lần 1 timeout 7', lần 2 chạy nền OK (10 mục: 1 MAJOR, 1 MINOR, 1 NIT, 7 SẠCH); tôi xác minh lại từng claim. Chống xanh giả: tự chạy CatalogResults + FilterSheet + contrast trong worktree → 87/87 pass (đã cẩn thận chạy đúng worktree, không phải repo gốc); diff stat khớp báo cáo; remote đang ở tip vòng 2 `3ca76cb7` (push trước đó cho PO preview — khớp brief), commit R3 local-only đúng như khai; test CatalogResults được cập nhật theo hướng SIẾT (assert "Còn hàng" vắng, câu sparse nguyên văn sau grid, private leak checks giữ) — không nới assertion để lách.

## VERDICT: ĐỦ AN TOÀN ĐỂ PUSH cho PO xem preview. 0 defect chặn. 4 mục delta không chặn, gộp vào vòng chỉnh sau khi PO phán (chắc chắn có).

### Khớp spec §1-§6

Soát từng hạng mục trên diff thật: §1 token 12 cái đúng 2 block, hex raw chỉ trong token block (light block có `#ffffff` + `rgb()` shadow — đúng tiền lệ `--shop-on-*`) · §2 card đúng anatomy (1 link, "→" là span aria-hidden, media 1:1 gỡ inline aspectRatio, skeleton cùng khung + foot sk) · §3 chip pill token, active đảo ink/bg, `.count` inherit (vá đúng lỗ count mờ trên nền đen) · §4 ShopStore đúng thứ tự DOM mới, mọi câu trung thực NGUYÊN VĂN xuống footer (grep xác nhận: câu xác minh đầy đủ, "do shop tự khai", NO_CONTACT_COPY khi 0 contacts), Liên hệ chỉ render khi có contacts · §5 grid 2 cột từ 320 + price 14.5px <360px + sparse sau grid · §6 ShopHome bỏ heading (a11y giữ — `CategoryChips` có sẵn `role="group" aria-label="Ngành hàng"`, tôi verify), h2 17px toàn cục, PDP chỉ radius/seller-card + bù background cho `.tl-pdp-media .tl-pcard-noimg` (coder tự bắt đúng hệ quả của việc bỏ background khỏi noimg — điểm cộng).

### Phân xử 4 điểm coder xin xác nhận

1. **`.tl-shop-cat` dùng chung lan sang seller/admin — CHẤP NHẬN, không fork.** Cả 5 nơi dùng (`SellerProducts` + 3 trang admin + `CategoryChips`) đều cùng pattern `aria-current="page"` (tôi grep xác nhận) → nhận style mới đồng nhất, AA qua cặp token ink↔bg có assertion, min-height 44 giữ nguyên, border transparent vẫn chiếm 1px nên không layout shift (Codex xác nhận). Fork class chỉ khi có tác hại thật — ở đây là consistency miễn phí.
2. **`.tl-shop-h2` 17px/700 toàn cục — CHẤP NHẬN.** Spec ghi chữ "toàn cục"; thuần đổi cỡ/đậm, không đổi cơ chế layout; Codex soát không thấy chỗ vỡ. Seller/admin hưởng cùng nhịp heading.
3. **Bỏ tuỳ chọn tap-chip-bỏ-lọc — CHẤP NHẬN.** Tôi verify: `CategoryChips` chỉ được render ở ShopHome + ShopSearch, `ShopCategory` KHÔNG render — spec ghi tuỳ chọn cho ShopCategory là misfire của spec; làm sẽ là code cho chỗ không tồn tại. Đúng ponytail.
4. **Dấu "— " mở đầu câu sparse đứng riêng sau grid — CHẤP NHẬN CHO VÒNG NÀY.** "Nguyên văn" là yêu cầu cứng của spec, coder giữ đúng luật. Dấu gạch mở đầu giờ hơi mồ côi — đây là quyết định copy 1-từ của PO: nếu PO thấy lạ trên preview, xoá "— " là 1 dòng (kèm sửa 1 assert). Ghi vào danh sách hỏi PO, không tự quyết.

### Finding Codex + phán quyết

| # | Codex | Phán quyết |
|---|---|---|
| C1 | MAJOR — `aria-label={card.title}` ghi đè accessible name cả link: SR không nghe giá/"Hết hàng"/shop | **HẠ → DELTA SAU PREVIEW, không chặn push.** Tôi verify `git show 3ca76cb7`: aria-label có từ P2b — pre-existing, R3 không tạo regression (trước R3 label cũng đã override availability text). Fix đúng = bỏ aria-label để inner text làm name (1 dòng; test chỉ dùng `getAllByRole("link")` không bám name — không vỡ). Gộp vòng chỉnh tới. |
| C2 | MINOR — thiếu assertion contrast cặp chip thường `--shop-chip-ink`/`--shop-chip-bg`; cặp `--shop-verified`/card không khớp icon thật (`.tl-pcard-verified` dùng `--tl-green`) | **ĐỒNG Ý NỬA ĐẦU** — thêm 1 dòng cặp chip thường vào vòng tới. **BÁC nửa sau**: icon verified là trang trí `aria-hidden` kèm sr-text chữ — không thuộc phạm vi AA text; cặp `--shop-verified`/card vẫn đúng cho pill "Đã xác minh" (pill dùng `--shop-verified` thật, shop.css:300). |
| C3 | NIT — `--mono-accent` trên header có thể chưa chết | **XÁC NHẬN LÀ CHẾT** (banner gradient — consumer duy nhất ở cấp header — đã xoá; monogram con tự set inline). Dọn 1 dòng khi tiện, không chặn. |
| C4-C10 | SẠCH: HTML hợp lệ, CSS card/foot/ellipsis đúng chỗ `min-width:0`, chips không shift, ShopStore đúng điều kiện + nguyên văn, skeleton OK, h2/empty-radius không vỡ seller/admin, không lỗi logic khác | Đồng ý — trùng kết quả tự soát của tôi. |

### Rủi ro regression (mục 3 của đề bài) — đã soát, sạch

- **ProductCard consumer:** duy nhất `CatalogResults` import (grep) — SellerProducts có `ProductCard` local riêng không liên quan. PDP dùng ké class `.tl-pcard-noimg` → đã được bù style riêng trong diff.
- **Test bám ShopStore:** grep toàn bộ `*.test.*` — không test nào bám "Sản phẩm của shop"/vị trí deflist/NO_CONTACT_COPY-giữa-trang (chỉ `contactCta.test.ts` assert nội dung chuỗi NO_CONTACT_COPY, không vị trí — vẫn xanh).
- **CSS đè fix cũ:** các block R1/R2 cuối file không bị viết lại; `.tl-pcard-noimg` giờ ghép 2 rule (R3 khung + R1 grid/icon/chữ) — thứ tự file cho kết quả đúng; fix chip-count `.count` được NÂNG thêm nhánh active chứ không thay; touch 44 (`--shop-tap`) giữ ở chip lẫn card.

### Danh sách delta KHÔNG chặn push (gom cho vòng chỉnh sau khi PO xem preview)

1. Bỏ `aria-label` trên Link ProductCard (C1, 1 dòng).
2. Thêm cặp contrast `--shop-chip-ink`/`--shop-chip-bg` (C2, 1 dòng).
3. Dọn `--mono-accent` chết trên header ShopStore (C3, 1 dòng).
4. Hỏi PO: có bỏ "— " mở đầu câu sparse không (quyết định copy).

Sau push: tester chạy regression console/DOM trên preview (thẩm mỹ PO chấm); 4 dòng checklist §8 coder treo (kiểm mắt 320-768, B01 fold, dark mode bằng mắt, force states) giao tester cùng lượt.

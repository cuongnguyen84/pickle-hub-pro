# Vòng 4 — Báo cáo coder (hero ShopHome + 4 chỉnh nhỏ)

Commit `b0234b11` (8 file, +146/−47), chưa push lúc báo cáo (đã push sau review).

- Hero `/shop`: section `.tl-shop-herocard` bọc h1+sub+search, SVG vợt+bóng inline aria-hidden, chữ giữ 100%; token tint hex tính sẵn kèm comment công thức (dark #2d3620/#1b1f19, light #dbdcc9/#e8e6d9); nút Tìm radius 999 trong hero; input hover border-2; bỏ inline style sub.
- 4 chỉnh nhỏ: bỏ aria-label ProductCard (+ test accessible-name); cặp contrast chip (+ chip-bg light → hex #f3f3f3); dọn --mono-accent chết + comment stale; câu sparse chuyển gạch vào giữa.

AC: lint 0 error · tsc 0 · vitest 185 files / 2757 pass, statements 83.12% · build + bundle exit 0 (headroom 9.7 KB có sẵn) · contrast 4 cặp mới đo số: 11.41/14.32 (hero-ink), 7.20/8.32 (sub), 9.72/10.44 (chip) · grep `.tl-shop-hero ` xác nhận độc lập sell landing · 0 raw hex ngoài token block.

Chuyển tester/PO: fold B01 320×568, screenshot 4 breakpoint × 2 mode, vi chỉnh toạ độ SVG nếu lệch mắt. Chưa áp giảm margin h2 22→16 (spec dặn đo trước).

## Review Bước A (round4-code-review.md): ĐẠT KỸ THUẬT — 0 defect chặn
- Herocard độc lập hoàn toàn `.tl-shop-hero`; 5 hex đúng công thức (tính tay từng kênh); SVG hợp lệ; test 88/88, assertion không nới.
- Codex: C1 hạ MAJOR→MINOR (test thiếu red-proof aria-label null — test-hardening 1 dòng, gộp vòng chỉnh sau); C2 bác có bằng chứng (focus = outline, hover chỉ đổi border).
- Gotcha ghi sổ: Codex CLI treo khi prompt dài qua argv (chờ stdin) — dùng `codex exec - < file`.

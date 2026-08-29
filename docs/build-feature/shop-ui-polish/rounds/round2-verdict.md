# Round 2 — Verdict cuối (Bước A+B gộp, prompt-engineer)

## VERDICT: ĐẠT — đóng vòng lặp sau 2 vòng coder (2/6).

### Review delta (commit `3ca76cb7`, 4 file, +71/−8)

Tự đối chiếu diff `09ee93af..HEAD` với verdict vòng 1: F1/F2/F6 đúng từng yêu cầu — total tính từ đúng 4 nhóm hiển thị (needsFix gộp 1 lần, không double-count), nút gate `shopState === "active"` qua 1 prop, `useEffect(() => setBroken(false), [src])` (useEffect đã import sẵn). Copy VI không đổi; test chỉ APPEND; AC-R2 6/6 khớp bằng chứng: tôi tự chạy lại 2 file test → 23/23 pass, `git ls-remote origin feat/shop-ui-polish` rỗng, diff đúng 4 file. Không xanh giả.

Codex review độc lập (chạy OK khi cấm thám hiểm repo): **"Không thấy lỗi chức năng trong ba bản sửa"**, xác nhận red-proof cả 3 test mới (revert từng fix → test fail), không tác dụng phụ lên loading/error/stats-đầy-đủ. 1 finding mức thấp — test F2 thiếu nhánh dương (active vẫn hiện nút) — **BÁC**: nhánh dương đã được test vòng 1 cover ("stats empty" mount `active` assert link "Đăng sản phẩm đầu tiên" tồn tại); Codex không thấy vì chỉ được xem delta. Ghi nhận NIT của Codex: F6 có 1 render trung gian ImageOff trước khi ảnh mới hiện — vô hại.

### Quyết định về 5 TC delta tester: MIỄN vòng tester browser

Lý do (ponytail — không kiểm lại pixel đã kiểm):
1. F1/F2 là logic render có điều kiện trên ĐÚNG component tester đã PASS trên browser thật vòng 1 (TC-03: stats grid, CTA row, màu danger, điều hướng — tất cả đã thấy tận mắt). Delta không thêm CSS/route/query/markup mới nào ngoài việc ẨN 1 nút và đổi công thức 1 con số.
2. Hai data shape cần dựng (shop toàn-archived, shop pending_activation 0 sản phẩm) đòi SQL surgery trên local DB chỉ để xác nhận điều unit test mới đã assert chính xác bằng mock cùng shape — và Codex đã xác nhận red-proof.
3. F6 gần như không dựng được trên browser (cần ép 404 rồi thay ảnh cùng phiên); unit test rerender-src-mới cover trọn.
Rủi ro còn lại thuần thị giác đã được vòng 1 phủ; browser round sẽ là chi phí không mua thêm thông tin.

### (a) Nợ / backlog tồn sau vòng

1. **SELLER-SUSPENDED-LABEL** (bug có sẵn từ P2b, không do feature này): seller UI chưa học status `suspended` — pill rỗng, không chip lọc. Cần PO chốt chữ ("Đã gỡ"?) trước khi sửa (union + 3 map Record + chip).
2. **Zalo URL chờ PO duyệt**: khối liên hệ ở Status đang text thuần; ứng viên `https://zalo.me/2932845421782592643` (OA sẵn có trong ChatFAB/FollowOaBanner, có `VITE_ZALO_OA_URL`). Duyệt xong → thêm nút là 1 dòng.
3. **Visual baseline capture**: `tests/visual.spec.ts` đã thêm `/shop` + `/shop/sell` (file-only) — cần workflow_dispatch chụp baseline SAU khi push/merge.
4. **Monogram 22px PDP storecard**: tuỳ chọn spec §9, chưa làm — làm khi có nhu cầu thật.
5. **Bundle headroom còn 9.9 KB gz** (Total 1960.1/1970) — gate cảnh báo <5%; feature JS tiếp theo trên vùng initial sẽ phải trả nợ này trước.

### (b) Checklist Cuong tự kiểm

1. **iPhone thật** (TC-11 không chạy được bằng máy — Chrome MCP không resize): đi qua `/shop`, `/shop/sell`, `/shop/store/<slug>`, `/seller`, `/seller/products` ở 390px thật — soát scroll ngang, CTA xếp dọc, stats 2 cột, fold 320px card đầu ShopHome còn lộ (B01).
2. **Duyệt Zalo URL** `https://zalo.me/2932845421782592643` cho khối liên hệ Status (backlog #2).
3. Cảm quan thị giác light mode 2 màn mới polish (banner ShopStore + FAQ SellLanding) — máy chỉ đo được contrast token, không đo được "đẹp".
4. Fixture QA về sau nên seed ảnh có pixel thật (phát hiện #1 của tester: WebP 26-byte render trong suốt).

### Trạng thái bàn giao

Branch `feat/shop-ui-polish` trong worktree, 8 commit trên base `65703e41`, CHƯA push (đúng luật vòng). Diff tổng: 21 file, ~+958/−142. Toàn bộ gate local xanh (lint/tsc/vitest ≥83%/build/bundle/contrast). Sẵn sàng cho bước push + PR khi Cuong ra lệnh.

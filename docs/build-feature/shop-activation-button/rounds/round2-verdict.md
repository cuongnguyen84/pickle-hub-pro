# Vòng 2 — Verdict cuối (Bước B, prompt-engineer)

## 1. Verdict: **ĐẠT** — dừng vòng lặp sau 2 vòng

Cả hai điều kiện của Bước B thoả:

- **Code review Bước A: ĐẠT** (Codex PASS 0 finding + tôi xác minh độc lập trên diff thật — xem `round2-code-review.md`). Diff số học khớp: 9 file, +264/−31, 5 file untracked vòng 1 giữ nguyên, không migration mới (tôi chạy lại `git diff --stat` trong worktree lúc chốt verdict, vẫn đúng).
- **Tester: 4/4 PASS · 0 fail · 0 skip** (xem `round2-test-report.md`), console 0 error app.

**Blocker vòng 1 đã đóng bằng quan sát thật, không phải suy luận:** TC-R2-1 xác nhận trang công khai `/shop/store/<slug>` sau kích hoạt "Gặp trực tiếp" hiện đúng nguyên văn *"ThePickleHub đã xác minh shop này — đối chiếu giấy tờ hoặc gặp trực tiếp người bán."*, KHÔNG còn chữ "đã xem giấy tờ" ở bất kỳ đâu; nhánh chưa-verified (shop đối chứng) cũng đúng nguyên văn *"Shop chưa được ThePickleHub xác minh."*. TC-R2-2 xác nhận nút "Huỷ" thay "Cancel" và bấm Huỷ không gọi RPC. TC4-nhanh xác nhận flow kích hoạt vòng 1 không bị hồi quy.

Không có bất đồng nào giữa Codex, tester và tôi ở vòng này.

## 2. Nợ MINOR ghi nhận qua 2 vòng — phân loại

### Đáng làm TRƯỚC khi merge (rẻ, đúng lúc còn nóng)

1. **pgTAP thiếu case `restricted`** — `shop_activate.test.sql` chưa có case gọi RPC với trạng thái/role không hợp lệ nhánh restricted. Đây là test bảo vệ guard của một RPC ghi trạng thái công khai; thêm 1 case pgTAP là rẻ nhất bây giờ, khi fixture và ngữ cảnh còn nóng. Không sửa RPC — chỉ thêm test. (Bài học repo: "test bảo vệ HÀM chứ không bảo vệ CHỖ NỐI" — case này chốt đúng hành vi từ chối.)
2. **Doc test ghi route `/auth` nhưng route thật là `/login`** — tester vòng 2 vấp (404). Sửa 1 dòng trong setup doc của vòng 1 để vòng test/tester sau không vấp lại. Chi phí gần 0.

### Ghi nợ, KHÔNG chặn merge

3. **Replay chưa snapshot `verified_at`** — edge nhỏ, cần quyết định semantics (replay có nên giữ mốc xác minh cũ không) trước khi code; không ảnh hưởng flow kích hoạt hiện tại. Làm khi đụng tới tính năng replay.
4. **Bundle headroom còn 13.6 KB** — chỉ là mức đệm còn lại, gate thật (`check-bundle-size.mjs`) sẽ tự đỏ nếu vượt. Theo dõi, không hành động trước.
5. **Responsive 320px chỉ best-effort ở 500px** — Chrome MCP không ép được viewport (đã ghi nhận cả 2 vòng, viewport thực 1229px); máy không kết luận được. Chuyển thành việc kiểm tay của user (mục 3), không phải nợ code.

## 3. Checklist việc còn lại cho user trước khi merge/deploy

- [ ] **Review diff** trong worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-activation-button` (9 file sửa +264/−31, 5 file mới gồm migration `20260816090000_shop_activate_rpc.sql` + `shop_activate.test.sql` + 3 test client) trước khi mở PR.
- [ ] **Test tay trên iPhone thật (viewport ~320-390px)**: màn admin review + section "Kích hoạt shop" + dialog xác nhận + trang shop công khai — tester không ép được viewport nên responsive hẹp chưa có ai nhìn thật.
- [ ] **Quyết định thời điểm bấm nút kích hoạt THẬT trên production theo gate PO** — theo quyết định pilot hiện hành, Wave 1 + indexing đang CẤM chờ PO; merge code nút kích hoạt không đồng nghĩa được phép kích hoạt shop thật. Migration sẽ cần áp prod khi merge (lưu ý ledger drift đang có — không chèn ledger mù).
- [ ] (Tuỳ chọn, khuyến nghị) Cho coder làm 2 món "trước merge" ở mục 2 trong cùng PR: pgTAP case `restricted` + sửa doc `/auth`→`/login`.

## 4. Tóm tắt 2 vòng

- Vòng 1: coder viết feature (5 file sửa + 5 file mới, +256/−24) → review ĐẠT → test 8/9 pass nhưng phát hiện blocker copy "đã xem giấy tờ" thành claim dối khi activate gap-truc-tiep → CHƯA ĐẠT.
- Vòng 2: coder sửa 5 file (4 file copy +7/−7, 1 dòng `cancelText`) → code review: ĐẠT (0 finding) → test: 4/4 pass → **ĐẠT**.

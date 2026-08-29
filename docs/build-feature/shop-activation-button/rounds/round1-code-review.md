# Vòng 1 — Code review (Bước A, prompt-engineer + Codex CLI)

# PHẦN 1 — VERDICT CODE REVIEW

## Quy trình

- Codex CLI chạy thành công (`codex exec --skip-git-repo-check`, bundle 53KB gồm toàn bộ diff + 5 file mới + signature `log_audit_event` tham chiếu). **Codex không chỉ đọc — nó tự chạy lại** `vitest` trên 3 file test mới (18/18 pass) và `npx tsc --noEmit` (pass) trong worktree, độc lập với báo cáo coder.
- Prompt-engineer tự xác minh diff thật bằng `git diff` + đọc file, không tin suông báo cáo.

## Finding của Codex (2, đều MINOR, không chặn)

1. **[MINOR]** `supabase/tests/shop_activate.test.sql` — pgTAP chỉ phủ state cấm `suspended` + `closed`, thiếu `restricted`. Xác nhận đúng về độ phủ nhưng KHÔNG vi phạm spec (prompt chỉ đòi suspended + ≥1 state khác). Logic RPC dùng điều kiện tổng quát nên `restricted` xử lý đúng. Ghi nợ nice-to-have.
2. **[MINOR]** pgTAP idempotent-replay không snapshot/so sánh `verified_at` trước–sau replay. Hành vi RPC đúng (RETURN trước UPDATE ở nhánh active), chỉ là test chưa khoá trọn contract. Không chặn.

Codex kết luận: **"No blocking findings"**; xác nhận call `log_audit_event` 7 đối số cast tường minh → không dính 42725.

## Xác minh riêng của prompt-engineer (ngoài Codex) — đều PASS

- Diff stat khớp báo cáo (5 file sửa, +256/−24; 5 file untracked đúng danh sách).
- Section đặt đúng vị trí: sau "Người nộp" (`a03-snap`), trước `SellerRulesReceiptPanel`/ghi chú.
- `shopRpc`/`shopFrom` tồn tại thật; `Link` đã import sẵn trong `SellerHome.tsx`; các class `tl-shop-*` đều có trong `shop.css`; `useConfirm` nhận đúng props và render description `whiteSpace: pre-line` — mọi API coder dùng đều có thật.
- pgTAP `plan(22)` khớp 22 assert đếm tay; impersonation đúng pattern.
- Migration đúng pattern chuẩn: SECURITY DEFINER + `SET search_path = public` + `admin_required` đầu hàm + `FOR UPDATE` + REVOKE/GRANT đúng.
- Test vitest xuyên call site thật: assert `shopRpc("shop_activate", {_shop_id, _verified_method})` đúng tên tham số; confirm huỷ → 0 call RPC assert thật. Mock `useConfirm` module-level chấp nhận được.
- Card "Bước tiếp theo" SellerHome hiện đúng sự thật — coder không sửa là đúng spec.
- 3 điểm xác minh bắt buộc khớp code thật.

## Đối chiếu báo cáo coder — không phát hiện "xanh giả"

Vitest + typecheck được Codex chạy lại độc lập → khớp. Chưa chạy lại độc lập: pgTAP full suite, lint, build/bundle (tester sẽ `db reset` lại ở setup, tự re-prove migration replay). Sai lệch coder tự khai (SellerShopSettings dedup, VERIFIED_METHOD_LABEL) — chấp nhận.

## Cảnh báo không chặn

- **Bundle headroom còn 13.6 KB** (baseline main đã chỉ còn 15.5 KB — không phải lỗi vòng này). Đưa vào báo cáo tổng kết cho Cuong: budget Total sắp cạn từ trước feature này.

## Kết luận tạm (chưa tính test browser): **Code review ĐẠT** — 0 finding chặn.

---

# PHẦN 2 — TEST CASE CHO `tester` (Chrome MCP)

## Setup (đúng thứ tự, trong worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-activation-button`)

```sh
cd /Users/cm10/pickle-hub-pro/.claude/worktrees/shop-activation-button

# 1. DB local sạch, replay đủ migration (kể cả 20260816090000 mới)
npx supabase db reset --local          # exit 0 bắt buộc; fail = báo ngay, dừng

# 2. Env cho dev server trỏ về Supabase LOCAL (worktree chưa có .env)
cat > .env.local <<'EOF'
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PROJECT_ID=ajvlcamxemgbxduhiqrl
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
EOF
# (demo anon key chuẩn của Supabase CLI local — key baked-in ở scripts/qa/seller-qa-kit.mjs)

# 3. Seed fixture — in ra danh sách tài khoản + mật khẩu chung
node scripts/shop-p2b-fixture.mjs up
# GHI LẠI từ output: email "Admin CHƯA bật 2FA" (adminAal1…), email "Người nộp hồ sơ" (applicant…), mật khẩu chung.
# Fixture tạo sẵn 1 hồ sơ submitted của applicant — TC1 sẽ approve nó qua UI.

# 4. Dev server
npm run dev    # port 8080, background
```

Đăng nhập: `http://localhost:8080/auth`. Dùng tài khoản **Admin CHƯA bật 2FA** cho case admin. Nếu Chrome không tới được localhost:8080: `npm run dev -- --host` + IP LAN.

Dọn sau khi xong: `node scripts/shop-p2b-fixture.mjs down`, xoá `.env.local`, tắt dev server.

## Test case

**TC1 — Approve tạo shop + section xuất hiện đúng chỗ.**
Đăng nhập admin → `/admin/shop/applications` → mở hồ sơ "Người nộp hồ sơ" (Đã nộp) → chọn Duyệt — trước khi gửi, đọc dòng hệ quả: phải là *"Shop được tạo ở trạng thái chờ kích hoạt… mục "Kích hoạt shop" xuất hiện ngay trên trang này để đưa shop lên công khai."* → Gửi.
**Kỳ vọng:** quyết định thành công; trên cùng trang (F5 nếu cần) xuất hiện section **"Kích hoạt shop"** GIỮA "Người nộp" và ghi chú/biên nhận; "Trạng thái shop: Chờ kích hoạt"; dòng "Trang shop" là TEXT TRƠN `/shop/store/<slug> (sẽ mở khi kích hoạt)` — KHÔNG phải link; notice vàng "Sau khi bấm: shop hiện công khai trên /shop ngay lập tức…"; select "Phương thức xác minh (tuỳ chọn)" mặc định "Gặp trực tiếp", 3 lựa chọn; nút "Kích hoạt shop". **GHI LẠI `<slug>`.**

**TC2 — SellerHome copy khi CHƯA kích hoạt (TRƯỚC TC3).**
Đăng nhập applicant → `/seller`.
**Kỳ vọng:** notice vàng **"Shop đã mở nhưng chưa hoạt động."** + "Quản trị viên sẽ kích hoạt sau khi xác minh với anh/chị — khi shop lên công khai, chúng tôi báo trực tiếp qua Zalo."; KHÔNG còn câu "Chức năng đăng sản phẩm sẽ bật ở giai đoạn tiếp theo"; "Trạng thái: Chờ kích hoạt".

**TC3 — Confirm dialog + Huỷ không làm gì.**
Trang admin review → bấm "Kích hoạt shop".
**Kỳ vọng:** dialog title `Kích hoạt shop "<tên shop>"?`, 3 dòng riêng biệt (công khai ngay / "Phương thức xác minh sẽ ghi: Gặp trực tiếp." / tự báo seller qua Zalo), nút "Kích hoạt". → **Huỷ** → dialog đóng, section GIỮ "Chờ kích hoạt" (F5 vẫn vậy — không RPC nào chạy).

**TC4 — Kích hoạt thành công → section đổi trạng thái.**
Bấm "Kích hoạt shop" → **Kích hoạt**.
**Kỳ vọng:** không lỗi; section tự đổi KHÔNG cần F5: notice info **"Đã kích hoạt."** + link "Xem trang shop (mở tab mới)" + "Nhớ báo seller qua Zalo — hệ thống không gửi thông báo tự động."; nút BIẾN MẤT (không phải disabled); "Trạng thái shop: Đang hoạt động" + "Xác minh: Gặp trực tiếp"; "Trang shop" giờ là LINK.

**TC5 — Shop công khai với người CHƯA đăng nhập.**
Tab ẩn danh → `/shop/store/<slug>`.
**Kỳ vọng:** render tên shop thật (danh sách sản phẩm rỗng là ĐÚNG, miễn không phải "không tìm thấy"). Kiểm thêm `/shop`: không lỗi.

**TC6 — F5 idempotent (UI).**
Tab admin F5 trang review. **Kỳ vọng:** y hệt trạng thái "Đã kích hoạt" TC4 — không nút, không lỗi, không nháy về pending.

**TC7 — SellerHome copy khi ĐÃ kích hoạt.**
Tab seller F5 `/seller`.
**Kỳ vọng:** notice **"Shop đang hoạt động"** + link "trang shop của anh/chị (mở tab mới)" trỏ `/shop/store/<slug>` + "đăng sản phẩm đầu tiên" là LINK trỏ `/seller/products/new` (bấm thử: mở form, không 404); "Trạng thái: Đang hoạt động".

**TC8 — Responsive 320px (mục coder khai CHƯA kiểm).**
Trang admin review (Đã kích hoạt) viewport 320px, rồi 375/768.
**Kỳ vọng:** không scrollbar ngang; path/link `/shop/store/<slug>` wrap được. Ghi nhận best-effort (bài học: Chrome MCP resize không kết luận tuyệt đối), chụp screenshot 320px.

**TC9 — Section KHÔNG hiện trên hồ sơ chưa duyệt.**
Mở hồ sơ khác chưa approve (nếu không còn → SKIP-ghi-lý-do).
**Kỳ vọng:** không có heading "Kích hoạt shop" trên trang.

## SKIP có chủ đích (không cần thử)

- Nhánh lỗi mutation UI (admin_required / shop_not_activatable / mạng): không tạo được điều kiện sạch local — đã phủ vitest + pgTAP.
- Nhánh lỗi query shop-state + Thử lại: cần cắt mạng — đã phủ vitest.
- Race 2 tab admin: idempotent đã chứng minh pgTAP; browser không tái lập đáng tin.
- Admin aal2/TOTP: luồng enroll tốn công, không thuộc diff này — is_admin() đã phủ pgTAP.

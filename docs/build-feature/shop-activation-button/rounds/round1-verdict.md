# Vòng 1 — Verdict (Bước B, prompt-engineer)

## 1. Verdict: **CHƯA ĐẠT**

Lý do: code review Bước A đạt (0 finding chặn) và tester 8/9 pass · 0 fail, NHƯNG observation 1 của tester là **blocker**:

- Sau khi kích hoạt với method `gap-truc-tiep`, trang công khai `/shop/store/<slug>` hiện *"ThePickleHub đã xem giấy tờ kinh doanh của shop này."* + sr-text "đã được xác minh giấy tờ" — **sai sự thật với người mua** (admin không hề xem giấy tờ). Copy có từ trước, nhưng chính feature này mở nhánh gap-truc-tiep biến nó thành claim dối trên trang công khai → thuộc scope vòng này. Đúng loại lỗi "nói quá về xác minh" mà nguyên tắc pilot cấm.
- Codex CLI (độc lập) đồng thuận: **blocker yes, chọn phương án A** (đổi copy trung thực chung cho mọi method, 0 migration). Tôi xác minh code thật: đúng 4 file copy dính, và prototype `src/proto/shop/screens/B01Home.tsx:89` đã có sẵn wording chuẩn được duyệt: *"Đã đối chiếu giấy tờ hoặc gặp trực tiếp người bán."* — dùng lại wording này, không cần expose `verified_method` qua RPC public (phương án B để dành khi cần minh bạch chi tiết hơn).
- Gộp luôn observation 2 (nút "Cancel" tiếng Anh — root cause: `useConfirm` default theo `language`, admin đang ở EN nhưng dialog hardcode tiếng Việt → truyền `cancelText` tường minh, 1 dòng).
- Observation 3 (fixture residue local) không phải lỗi code — không đưa vào vòng 2.

Quyết định phương án: **A — copy trung thực chung, 0 migration.** Không treo lựa chọn.

## 2. Prompt sửa lỗi cho coder vòng 2

---

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

---

## 3. Test case bổ sung cho tester vòng 2 (chỉ delta, sau khi coder xong)

- **TC-R2-1:** Setup như vòng 1, activate với "Gặp trực tiếp" → tab ẩn danh `/shop/store/<slug>`: dòng xác minh phải là "ThePickleHub đã xác minh shop này — đối chiếu giấy tờ hoặc gặp trực tiếp người bán." và KHÔNG còn chữ "đã xem giấy tờ". Kiểm cả `/shop` (ProductCard) không claim giấy tờ.
- **TC-R2-2:** Dialog kích hoạt: nút huỷ label "Huỷ" (không còn "Cancel"); Huỷ vẫn đóng dialog không RPC.
- Không cần chạy lại TC1-TC9 trừ TC4 lướt nhanh (kích hoạt vẫn thành công) — diff chỉ chạm copy + 1 prop dialog.

## Tóm tắt vòng 1

vòng 1: coder sửa 5 file (+256/−24) + 5 file mới → code review: ĐẠT, 2 MINOR ghi nợ (pgTAP thiếu case `restricted`, replay chưa snapshot `verified_at`) → test: 8/9 pass, 0 fail, 1 skip có bù gián tiếp → verdict: **CHƯA ĐẠT** — observation 1 (copy "đã xem giấy tờ" thành claim dối khi activate gap-truc-tiep) là blocker; sang vòng 2 với fix copy trung thực (phương án A, 0 migration) + cancelText "Huỷ".

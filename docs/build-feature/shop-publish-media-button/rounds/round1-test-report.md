# Vòng 1 — Báo cáo tester (Chrome MCP)

**Kết quả: 0/8 pass — 8/8 KHÔNG CHẠY ĐƯỢC (BLOCKED), 0 FAIL thực chất.** Hai chặn độc lập, cả hai nằm **ngoài** code của coder. Không bịa kết quả, không bấm nút nào ghi dữ liệu lên production.

| # | Case | Kết quả | Ghi chú |
|---|------|---------|---------|
| TC-00 | Mở `/seller/settings`, mở khối "Logo & ảnh bìa" | ⛔ BLOCKED | Route gated `RequireAuth` → redirect `/login?redirect=%2Fseller%2Fsettings`. Không có session seller/PO |
| TC-01 | 502 · `rendition_metadata_present` | ⛔ BLOCKED | Chặn A (login) **và** chặn B (không chạy được JS stub) |
| TC-02 | 403 câu tiếng Việt của server | ⛔ BLOCKED | như trên |
| TC-03 | 403 tiếng Anh không rò dòng chính | ⛔ BLOCKED | như trên |
| TC-04 | S4 pending + timeout 20s | ⛔ BLOCKED | như trên |
| TC-05 | 200 không hiện lỗi | ⛔ BLOCKED | như trên |
| TC-06 | S3 `pending_activation`, không nút | ⛔ BLOCKED | cần stub `/rest/v1/shops` → chặn B |
| TC-07 | S3 `suspended` → "Tạm ngưng" | ⛔ BLOCKED | như trên |
| TC-08 | Focus ring + nhích 1px | ⛔ BLOCKED | cần trạng thái có nút (chặn A) |

Nhánh JPEG / `stripJpegMetadata`: **N/A — unit test phủ** (đúng như review dặn).

## Chặn A — không đăng nhập được
- `/seller/settings` chuyển hướng đúng sang `/login?redirect=%2Fseller%2Fsettings` (hành vi duy nhất quan sát được thật, và nó đúng).
- Chrome autofill có sẵn `p2b7-admin1-msvdvumv@thepicklehub.test` — tester **không bấm đăng nhập**: quy tắc an toàn cấm nhập/submit mật khẩu, và đây là tài khoản admin rác từ phiên P2b cũ, sai trạng thái dữ liệu mà TC-00 cần.
- ⇒ Cần Cuong tự đăng nhập bằng tài khoản seller/PO ở `http://localhost:8080/login` rồi để tester chạy tiếp trên tab đó.

## Chặn B — không ghi đè được `window.fetch` bằng Chrome MCP
Bộ test case giả định "dán snippet vào console" — bộ tool của tester **không có tool chạy JavaScript**. Ba đường đã thử, đều không đi được:
1. Tool hiện có (`navigate`, `computer`, `read_page`, `find`, `get_page_text`, `read_console_messages`, `form_input`, `resize_window`) — không có `evaluate`/`execute_script`.
2. `navigate` tới `javascript:void(...)` → `Can't interact with browser-internal or unparseable URLs.`
3. CDP: `curl http://127.0.0.1:9222/json/version` → không có endpoint (Chrome không mở remote debugging).

⇒ TC-01…TC-07 **không ép được nhánh lỗi bằng Chrome MCP** dù có login. Vòng sau phải đổi phương pháp: Cuong tự dán snippet vào DevTools rồi tester chỉ bấm + đọc DOM · **hoặc** thêm cách ép lỗi không cần eval (query param dev-only) · **hoặc** chuyển các case này sang Playwright `page.route` / test component.

## Phát hiện phụ (thật, ảnh hưởng mọi phiên test sau)
**Worktree thiếu `.env`** — chỉ có `.env.example`. Hậu quả: dev server lên 200 nhưng app **treo vĩnh viễn ở shell "Loading…"** trên mọi route (React không mount, console trắng, không lỗi đỏ nào để lần ra). Rất dễ chẩn đoán nhầm thành lỗi của diff.
Tester đã `cp /Users/cm10/pickle-hub-pro/.env <worktree>/.env` (`.gitignore:18` chặn, không lọt vào git) và **để lại** cho phiên sau.

## Lỗi console
Không có lỗi đỏ nào trên `/`, `/seller/settings`, `/login` — `read_console_messages onlyErrors:true` → "No console errors or exceptions found". Còn lại chỉ GTM debug + message của extension.

## An toàn
Không upload/chọn ảnh, không bấm "Chọn ảnh"/"Thay ảnh", không bấm publish/Thử lại, không submit form login. **Không dữ liệu production nào bị đụng.** Dev server đã tắt, tab đã đóng.

## Đề nghị vòng sau
Tiêu chí 4 (đường quan sát lỗi) và tiêu chí 6 (không treo >30s) **vẫn chưa kiểm chứng trên UI thật**. Cần: (1) session seller/PO, (2) cách ép lỗi thay cho snippet console.

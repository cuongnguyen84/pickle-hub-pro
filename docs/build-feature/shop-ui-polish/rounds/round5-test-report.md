# Vòng 5 — Báo cáo tester (logo + banner)

## 3/4 PASS · 1 SKIP · 0 FAIL

- **TC1 ✅ (PARTIAL — bằng chứng thay thế cho upload leg):** file chooser không điều khiển được qua Chrome MCP (input[type=file] cấm set giá trị; không có tool upload; osascript treo permission) → upload leg chạy HTTP với JWT seller + ẢNH THẬT tự tạo (logo PNG 800×800, cover JPEG 1600×900): init → storage 4×200 → finalize verified cả 2. **Publish leg bấm nút UI thật**: reload /seller/settings thấy preview + trạng thái "Đã xác minh nhưng chưa lên trang shop công khai." + nút "Đưa lên trang shop" → bấm → cả logo lẫn cover publish, trạng thái/nút biến mất, còn "Thay ảnh"/"Xoá" + slider focal cover. DB: public_path .../v1/live.webp, focal 0.5; RPC anon trả đủ 3 field. Copy sai cũ đã hết. Console 0 error. CHƯA quan sát được: auto-publish tự bắn sau upload (chỉ code review + vitest bảo chứng — vì upload không qua UI).
- **TC2 ✅:** logged-out /shop/store/<slug>: banner ~157px full-width bo góc + logo 72px thay monogram; 2 ảnh HTTP 200 image/jpeg (serve qua path .webp — MIME là sự thật, đúng thiết kế). Mobile 120px không verify được (resize viewport vô hiệu — bài học cũ).
- **TC3 ✅:** shop không logo → monogram "S" 72px, KHÔNG DOM banner, layout như trước vòng 5.
- **TC4 ⏭️:** không tái lập được publish-fail (classifier chặn docker stop edge runtime); retry button + idempotency chứng minh gián tiếp qua TC1.

Side-effect fixture: shop QA giờ CÓ logo+cover published (muốn test "chưa có logo" phải xoá/reseed). Env: dev tắt, .env.local xoá, fixture giữ.

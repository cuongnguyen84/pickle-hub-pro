# Intake — web-native-parity-port

**Ý tưởng (nguyên văn Cuong, 2026-07-27):** "so sánh prod web và app native (/apple). Chia task và thực hiện port đầy đủ sang native. Viết báo cáo tổng kết. Anh sẽ test vào sáng mai"

## Câu trả lời intake (từ chính message — AskUserQuestion không khả dụng trong phiên này, không hỏi thêm được)

- **Ai dùng:** người dùng app native iOS (The Line UI, `/apple` SwiftUI) — cùng tập user ~95% VN với web.
- **Đau ở đâu:** web prod đi trước native nhiều tính năng (mỗi phiên ship web đều có mục "native parity" treo nợ — xem memory `fix-both-web-and-native`). Cuong phải nhớ tay danh sách lệch.
- **Chứng minh thành công:** Cuong mở app trên simulator/máy thật sáng mai và các tính năng port chạy được; báo cáo tổng kết liệt kê rõ cái gì ĐÃ port / CHƯA port / vì sao.
- **Ràng buộc:**
  - Deadline cứng: sáng 2026-07-28 (Cuong test tay).
  - Build phải `BUILD SUCCEEDED` trên iPhone 17 Pro sim (memory `native-build-run-loop`: xcodegen → xcodebuild → simctl, bundle `net.thepicklehub.app.dev`).
  - KHÔNG đụng App Store submit (RED-gated từ trước).
  - Native = `/apple` (SwiftUI), KHÔNG phải `/ios` (Capacitor).

## Defaults tự quyết (Cuong không online để hỏi)

1. **"Đầy đủ" hiểu là parity theo GIÁ TRỊ, không phải theo pixel** — port các tính năng user-facing web có mà native thiếu, ưu tiên theo tần suất dùng; KHÔNG port admin tools / SEO surfaces (vô nghĩa trong app).
2. Task nào quá lớn cho một đêm → ghi vào báo cáo là "chưa port + ước lượng", không ship nửa vời.
3. Code commit lên feature branch, KHÔNG merge main tự động nếu tier vượt AMBER.

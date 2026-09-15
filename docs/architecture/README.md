# Ảnh chụp kiến trúc — 26/08/2026

18 file trong thư mục này được viết ngày 26/08/2026 trên nhánh
`feat/shop-production-phase-1` và chỉ về main ngày 15/09/2026, khi nhánh đó
được đóng lại. Chúng mô tả hệ thống **tại thời điểm chụp**, không tự cập nhật.

Ba chỗ đã lỗi thời ngay khi về main, đọc thì trừ hao:

- **Capacitor đã khai tử ngày 24/08/2026** (#670). Mọi đoạn nói về vỏ WebView
  Android/iOS, `capacitor.config.ts`, thư mục `android/` hay `ios/` đều không
  còn đúng. App iOS hiện là SwiftUI thuần trong `apple/`, và không có app
  Android.
- **Chợ không còn là pilot đóng.** Mở công khai cho người mua thật từ
  29/08/2026 (#709).
- **`workers/edge-blob-watchdog` không còn trên main**, cùng vài worker khác đã
  đổi hoặc bỏ.

Nguồn sự thật vẫn là mã nguồn. Khi tài liệu và code đá nhau, tin code — và sửa
tài liệu ngay tại chỗ vừa đọc, kèm ngày.

Lịch sử đầy đủ của nhánh cũ, gồm 80 nhật ký `docs/build-feature/`, nằm ở nhánh
`backup/shop-wip-2026-09-15`.

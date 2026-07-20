# Intake — cụm UX-06 + UX-07

Ngày: 2026-07-20 · Nguồn: `docs/roadmap-8.5-9.md:183-184`

## Ý tưởng

- **UX-06** (4d, dep UX-01 done): "Add undo/rollback for reversible destructive organizer actions" — organizer lỡ tay xoá/huỷ thứ khôi phục được thì phải có đường lùi.
- **UX-07** (4d, dep DS-03 done + partial BASE-07): "Simplify player discovery-to-registration journey" — rút ngắn đường từ lúc người chơi tìm thấy giải/buổi chơi đến lúc đăng ký xong. Dependency nới giống UX-01: bắt đầu trên research một phần, kết luận trên baseline đầy đủ.

## Câu trả lời của Cuong

**1. Thao tác xoá nào từng gây đau trên prod?**
> **Chưa từng đau thật, làm phòng xa.**

Hệ quả cho panel: KHÔNG có sự cố thật để bám. Ưu tiên theo **mức thiệt hại lý thuyết**, không theo tần suất. Đồng thời phải nghiêm túc hỏi ngược: thao tác nào thực sự đáng làm undo, thao tác nào chỉ cần một dialog xác nhận tốt hơn là đủ? YAGNI có hiệu lực mạnh ở đây — không có bằng chứng đau thật thì đừng xây cơ chế undo toàn cục.

**2. Baseline cho UX-07?**
> **Có cảm nhận nhưng không có số.**

Hệ quả: panel dùng cảm nhận của Cuong làm giả thuyết, nhưng **vẫn phải gắn đo trước hoặc cùng lúc**. Không được claim cải thiện conversion khi chưa có baseline. Cần hỏi Cuong cảm nhận cụ thể là gì (chỗ nào người ta rớt) — đưa vào vòng 1 như giả thuyết cần kiểm chứng, không phải sự thật.

**3. Native /apple?**
> **Cả hai cùng đợt như cụm trước** (giống #408 của cụm UX-01..05).

Hệ quả: mọi phương án phải kèm phần SwiftUI. Lưu ý ràng buộc: App Store submit đang RED-gated (manual-test-backlog mục 8) → native ship được vào repo nhưng chưa ra store, đừng thiết kế thứ phụ thuộc vào việc user có bản mới trên store.

## Ràng buộc bắt buộc (từ prompt + CLAUDE.md)

- Cụm UX-01..05 vừa ship (#406-#409), proposal ở `docs/proposals/ux-01-05-organizer-wizard/`. UX-06 phải ăn khớp `useAutosaveDraft` + wizard đã thống nhất — **không** dựng cơ chế thứ hai chồng lên.
- UX-08 (#414) đã chuẩn hoá back/deep-link/URL state (`useUrlBackedState`) — UX-07 dùng lại, không tự chế.
- DB-01/DB-01c: đăng ký sự kiện đã có RPC transactional + advisory lock. UX-07 đụng luồng đăng ký thì phải đi qua RPC đó.
- ~95% người Việt, mobile-first. Mọi chữ song ngữ VI/EN.
- Bài học #406: pre-mortem soi luồng tiền/manager đã lộ lỗ hổng prod thật. Lần này soi tương tự cho thao tác xoá — **xoá nhầm cái gì thì mất tiền / mất đăng ký của NGƯỜI KHÁC**, không chỉ mất công organizer.

## Yêu cầu riêng cho panel

- **UX-06**: phân loại rõ thao tác KHÔI PHỤC ĐƯỢC (soft delete / hoàn tác trong X phút) vs KHÔNG (đã thu tiền, đã gửi noti, đã có người đăng ký). Đừng hứa undo cho thứ không undo được. Với câu trả lời "chưa từng đau thật", phải trả lời được: cái này có đáng làm 4 ngày không, hay một phần nhỏ là đủ?
- **UX-07**: không claim cải thiện conversion khi chưa có baseline. Mốc **~2026-08-02** đã cam kết đọc funnel `organizer_tournament` (2 tuần data) trong proposal trước. Câu hỏi cho panel: UX-07 có cần funnel tương tự phía người chơi **trước** khi ship không, hay gắn cùng lúc là đủ?

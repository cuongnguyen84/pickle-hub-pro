# Pre-mortem — round 1 (3 postmortem giả định đã hỏng prod)

3 mắt xích xác nhận trong code thật:
1. **Doubles dùng bảng KHÁC** — `quick_table_teams` + `team_status`, không phải `quick_table_registrations` + `status` (`RegisteredPlayersList.tsx:105-121`, `useInteractionData.ts:117-141`).
2. `status` default `pending` + policy SELECT không lọc status + policy INSERT chỉ cần `user_id=auth.uid()` (mig `20251225041737:29,44-56`).
3. `useOpenRegistrationTables` KHÔNG có `staleTime` (khác hook nguồn `useUpcomingSocialEvents.ts:64` có `30_000`), feed thẳng list `ongoing` (`Tournaments.tsx:165,193-196`).

## Sự cố 1 (ưu tiên 1) — Giải ĐÔI kín người vẫn hiện trống; ~nửa số giải QuickTable không bao giờ có badge
Xác suất **cao** · phát hiện sau **3+ tuần** (không telemetry). Fan-out đếm `quick_table_registrations` cho MỌI row, nhưng đăng ký giải đôi nằm ở `quick_table_teams`/`team_status` → count giải đôi = 0 → `<3` → badge ẩn vĩnh viễn, kể cả giải đủ 16 đội. Đôi là format phổ biến nhất (`Tournaments.tsx:74-76`). Gate xanh vì copy đúng pattern `useUpcomingSocialEvents` (social_events chỉ 1 bảng, không mang cảnh báo đơn/đôi); 0 test; visual baseline CI không có giải đôi ≥3. Dấu hiệu sớm: `useInteractionData.ts:123-141` đã phải union 2 bảng cho "giải của tôi" = bằng chứng nội bộ 2 mô hình.

## Sự cố 2 (ưu tiên 2) — Badge thổi bằng đăng ký ma; "đã đăng ký" gồm cả người chưa duyệt
Xác suất **TB** · **không bao giờ tự lộ** (số sai theo hướng lạc quan). `!= 'rejected'` (gồm pending) + `status` default pending + INSERT self-serve `user_id=auth.uid()` → 5 tài khoản phụ bơm pending là vượt ngưỡng; policy SELECT không lọc status còn lộ sự tồn tại đơn chưa duyệt cho khách vãng lai. Giải duyệt-tay (`auto_approve=false`) hiện số cao hơn thực duyệt. Dấu hiệu sớm: `useApprovedRegistrations` (`useInteractionData.ts:80-96`) đã cố ý lọc `status='approved'` cho hiển thị công khai — badge chọn ngược = mâu thuẫn nội bộ đọc được ngay.

## Sự cố 3 (ưu tiên 3) — Landing /tournaments trắng list vài giây trên 3G, rồi badge gần như không bao giờ hiện
Xác suất **TB-cao** · phát hiện **không bao giờ** (0 RUM route này). Promise.all 20 count HEAD trong queryFn của `useOpenRegistrationTables`, feed thẳng `quickTablesOngoing` = tab MẶC ĐỊNH cho mọi khách kể cả anon (`Tournaments.tsx:161,193-196`) → list bị chặn render tới count chậm nhất; 3G VN 6 conn/host → 20 req thành 3-4 đợt tuần tự → list rỗng nhiều giây. Cộng: mất `staleTime` → pull-to-refresh (`Tournaments.tsx:183-185`) bắn lại 20 count. Lỗi ngược hướng: ngưỡng 3 + prod thưa (~86 QT/nhiều tháng) → badge ẩn gần hết → trả giá 20 round-trip cho badge **gần như không bao giờ hiện**. Gate bundle-byte mù với chi phí network (thêm N+1 = 0 byte = xanh); soak seed dày CI mạng nhanh không lộ.

## Xếp hạng
| # | Sự cố | Xác suất | Khó phát hiện |
|---|-------|----------|---------------|
| 1 | Đôi đếm nhầm bảng → badge ẩn/0 ~nửa giải | cao | cao |
| 2 | Badge gồm pending / gameable / lộ đơn chưa duyệt | TB | rất cao |
| 3 | N+1 chặn render 3G + badge gần như không hiện | TB-cao | cao |

## Rẻ nhất để chặn NGAY
1. **Guard TRONG hook, không trong card**: ở `useOpenRegistrationTables` (`useTournamentData.ts:130-136`) rẽ theo `t.is_doubles` — đôi count `quick_table_teams` (lọc `team_status NOT IN (rejected,removed)`), đơn count `quick_table_registrations` `status='approved'`. Một chỗ, chặn cả Sự cố 1+2. (Muốn giữ pending cho `auto_approve=false`: đọc cột `auto_approve_registrations` đã có trong select, chỉ gồm pending khi `auto_approve=true`.)
2. **Một dòng telemetry**: log khi badge *đáng lẽ* hiện (≥1) và *thật sự* hiện (≥3) — không có nó cả 3 sự cố tàng hình, "ship xong 0 tác dụng" thành đo được.
3. **Đừng đánh rơi `staleTime: 30_000`** vào `useOpenRegistrationTables`.

## Khoảng hở pipeline bài này lộ
- **Copy-pattern qua ranh mô hình dữ liệu = điểm mù panel.** "Giống hook đã chứng minh" (1 bảng) không chứng minh gì cho QuickTable 2 bảng. /idea nên liệt kê giả định schema của pattern nguồn khi bê đi.
- **Bundle-size gate mù với chi phí runtime mạng.** N+1 = 0 byte = xanh. Không gate nào đo round-trip trên đường render landing chính.
- **Không gate "ship xong có tác dụng không".** Ngưỡng-3 + prod thưa = badge không bao giờ hiện; soak seed dày CI không giống prod thưa.
- **RLS viết Dec 2025 không re-audit khi thành bề mặt công khai mới.**
- Note: anon-GRANT-chặn KHÔNG dựng thành sự cố chính (đăng ký đã đọc được cho anon trên share page prod → default privileges nhiều khả năng đã cứu). Nhưng nếu badge đọc 0 đồng loạt cho MỌI khách chưa login ngày đầu → nghi GRANT/`42501` trước, verify ops-runbook §1.

Files: `useTournamentData.ts:97-139`, `Tournaments.tsx:161,165,183-196,569-593`, `useUpcomingSocialEvents.ts:53-64`, `useInteractionData.ts:80-96,117-141`, `RegisteredPlayersList.tsx:105-121`, `mig 20251225041737:8,29,44-56`.

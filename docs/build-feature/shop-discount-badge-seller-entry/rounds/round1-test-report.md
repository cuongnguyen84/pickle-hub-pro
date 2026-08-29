## Kết quả test vòng 1: 2 pass, 0 fail, 7 skip
Server 8081 (worktree shop-fab). Tab Chrome chưa login; `SHOP_PUBLIC_OPEN=false` → khách thấy "Chợ đang hoàn thiện". Viewport 1249×813 (resize không đổi).

| # | Case | Kết quả |
|---|---|---|
| 1 | /shop khách không "Quản lý shop"/crumbs, console sạch | ✅ (giới hạn: không card vì cổng đóng) |
| 2 | Card không badge/strike | ⏭ skip (cổng đóng) |
| 3 | PDP disclaimer | ⏭ skip (không tới PDP) |
| 4 | Dropdown khách | ✅ không có "Kênh người bán"/"Đơn mở shop" |
| 5–7, 9 | [LOGIN] | ⏭ skip: không login |
| 8, 10 | [SAU MIGRATION] | ⏭ skip |

Fail: không. Cần Cuong login sẵn trong Chrome (admin/pilot đi xuyên ShopGate) rồi chạy lại TC1–TC9.

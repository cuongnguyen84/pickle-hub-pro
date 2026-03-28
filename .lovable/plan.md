

# Cải thiện ứng dụng ThePickleHub — Phân tích & Kế hoạch

## Vấn đề phát hiện

### 1. Lỗi 404 trên iOS khi vào chi tiết giải đấu

**Nguyên nhân**: Capacitor app load từ `https://thepicklehub.net` (WebView wrapper). Khi user navigate tới route như `/tournament/slug-name` hoặc `/tools/quick-tables/abc123`, nếu WebView refresh hoặc deep link trực tiếp, server cần trả về `index.html` cho mọi route (SPA fallback). Hiện tại không có file `_redirects` trong `public/` để cấu hình SPA fallback cho hosting.

**Giải pháp**: Thêm `public/_redirects` với rule `/* /index.html 200` — đây là chuẩn cho Lovable/Netlify hosting. Ngoài ra, cần kiểm tra Cloudflare config nếu domain chính đi qua Cloudflare.

### 2. Giải đấu mới không hiển thị tại `/tournaments`

**Nguyên nhân**: Trang `/tournaments` hiển thị Quick Tables chỉ khi `requires_registration = true` và `status = 'setup'`. Nhiều giải đấu mới tạo có `requires_registration = false` nên bị ẩn. Ví dụ: "DRH Pickleball Tournament", "Mad drops", "Pickle Ball The Pioneers" — tất cả đều `requires_registration = false` → không xuất hiện.

**Giải pháp**: Mở rộng query để hiển thị tất cả Quick Tables public đang active (setup/group_stage/playoff), không chỉ những giải có registration. Tương tự cho Doubles Elimination và Flex Tournament — hiện tại hoàn toàn không có trên `/tournaments`.

### 3. Thiếu Doubles Elimination & Flex Tournament trên `/tournaments`

Trang `/tournaments` chỉ hiển thị Quick Tables và Team Match, nhưng không có Doubles Elimination và Flex Tournament. User tạo giải ở các format này sẽ không thấy chúng ở trang tổng hợp.

---

## Kế hoạch thực hiện

### File thay đổi

| File | Mô tả |
|------|-------|
| `public/_redirects` | **Tạo mới** — SPA fallback rule cho hosting |
| `src/hooks/useTournamentData.ts` | Thêm hook `useActivePublicQuickTables()` thay thế `useOpenRegistrationTables()`, thêm hooks cho Doubles Elimination & Flex Tournament active/completed |
| `src/pages/Tournaments.tsx` | Hiển thị tất cả giải public active (không chỉ registration), thêm sections cho Doubles Elimination & Flex Tournament |
| `src/hooks/useSupabaseData.ts` | Export các hooks mới |

### Chi tiết kỹ thuật

**1. Tạo `public/_redirects`**
```
/* /index.html 200
```
Đảm bảo mọi route đều trả về SPA index, fix lỗi 404 khi refresh/deep link trên iOS.

**2. Mở rộng Quick Tables query**
- Thêm hook `useActivePublicQuickTables()` — query `is_public = true` AND `status IN ('setup', 'group_stage', 'playoff')` (bỏ filter `requires_registration`)
- Giữ nguyên `useOpenRegistrationTables()` cho backward compatibility

**3. Thêm Doubles Elimination & Flex Tournament**
- `useActiveDoublesElimination()` — query `doubles_elimination_tournaments` với `status IN ('active', 'ongoing')`
- `useActiveFlexTournaments()` — query `flex_tournaments` với `status IN ('active', 'ongoing')`
- `useCompletedDoublesElimination()` — status = 'completed'
- `useCompletedFlexTournaments()` — status = 'completed'

**4. Cập nhật `/tournaments` page**
- Thay section "Open Registration" thành "Active Quick Tables" với tabs active/completed
- Thêm section Doubles Elimination (active/completed)
- Thêm section Flex Tournament (active/completed)
- Giữ nguyên Team Match section




# Thay đổi cách tính lượt xem: cộng dồn mỗi 3 giây

## Tổng quan
Thay đổi logic ghi nhận view từ "1 view duy nhất mỗi phiên xem" sang "cứ mỗi 3 giây xem liên tục thì +1 view", áp dụng cho cả livestream và video (bao gồm cả embed).

## Các file cần sửa

### 1. Tạo hook mới: `src/hooks/useIntervalViewCounter.ts`
Hook dùng chung cho tất cả trang xem nội dung:
- Nhận `target_type`, `target_id`, `viewer_user_id`, `organization_id`, `source` (optional)
- Sau 3 giây đầu tiên, ghi 1 view event
- Sau đó cứ mỗi 3 giây tiếp tục ghi thêm 1 view event
- Dùng `setInterval` (typed `ReturnType<typeof setInterval>`)
- Cleanup interval khi component unmount hoặc id thay đổi
- Dùng `useRef` để track interval, không cần `viewRecorded` boolean nữa

### 2. Sửa 4 trang xem nội dung
Thay thế logic `setTimeout` + `viewRecorded.current = true` bằng hook mới:

- **`src/pages/WatchLive.tsx`** (lines 87-108): Xóa useEffect record view, dùng `useIntervalViewCounter`
- **`src/pages/WatchVideo.tsx`** (lines 45-62): Tương tự
- **`src/pages/embed/EmbedLive.tsx`** (lines 21-38): Tương tự, truyền thêm `source: "embed"`
- **`src/pages/embed/EmbedVideo.tsx`** (lines 29-46): Tương tự, truyền thêm `source: "embed"`

### Cấu trúc hook

```typescript
useIntervalViewCounter({
  targetType: "livestream" | "video",
  targetId: string | undefined,
  viewerUserId: string | null,
  organizationId: string | null,
  source?: "embed",
  intervalMs: 3000, // mặc định 3s
})
```

- Ghi view bằng `supabase.from("view_events").insert()`
- Không cần sửa database schema (bảng `view_events` đã có sẵn)
- View counts tự động tăng vì `view_counts` materialized view / aggregate sẽ đếm tất cả rows

## Không thay đổi
- Database schema
- UI/UX hiển thị
- Các component hiển thị view count
- Edge function `batch-view-events`


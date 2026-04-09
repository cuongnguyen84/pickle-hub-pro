

## Plan: Admin highlight cho Multi-Event Tournaments

### Ý tưởng highlight

Thêm cột `is_featured` vào bảng `parent_tournaments`. Admin có thể bật/tắt highlight cho từng giải tổng. Trên trang `/tournaments`, giải được featured sẽ hiển thị nổi bật hơn với:

- Border gradient màu primary (teal)
- Badge "Featured" / "Nổi bật" 
- Banner image hiển thị nếu có
- Giải featured được đẩy lên đầu danh sách

### Các bước thực hiện

**1. Database migration**
- Thêm cột `is_featured BOOLEAN DEFAULT false` vào `parent_tournaments`
- Admin có thể update qua RLS policy đã có

**2. Admin UI (`src/pages/admin/AdminTournaments.tsx` hoặc tương tự)**
- Thêm toggle featured cho từng parent tournament trong trang admin
- Nếu chưa có section quản lý parent tournaments trong admin, tạo một section mới

**3. Cập nhật trang Tournaments (`src/pages/Tournaments.tsx`)**
- Sort parent tournaments: `is_featured = true` lên đầu
- Card featured có visual khác biệt:
  - Border gradient primary
  - Badge "Nổi bật" / "Featured"
  - Hiển thị banner_url nếu có (cover image phía trên)
- Card thường giữ nguyên style hiện tại

### Technical details

```text
-- Migration
ALTER TABLE public.parent_tournaments 
  ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false;
```

```text
Tournaments.tsx: 
  - Query sort: .order('is_featured', { ascending: false })
                .order('created_at', { ascending: false })
  - Featured card: gradient border, badge, banner image
```

**i18n keys cần thêm:** `tournament.featured` cho cả EN và VI


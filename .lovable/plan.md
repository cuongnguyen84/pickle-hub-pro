

## Plan: Redesign Featured Parent Tournament Section

### Hiện trạng
- Admin đã có toggle `is_featured` trong `AdminTournaments.tsx` — giữ nguyên
- Trên `Tournaments.tsx`, featured parent tournaments hiển thị giống card thường, không nổi bật

### Thay đổi

**1. `src/pages/Tournaments.tsx`** — Tách featured vs non-featured parent tournaments
- Featured parents: render riêng ở section đầu trang (trước registered tournaments), với design nổi bật
- Non-featured parents: giữ nguyên section "Multi-event" hiện tại

**2. Featured card design mới:**
- Gradient border: `amber-500` → `orange-500` (warm gold tone, nổi bật hơn teal)
- Background: subtle gradient `from-amber-500/5 via-transparent to-orange-500/5`
- Badge "⚡ Nổi bật" / "⚡ Featured": amber/orange theme, nhỏ gọn
- Banner image hiển thị full-width phía trên nếu có `banner_url`
- Trophy icon màu amber thay vì teal
- Sub-event preview vẫn hiển thị (dùng `ParentTournamentCard` nhưng với variant prop)
- Subtle animated gradient shimmer border cho card featured

**3. `src/components/quicktable/ParentTournamentCard.tsx`** — Thêm prop `variant`
- `variant?: "default" | "featured"`
- `featured`: áp dụng gradient border, amber icon, badge "Nổi bật", banner image
- `default`: giữ nguyên style hiện tại

**4. `src/pages/admin/AdminTournaments.tsx`** — Cleanup
- Thay icon `Star` bằng `Trophy` cho consistency
- Bỏ badge "Nổi bật" text, chỉ giữ Switch toggle (đã đủ rõ)

**5. i18n** — Không cần thêm key mới (đã có `tournament.featured`)

### Technical details

```text
ParentTournamentCard:
  variant="featured":
    - Card wrapper: ring-2 ring-amber-500/40, bg-gradient-to-br from-amber-500/5 to-orange-500/5
    - Trophy icon: text-amber-500
    - Badge: "⚡ Featured" bg-amber-500/10 text-amber-500 border-amber-500/30
    - Banner: rounded-t-lg overflow-hidden, aspect-[3/1] object-cover

Tournaments.tsx:
  - Split: featuredParents = parentTournaments.filter(p => p.is_featured)
  - Render featured section trước other content
  - Non-featured vẫn ở section Multi-event bên dưới
```

### Files cần sửa
1. `src/components/quicktable/ParentTournamentCard.tsx` — thêm variant featured
2. `src/pages/Tournaments.tsx` — tách featured section lên đầu
3. `src/pages/admin/AdminTournaments.tsx` — cleanup Star → Trophy icon


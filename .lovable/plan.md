

# Báo cáo Review Code - ThePickleHub

## 1. Tổng quan kiến trúc

**Đánh giá: Tốt**

Dự án được xây dựng trên React + Vite + TypeScript + Tailwind CSS + Supabase, hỗ trợ cả web và native app (Capacitor). Kiến trúc tổ chức rõ ràng theo module:

```text
src/
├── components/   (UI theo domain: content, chat, flex, tournament...)
├── hooks/        (Logic nghiệp vụ tách biệt khỏi UI)
├── pages/        (Route-level components, lazy loaded)
├── i18n/         (Đa ngôn ngữ vi/en)
├── lib/          (Utilities)
└── integrations/ (Supabase client)
```

**Điểm mạnh:**
- Code splitting tốt với lazy loading cho tất cả pages trừ Index
- Prefetch data trước khi React mount (`prefetch.ts`) — giảm waterfall đáng kể
- LCP image preloading ở cả module-level và component-level
- Manual chunks cho vendor libraries giúp cache hiệu quả
- Error boundary xử lý stale chunk sau deploy

---

## 2. Bảo mật

**Đánh giá: Tốt**

- **Roles**: Dùng bảng `user_roles` riêng biệt, không lưu role trên profile — đúng best practice
- **Admin check**: Server-side qua `has_role()` SECURITY DEFINER function + RLS policies
- **Client-side role check**: `useAdminAuth` và `useCreatorAuth` query trực tiếp `user_roles` table — chính xác
- **Public livestreams**: Dùng view `public_livestreams` để ẩn `mux_stream_key` — tốt
- **Profile privacy**: Dùng `public_profiles` view khi fetch creator info cho anonymous users
- **RLS**: Tất cả bảng đều có RLS policies phù hợp

**Cảnh báo nhỏ:**
- `view_counts` có policy `USING (false)` cho ALL — nghĩa là chỉ functions/triggers mới update được. Đúng thiết kế nhưng cần đảm bảo có service role function để update.

---

## 3. Type Safety

**Đánh giá: Cần cải thiện**

- **73 files chứa `any`** — nhiều chỗ dùng `as any` để bypass TypeScript, đặc biệt trong:
  - `useSupabaseData.ts`: ~15 lần `as any` cho Supabase join results
  - `useDoublesElimination.ts`: `matches: any[]`, `(t: any)` nhiều chỗ
  - `AdminOrganizations.tsx`: `orgToDelete: any`, `editingOrg: any`
  - `LineupSelectionSheet.tsx`: `(match.team_a as any)`
  
- **Khuyến nghị**: Tạo proper interfaces cho Supabase join results thay vì cast `as any`. Supabase TypeScript types đã có sẵn trong `types.ts`.

---

## 4. Performance

**Đánh giá: Tốt, có điểm cần tối ưu**

**Tốt:**
- View counts dùng aggregate table `view_counts` thay vì `COUNT(*)` — O(1) lookup
- `staleTime` và `refetchInterval` hợp lý (30s cho view counts)
- Image optimization qua Supabase render API (`optimizeImageUrl`)
- Presence dùng exponential backoff cho reconnect

**Cần cải thiện:**
- **N+1 queries cho organization logos**: `useLivestreams` và `useReplays` gọi `get_organization_display_logo` RPC riêng biệt cho **mỗi org ID**. Với 10 orgs = 10 RPC calls. Nên tạo một RPC batch hoặc join trực tiếp trong query.
- **Duplicated fetch logic**: `useOpenRegistrationTables`, `useCompletedPublicQuickTables`, `useOpenTeamMatchTournaments`, `useCompletedTeamMatchTournaments` — 4 hooks gần giống nhau, mỗi cái đều fetch profiles riêng. Có thể abstract thành utility.
- **prefetch.ts không fetch logos**: Prefetch data không bao gồm organization logos, nên khi component render vẫn phải fetch thêm — gây waterfall.

---

## 5. Code Quality

**Đánh giá: Khá**

**Tốt:**
- Hooks tách biệt rõ ràng theo domain (chat, presence, registration, tournament...)
- Barrel exports (`index.ts`) cho các module chính
- i18n 2 ngôn ngữ đầy đủ
- Consistent UI patterns với shadcn/ui components

**Cần cải thiện:**
- **554 console.log** trong 17 files — nên dọn dẹp hoặc dùng conditional logging (chỉ dev mode)
- **File `useSupabaseData.ts` quá lớn** (796 dòng) — nên tách thành `useLivestreamData.ts`, `useVideoData.ts`, `useTournamentData.ts`...
- **`useLiveChat.ts` rất lớn** (811 dòng) — cân nhắc tách thành smaller hooks
- **Duplicated creator profile fetch pattern** xuất hiện ở 6+ hooks — nên extract thành `useCreatorProfiles(ids)` utility

---

## 6. UX & Accessibility

**Đánh giá: Khá**

**Tốt:**
- Dark theme premium design system với CSS variables
- Responsive layout với mobile bottom nav + capacitor support
- Skeleton loaders cho loading states
- Tooltip cho viewer counts

**Cần cải thiện:**
- `AppHeader` scroll listener dùng `window.scrollY` nhưng main content scroll trong container (overflow-y-auto trên `<main>`) — scroll event trên window có thể không fire
- `MainLayout` dùng string class `-webkit-overflow-scrolling-touch` — đây không phải Tailwind class hợp lệ, nên dùng inline style (đã có `style={{ WebkitOverflowScrolling: 'touch' }}`)

---

## 7. SEO

**Đánh giá: Tốt**

- `DynamicMeta` component cho mỗi page
- OpenGraph edge functions (`og-live`, `og-video`, `og-tournament`...)
- `SportsEventSchema`, `VideoSchema` cho structured data
- `robots.txt`, `sitemap.xml` có sẵn
- Canonical URLs cho livestream routes (redirect `/live` → `/livestream`)

---

## 8. Tóm tắt ưu tiên cải thiện

| Ưu tiên | Vấn đề | Ảnh hưởng |
|---------|--------|-----------|
| **Cao** | N+1 RPC calls cho org logos | Performance |
| **Cao** | 73 files dùng `any` | Maintainability, bugs tiềm ẩn |
| **Trung bình** | 554 console.log cần dọn | Bundle size, production noise |
| **Trung bình** | `useSupabaseData.ts` quá lớn (796 LOC) | Maintainability |
| **Thấp** | Duplicated fetch patterns | Code duplication |
| **Thấp** | Scroll listener có thể không hoạt động đúng | UX bug nhỏ |

---

## 9. Kết luận

Project có kiến trúc tổng thể **tốt** với security practices chắc chắn và performance optimizations đáng kể (prefetch, code splitting, aggregate tables). Các vấn đề chính cần giải quyết là **type safety** (giảm `any`) và **N+1 query** cho organization logos. Code base đủ mature cho production nhưng cần refactor dần để duy trì tốc độ phát triển khi scale.


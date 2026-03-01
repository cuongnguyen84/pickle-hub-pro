

## Plan: Audit Log System

### Đánh giá thiết kế

Thiết kế rất tốt và chuyên nghiệp. Một số điều chỉnh thực tế cho TPH:

1. **`actor_type` và `actor_role`**: Bỏ `actor_role` vì role có thể thay đổi theo thời gian — thay vào đó lưu role tại thời điểm event vào `metadata`. `actor_type` giữ nguyên nhưng dùng enum `text check` thay vì varchar.

2. **`severity`**: Rất hay cho alert sau này. Giữ nguyên 3 cấp.

3. **System events** (CPU, bandwidth, instance): TPH hiện không tự quản lý infra (dùng Mux/AntMedia managed), nên bỏ category `infra` ở phase 1. Tập trung `auth`, `stream`, `tournament`, `admin`.

4. **`user_agent`**: Hữu ích nhưng không lấy được từ client-side insert (RLS). Nên chỉ log trong edge functions hoặc triggers. Phase 1 có thể nullable và bỏ qua.

### Schema cuối cùng

```text
audit_logs
├── id (uuid, PK, default gen_random_uuid())
├── created_at (timestamptz, default now())
├── actor_id (uuid, nullable) — FK profiles
├── actor_type (text) — 'user' | 'system' | 'webhook'
├── event_type (text, NOT NULL) — 'USER_LOGIN_SUCCESS', 'STREAM_STARTED', etc.
├── event_category (text, NOT NULL) — 'auth' | 'stream' | 'tournament' | 'admin'
├── resource_type (text, nullable) — 'stream' | 'tournament' | 'match' | 'user'
├── resource_id (text, nullable) — ID đối tượng (text để linh hoạt)
├── severity (text, default 'info') — 'info' | 'warning' | 'critical'
├── ip_address (text, nullable)
├── user_agent (text, nullable)
├── metadata (jsonb, default '{}')
```

### Implementation

#### 1. Migration
- Tạo bảng `audit_logs` với index trên `event_category`, `event_type`, `created_at`, `actor_id`
- RLS: chỉ admin SELECT, INSERT qua SECURITY DEFINER function
- Function `log_audit_event()` — SECURITY DEFINER, tự lấy `auth.uid()`

#### 2. Database triggers (Phase 1)
- `livestreams` INSERT/UPDATE status → `STREAM_CREATED`, `STREAM_STARTED`, `STREAM_STOPPED`
- `user_roles` INSERT/DELETE → `ROLE_CHANGED`
- Triggers dùng `SECURITY DEFINER` để bypass RLS

#### 3. Client-side logging qua RPC
Gọi `log_audit_event()` trong các hook admin:
- `useUpdateUserRole` → `ROLE_CHANGED`
- `useUpdateUserQuota` → `QUOTA_UPDATED`
- Moderation actions → `CONTENT_HIDDEN`, `CONTENT_RESTORED`

#### 4. Admin UI — `/admin/audit-log`
- Bảng log với cột: Thời gian, Actor, Event, Resource, Severity (badge màu)
- Filter: event_category, severity, date range
- Phân trang 50 records/page
- Expandable row cho metadata JSON

#### 5. Navigation
- Thêm nav item `Audit Log` vào `AdminLayout` (icon: `ScrollText`)

### Files

| Action | File |
|--------|------|
| Migration | Tạo bảng, function, triggers, RLS, indexes |
| Create | `src/pages/admin/AdminAuditLog.tsx` |
| Create | `src/hooks/useAuditLog.ts` — query + RPC helper |
| Modify | `src/components/admin/AdminLayout.tsx` — nav item |
| Modify | `src/App.tsx` — route |
| Modify | `src/hooks/useAdminData.ts` — gọi log sau mutations |
| Modify | `src/hooks/useAdminQuota.ts` — gọi log sau mutation |
| Modify | `src/i18n/vi.ts` + `src/i18n/en.ts` |


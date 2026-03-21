

## Workspace Knowledge cho ThePickleHub

Dựa trên bộ knowledge đã tối ưu, đây là nội dung phù hợp để paste vào **Settings → Manage Knowledge** (workspace level):

---

```text
# ThePickleHub – Workspace Rules

## Language & Communication
- Respond in Vietnamese unless user writes in English
- Use technical terms in English (hook, component, RLS, RPC...)
- No emoji in code comments

## Coding Style
- TypeScript strict: NO `any` — define interfaces for all Supabase joins
- Files < 600 lines. Split if exceeds
- No console.log in production code
- Use `cn()` from @/lib/utils for conditional classes
- All text via i18n keys (src/i18n/), never hardcode

## Naming Conventions
- Hooks: `use[Domain][Action]` (e.g., useLivestreamData, useCreatorProfiles)
- Components: PascalCase, grouped by domain folder
- RPC functions: snake_case, singular for one item, plural for batch
- Types/Interfaces: PascalCase, suffix with purpose (e.g., LivestreamWithOrg)

## Architecture Patterns
- Hooks = business logic, Components = UI only
- Lazy load all pages except Index
- Barrel exports (index.ts) for each component group
- Prefetch critical data before React mount (src/lib/prefetch.ts)

## Data Fetching Rules
- NEVER N+1 queries. Always batch RPC or JOIN
- Use aggregate tables for counts (NOT COUNT(*))
- staleTime: 30s for live data, 5min for static
- Batch fetch: fetchOrgDisplayLogos(), useCreatorProfiles(ids)

## Security Rules
- Roles in user_roles table ONLY (never on profile)
- Permission checks via has_role() SECURITY DEFINER + RLS
- Never expose: mux_stream_key, internal IDs
- Public data only via public_* views
- All tables must have RLS policies

## Performance
- Manual chunks for vendor libs (vite.config.ts)
- optimizeImageUrl for large images only (>100px)
- Small avatars/logos: direct URL, no optimization API
- Exponential backoff for realtime reconnects

## Domain Context
- Pickleball ecosystem: livestream, tournaments, community
- Roles: admin, creator, user
- Tournament types: singles, doubles, team match, quick table, flex
- Livestream via Mux (stream_key private, playback_url public)
- View counts via aggregate table, updated by triggers

## AI Review Checklist
Before submitting code, verify:
1. No N+1 queries?
2. No `any` types?
3. No duplicate logic (check existing hooks)?
4. Sensitive data hidden behind views/RLS?
5. File under 600 lines?
6. All strings use i18n?
```

---

### Hướng dẫn sử dụng

1. Vào **Settings → Manage Knowledge** (workspace level)
2. Paste nội dung trên vào
3. Rules sẽ áp dụng cho **tất cả projects** trong workspace

Nội dung đã được tối ưu:
- **Ngắn gọn** (~50 dòng) để AI đọc nhanh mỗi lần
- **Actionable** — mỗi rule là lệnh cụ thể, không mô tả chung chung
- **Domain-aware** — bao gồm context pickleball để AI hiểu nghiệp vụ


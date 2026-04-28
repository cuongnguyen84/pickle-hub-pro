# Lessons learned — pickle-hub-pro

Project-scoped rules and recurring-bug records. Append-only; do not reorder.
Each entry: short title → context → rule → verification.

---

## Migration: New table + RLS = MUST include GRANT block

**Recurring bug (3 occurrences as of 2026-04-28):**
- `vi_blog_posts` — fix `20260414000000_fix_vi_blog_posts_rls_grants.sql`
- `blog_post_views` — fix `20260425000000_blog_post_views.sql`
- `videos` + `tournaments` + `organizations` + `livestreams` (batch) — fix `20260428000002_fix_creator_tables_grants.sql`

**Symptom:** Authenticated client hits `42501 permission denied for table <name>` even though RLS policies are correctly written.

**Cause:** PostgreSQL checks object-level GRANT **before** RLS policies run. Supabase Dashboard SQL Editor executes as super-user → bypasses GRANT check, so migrations look fine when tested manually but fail for any non-super-user client (anon key, authenticated JWT).

**Rule:** Every migration that creates a new `public.<table>` MUST end with the following GRANT block, BEFORE the `NOTIFY pgrst` line:

```sql
-- Grant table-level access (RLS policies are the actual gate, but Postgres
-- requires GRANT first or we get 42501 before any policy runs).
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Public read (omit if table is admin-only)
GRANT SELECT ON public.<table_name> TO anon;

-- Authenticated CRUD (always include even if table seems "read-only" today —
-- RLS will gate which rows actually pass, this just unlocks the door)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table_name> TO authenticated;

-- For each custom enum type used as a column type — RLS comparisons and
-- INSERT casts need USAGE on the type
GRANT USAGE ON TYPE public.<custom_enum_name> TO anon, authenticated;

-- Reload PostgREST schema cache so REST clients see changes immediately
NOTIFY pgrst, 'reload schema';
```

**When NOT to grant:**
- Don't `GRANT INSERT/UPDATE/DELETE` to `anon` (only authenticated should write)
- Don't grant to `service_role` (already has full bypass via Supabase platform)
- Don't grant on tables in non-public schemas without careful audit

**Verify after applying any new-table migration:**
```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = '<your_new_table>'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;
```
Expected: rows for `authenticated` with at least SELECT/INSERT/UPDATE/DELETE.

---

## Migration: Rename component → MUST update `export default`

**Occurrence (1 — broke production 30 min):**
- Phase 2 C1 cutover (commit before `6595ba8`): renamed `const TheLine = ...` → `const Index = ...` in `src/pages/Index.tsx` but left `export default TheLine;` at line 800. Production hit `ReferenceError: TheLine is not defined` → site stuck "Loading..." 30 minutes until hotfix `6595ba8`.

**Symptom:** Production blank page or "Loading..." stuck indefinitely. Console: `ReferenceError: <OldName> is not defined`.

**Cause:** When renaming a top-level React component (`const X = () => {}`), the `export default X;` line at end of file references the OLD name. JS module load fails before component renders. Vite dev server may catch via HMR, production build does not.

**Rule:** When renaming a component declaration, ALWAYS verify:
```bash
git grep -n 'export default' src/pages/<file>.tsx
```
matches the new `const <Name>` declaration. Run before every commit that renames component.

**One-liner check post-rename:**
```bash
node -e "const f=require('fs').readFileSync('src/pages/X.tsx','utf8'); const c=f.match(/const (\w+) = /)[1]; const e=f.match(/export default (\w+);/)[1]; if(c!==e) throw new Error(`mismatch: const=${c} export=${e}`)"
```

---

## Storage RLS: Admin bypass MUST be OUTER OR, not AND-last

**Occurrence (1 — videos bucket blocked admin uploads):**
- Migration `20251222113744` for `videos` bucket: policy required `bucket_id = 'videos' AND folder[1]='org' AND folder[2]=user_org_id AND (is_creator OR is_admin)`. Admin uploading to other org's folder → folder check fail → reject. Fixed `88df78b` mirrors `thumbnails` bucket pattern.

**Symptom:** Admin user (with `is_admin()=true`) gets `new row violates row-level security policy` on storage upload, even when uploading to any org folder.

**Cause:** Admin bypass placed AS AND-clause inside structured constraint:
```sql
WITH CHECK (
  bucket_id = '<bucket>'
  AND folder[1] = 'org'
  AND folder[2] = user_org_id  -- ← admin still constrained here
  AND (is_creator OR is_admin)
)
```
The `is_admin` check only relaxes role, not folder constraint.

**Rule:** Admin bypass MUST be the OUTER OR — admin completely skips folder check:
```sql
WITH CHECK (
  bucket_id = '<bucket>'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin()  -- ← admin bypass first, no folder constraint
    OR (
      public.is_creator()
      AND folder[1] = 'org'
      AND folder[2] = public.get_user_organization_id(auth.uid())::text
    )
  )
)
```

**Reference template:** `thumbnails` bucket policies in `20251222132621_280522dc-73b7-4732-a9a9-5aa6242f6ef3.sql` — copy pattern for any new bucket.

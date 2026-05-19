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

---

## Supabase Realtime: Channel name MUST include random suffix, not just `Date.now()`

**Occurrence (1 — `/live/:id` intermittent broken):**
- 3 hooks (`useChatMessages`, `useLivePresence`, `useLiveViewerList`) used pattern `chat:unified:${livestreamId}:${Date.now()}` for channel name. When 2 useEffect re-runs land in same millisecond (StrictMode, fast WebSocket reconnect, navigation burst), the channel name collides → Supabase JS client deduplicates → second `.on('postgres_changes', ...)` fires AFTER `.subscribe()` → `cannot add postgres_changes callbacks for realtime:chat:unified:<id>:<ts> after subscribe()`. Fixed `9425f6a`.

**Symptom:** Console error `cannot add 'postgres_changes' callbacks for <channel> after subscribe()`. Page may render but realtime updates stop working.

**Cause:** `Date.now()` resolves to milliseconds. React re-renders can land within same ms in production. Two `supabase.channel(name)` calls with identical name reuse the same WS channel internally.

**Rule:** Always combine `Date.now()` with random base36 suffix:
```ts
const channelName = `chat:unified:${id}:${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
```
Collision probability drops from ~1/1000 per ms to ~1/10^14.

**Helper:** `src/lib/uniqueChannelId.ts` exposes `uniqueChannelSuffix()` — reuse across all hooks creating realtime channels.

---

## Service Worker: NEVER precache `index.html`; clear cache on chunk error

**Occurrence (1 — production /tournaments stuck "Đang tải lại..."):**
- Workbox config precached `**/*.{js,css,html,...}` (CacheFirst). After deploy, SW served OLD cached `index.html` referencing OLD chunk URLs. CDN had only NEW chunks → SPA fallback `/* /index.html 200` returned NEW HTML for OLD chunk URL → browser parsed HTML as JS → `Unexpected token '<'` → ChunkErrorBoundary fired → reload → loop until MAX_RELOADS=2 hit → stuck. Fixed `9425f6a` (SW config) + `03e84b4` (ChunkErrorBoundary clear cache).

**Symptom:** Production SPA users (specifically those on existing tabs from before deploy) stuck on "Đang tải lại..." (Loading...) screen. Network tab shows JS files returning HTML. Console shows `Unexpected token '<'` errors.

**Cause:** SW precache HTML serves stale shell; SPA fallback returns HTML for missing chunk URLs; browser type-confuses HTML for JS.

**Rule (3 layers required):**

1. **Workbox: exclude HTML from precache:**
```ts
// vite.config.ts workbox section
globPatterns: ["**/*.{js,css,ico,png,svg,woff,woff2}"],  // NO html
globIgnores: ["**/index.html"],
skipWaiting: true,
clientsClaim: true,
runtimeCaching: [{
  urlPattern: ({ request }) => request.mode === "navigate",
  handler: "NetworkFirst",
  options: { networkTimeoutSeconds: 3 },
}],
```

2. **ChunkErrorBoundary: clear ALL caches + unregister SW BEFORE reload:**
```ts
async componentDidCatch(error: Error) {
  if (isChunkError(error)) {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    window.location.reload();
  }
}
```

3. **`pwa.ts`: listen `controllerchange`:**
```ts
let reloading = false;
navigator.serviceWorker?.addEventListener("controllerchange", () => {
  if (reloading) return;
  reloading = true;
  window.location.reload();
});
```

**Detection patterns to catch in error message:**
- `Failed to fetch dynamically imported module`
- `Loading chunk`
- `ChunkLoadError`
- `Unexpected token '<'` (HTML-served-as-JS fingerprint)

---

## Cowork session: ALWAYS `git fetch` before suggesting next code change

**Reason:** When user pastes Claude Code output during a Cowork session, the assistant's local working tree is often N commits behind `origin/main`. Suggesting code changes against stale state leads to incorrect line numbers, missing files, or duplicate work.

**Rule:** Every time the user pastes Claude Code's output (or any indication code shipped), run:
```bash
cd <repo>
git fetch origin
git log origin/main --oneline -5
```
And read any newly-added files referenced in the output BEFORE drafting next prompt.

**Don't:**
- Assume previous file content still matches what's on `origin/main`
- Reference line numbers from local cached state
- Recommend changes to files Claude Code may have just deleted/refactored

**Do:**
- `git fetch` + `git log` first thing on every output paste
- `git show origin/main:<path>` to read latest before suggesting edits
- Verify shipped commit SHA matches what user reports

---

## React: hook calls MUST precede every conditional return

**Occurrence (1 — burger menu froze homepage on iOS):**
- Commit `726f48b` added `useLivestreams("live")` inside `BottomNav` AFTER existing early returns for `/admin`, `/creator`, `/preview`, `/embed` paths and `keyboardHeight > 0`. When user opened the drawer, the autofocused search input opened the iOS keyboard, `useKeyboardHeight() > 0` flipped the component to early-return-null, and the new render called fewer hooks than the previous one. React threw "Rendered fewer hooks than expected" and the subtree crashed — visible to user as a frozen page on burger tap. Hotfix `c2fb8ec` hoisted the hook above the early returns.

**Symptom:** Page appears to freeze or go blank after a state change that triggers a conditional return in a component that started rendering normally. Console error: `Rendered fewer hooks than expected. This may be caused by an accidental early return statement.`

**Cause:** React tracks hook calls by call-order, not by name. If a render path executes 3 hooks one render and 4 the next, React loses its place and crashes the component (and often its subtree). New hooks added during a refactor are easy to drop into the wrong slot — especially when the existing function has guard `return null;` lines for unrelated reasons.

**Rule:** Every `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useQuery`, custom hook, etc. MUST be called BEFORE the first conditional `return` in the function body. Order:
1. All hook calls (top of function)
2. Derived values + memoization
3. Conditional early returns
4. Render JSX

**Verify before commit:**
```bash
# eslint-plugin-react-hooks catches this if installed:
npx eslint --rule 'react-hooks/rules-of-hooks: error' src/components/<File>.tsx
```
Project already has eslint config — confirm `react-hooks/rules-of-hooks` is `"error"` not `"warn"` in `eslint.config.js`. A `"warn"` will only show in dev console; `"error"` fails CI.

**When tempted to put a hook after a guard:** the guard is for the user's UX (skip render), not for the hook's correctness. Hooks must always run; just discard their result if you don't need it.

---

## TODO: Live presence channel scaling concern (homepage hero)

**Status:** open. Identified Round 2 audit P2-J / R2-11 (2026-05-02), deferred — needs traffic-data + RPC schema work to ship properly.

**Concern:** `useLivePresence(featured.id, isLive)` in `src/components/home/LiveBroadcastHero.tsx` opens a Supabase Realtime presence channel per homepage visitor when a live match is featured. With 1000s of users landing on `/` simultaneously during a major broadcast, that's 1000s of channels with their own track/sync overhead. Counts work correctly today; concern is scale.

**Constraints / why we didn't fix yet:**
- The viewer-count display IS a meaningful social-proof win shipped in Round 1 (commit `f091067`); disabling it loses the feature.
- The clean fix needs a single broadcast-style "stats" channel (one channel, all subscribers receive viewer count, no per-user track) — not the same primitive as the watch-page presence which DOES need per-user track for the chat sidebar viewer list.
- Or: a poll-based RPC `get_live_viewer_counts(livestream_ids[]) → {id, count}[]` cached at DB layer, called every 15-30s. No Realtime channel from the homepage at all.

**When to revisit:** after concurrent homepage traffic exceeds ~500 simultaneous (check GA4 realtime users + Supabase Realtime channel count). At that scale the cost shows up. Until then the per-user channel is fine.

**Reference:** `.claude/memory/` other rules don't apply here — this is a pure scaling question, not a correctness or security one.

---

## EN blog post: 4 files MUST stay in sync

**Recurring bug (3 occurrences as of 2026-05-05):**
- `pickleball-world-cup-2026-da-nang` (2026-04-23) — bot 404, fixed by adding to `BLOG_POST_META`
- `pickleball-tour-wars-2023-explained` (2026-05-05) — same bot 404, same fix
- `app-tour-vs-ppa-tour-contracts-2026` (2026-05-05) — same bot 404, same fix

Plus a parallel sitemap miss confirmed by GSC URL Inspection 2026-05-05 ("Không phát hiện sơ đồ trang web giới thiệu nào") for both 2026-05-05 posts before commit `61b4fa8`.

**Symptom:** New EN blog post renders fine for humans (React SPA) but Googlebot/Bingbot get 404 on `/blog/<slug>`. Or, post is reachable but GSC URL Inspection reports no referring sitemap → crawl priority degraded.

**Cause:** Bots hit the Cloudflare Pages prerender path (`functions/_lib/render/index.ts`), which uses two hardcoded dictionaries:
1. `BLOG_POST_META: Record<string, {title, description}>` — controls whether a blog slug renders at all for bots. Missing entry = 404.
2. `EN_BLOG_SLUGS` in `functions/sitemap.xml.ts` — controls whether the slug appears in `/sitemap.xml`. Missing entry = no referring sitemap, GSC crawl priority degraded.

Both are independent of `src/content/blog/metadata.ts` (used by SPA list pages) and `src/content/blog/posts/<slug>.ts` (used by SPA detail page). Shipping a new post by adding only the SPA files leaves the bot path broken.

**Rule:** Every new EN blog post MUST update all 4 files in the same commit (or in a 4-commit batch before deploy):
1. `src/content/blog/posts/<slug>.ts` — full content (SPA detail page)
2. `src/content/blog/metadata.ts` — list-page metadata (SPA list/related)
3. `functions/_lib/render/index.ts` — `BLOG_POST_META` dict (bot prerender)
4. `functions/sitemap.xml.ts` — `EN_BLOG_SLUGS` array (sitemap)

**Verify before merging to main:**
```bash
SLUG=<your-new-slug>
grep "$SLUG" src/content/blog/posts/$SLUG.ts \
            src/content/blog/metadata.ts \
            functions/_lib/render/index.ts \
            functions/sitemap.xml.ts | wc -l
# Expect ≥4 (one match per file at minimum).
```

Post-deploy verify (2-3 min after Cloudflare Pages build):
```bash
curl -sI -A "Googlebot" https://www.thepicklehub.net/blog/$SLUG | head -1
# Expect: HTTP/2 200 (NOT 404)

curl -s https://www.thepicklehub.net/sitemap.xml | grep "$SLUG"
# Expect: one <loc> line with the slug.
```

**VI counterpart**: VI posts use `vi_blog_posts` Supabase table — different code path. The 4-file sync rule applies to EN posts only. VI posts need: `growth-tasks/sql/<date>-vi-<slug>.sql` insert + verify SELECT.

**Reference commits:**
- `7c888a2` — fix BLOG_POST_META for the 2 May 5 posts
- `61b4fa8` — fix EN_BLOG_SLUGS for the 2 May 5 posts
- `3d165d1` — original incident with `pickleball-world-cup-2026-da-nang` (the inline `// Verified 2026-04-23` comment in `_lib/render/index.ts` documents that fix)

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

## EN blog post: keep the source files in sync (SUPERSEDED IN PART — see update at end of entry)

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

**Rule (UPDATED 2026-07-17 — SEO-02, commit `ce6a0fa`):** `BLOG_POST_META` and `EN_BLOG_SLUGS` are now **GENERATED at module load** from `src/content/blog/metadata.ts`. They are no longer hand-edited, and the historical 4-file rule is down to **2 files + Supabase**:
1. `src/content/blog/posts/<slug>.ts` — full content (SPA detail page)
2. `src/content/blog/metadata.ts` — **the single source of truth**. `BLOG_POST_META` (SSR `<title>` = `metaTitleEn`) and `EN_BLOG_SLUGS` (sitemap) both derive from it.
3. Supabase `vi_blog_posts` INSERT for the VI version (`alternate_en_slug` -> EN slug)

**Do NOT hand-edit** `functions/_lib/render/blog-meta.ts` or `functions/_lib/static-blog-slugs.ts` — both carry a GENERATED header. Slug parity is guaranteed by construction and locked by `src/lib/__tests__/blog-seo-surfaces.test.ts`.

**Historical paths** (for reading old commits): the dicts used to live in `functions/_lib/render/index.ts` and `functions/sitemap.xml.ts`; the SEO-04 split (`5ca9f94`) moved them to `blog-meta.ts` / `static-blog-slugs.ts`, and SEO-02 (`ce6a0fa`) then made them generated.

**Verify before merging to main:**
```bash
SLUG=<your-new-slug>
grep "$SLUG" src/content/blog/posts/$SLUG.ts src/content/blog/metadata.ts | wc -l
# Expect ≥2. The bot-prerender + sitemap surfaces are generated from metadata.ts,
# so a metadata entry is sufficient — verify them on the deployed site, not in source.
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

---

## Ahrefs / GSC-via-Ahrefs MCP — KHÔNG DÙNG (không có gói trả phí)

**Quyết định 2026-06-29 (Cường):** Bỏ HOÀN TOÀN Ahrefs khỏi quy trình. Anh không mua gói trả phí → mọi endpoint Ahrefs API (kể cả GSC qua Ahrefs, `subscription-info`, `management-projects`) trả `{"error":"Insufficient plan"}`.

**Rule:**
- KHÔNG gọi bất kỳ tool Ahrefs MCP nào (`site-explorer-*`, `gsc-*`, `keywords-explorer-*`, `rank-tracker-*`, `subscription-info`, `management-*`, `brand-radar-*`, `web-analytics-*`, `site-audit-*`...).
- KHÔNG "re-test blocker #1" hằng ngày. Bỏ hẳn khái niệm "blocker #1 Ahrefs/GSC" + đếm "run #N" khỏi báo cáo.
- Metrics khi cần: đọc Google Search Console UI trực tiếp qua **Chrome MCP** (khi Cường mở browser), hoặc GA4. KHÔNG qua Ahrefs.
- Coi "không có Ahrefs" là điều kiện CỐ ĐỊNH, không phải blocker. Lập kế hoạch không phụ thuộc Ahrefs.

**Verification:** báo cáo hằng ngày không còn mục "re-test Ahrefs / run #N". Doc cũ nhắc "unblock/nâng Ahrefs add-on" = context lịch sử, bỏ qua.

---

## Verifying production: ALWAYS `mktemp -d`, never a fixed `/tmp/<name>` path

**Occurrence (1 — 2026-07-17, nearly reported a phantom production incident):**
Verifying the World Cup refresh, `curl -o /tmp/en.html` appeared to show Googlebot
receiving a *different post entirely* — three times, intermittently. The conclusion
being drafted was "prerender cache poisoning, severe". It was not.

**Symptom:** production checks return content from a *previous* session's run —
often a different page — while `curl` reports `200` and a plausible byte count.
Re-running with a pipe instead of `-o` gives the correct result, so the bug looks
intermittent and cache-related.

**Cause:** the sandbox `/tmp` **persists across sessions**, and files written by an
earlier scheduled run are owned by a different user. `curl -o /tmp/en.html` then
fails to overwrite **silently** — `curl` still prints `200`, `rm` reports
`Operation not permitted`, and the grep reads yesterday's file. In the 2026-07-17
case `/tmp/en.html` was dated `2026-07-16 07:48:34`, left by the previous morning's
run, and contained the player post.

**Rule:** every production verification writes to a fresh directory:
```bash
D=$(mktemp -d)
curl -s -o "$D/en.html" -A "$UA" "$URL"
```
Never `-o /tmp/en.html`, `/tmp/vi.html`, `/tmp/post.js` or any other fixed name.
Piping straight to `grep` is also safe.

**Tell-tale that you are hitting this, not a real bug:** results differ depending on
whether the check used `-o <fixed path>` or a pipe. A real cache/CDN bug does not
care how you wrote the file to disk. Also: a stale cache serves the *old version of
the same page*; getting a *different page* points at your harness, not the edge.

---

## Do not assert "not published" from press silence — check the event's own channels

**Occurrences (2 in one day — 2026-07-17, both on the World Cup pillar):**
1. Post stated "entry fees for 2026 have not been published". They had been, in full,
   on the organizer's entry platform — including a deadline **14 days away**. Fixed
   `88544a7`.
2. Post stated Vietnam "debuted at the 2025 World Cup in Group H with no notable
   results". Vietnam has never played a World Cup. The claim traced to a preview
   published 11 days *before* the 2025 event, written in the future tense
   ("sẽ tham gia"), sourced to the organizer's *list of participating countries*.
   An entry list had been read as a result, and "Group H" had no source at all.
   Fixed `633eeb5`.

**Cause:** both came from treating Vietnamese press coverage as the complete record.
Local media reports the announcement (the press conference, the entry list) and
frequently never publishes the follow-up (pricing pages, who actually turned up).
Absence from the press is not absence from the world.

**Rule — two parts:**
1. **Before writing that something is unannounced/unpublished, check the entity's own
   channels**: official site, ticketing/entry platform, federation page, social. A
   negative claim ("no prize purse", "fees not published", "no date yet") is a factual
   assertion and needs the same sourcing as a positive one — and it rots fastest,
   because it is only ever one announcement away from being wrong.
2. **Distinguish announced / scheduled / registered from happened.** Check the tense
   and the publication date of the source. A preview saying a team "will compete" is
   not evidence it competed; look for a post-event result. If no result exists,
   say what is verifiable ("named on the entry list; no result recorded"), not what
   is convenient.

**Verification habit:** for any claim about a live event, ask "what would the
organizer's own page say?" and go read it. `WebFetch` returns an empty shell on
JS-rendered sites — escalate to the Chrome MCP rather than concluding "no info".

## 2026-07-17 — CodeQL #24: "bug sống" hoá ra là byte vô hình
- `safeRedirect.ts` chứa raw control bytes trong regex → mọi tool hiển thị thành `[ -\s]`;
  4 agent (kể cả GPT-5.6 "runtime verify") đều test CHUỖI HIỂN THỊ chứ không phải byte thật
  → đồng thuận chéo-vendor vẫn sai vì cùng nhìn qua một lớp render dối.
- Tín hiệu lẽ ra phải bắt được NGAY: test suite xanh có sẵn case hyphen (`/su-kien/foo`)
  mâu thuẫn trực tiếp với claim. LUẬT: trước khi tin một "bug sống", chạy test hiện có +
  hexdump dòng code nghi vấn. Panel /idea nên thêm bước "đối chiếu claim với test đang xanh".
- Cùng phiên: chính orchestrator suýt lặp lỗi — dán NBSP thô vào test. Escape tường minh
  (\xNN, \uNNNN) là chuẩn cho mọi ký tự ngoài ASCII in được.

## 2026-07-18 — perf-js-gzip (PR #389)

- **Đừng suy initial-load từ precache-membership hay aggregate.** vendor-charts (recharts 107,8 KB gz) bị modulepreload + entry static-import → eager trên MỌI trang suốt nhiều tháng, dù mọi consumer là lazy route; không gate nào nhìn thấy vì check-bundle-size chỉ cộng tổng. Cách đo đúng: parse dist/index.html (entry script + modulepreload + static imports đệ quy) — giờ là gate INITIAL trong check-bundle-size.mjs.
- **manualChunks object-form kéo chunk "lazy" vào eager graph.** Khai báo `"vendor-charts": ["recharts"]` khiến Rollup hoist chunk vào import graph của entry (shared cjs internals). Chunk được cho là lazy phải verify bằng dist/index.html, không tin config.
- **`npm uninstall` một dep → luôn clean-regen lockfile** (rm node_modules package-lock && npm install && npm ci verify) trước khi push, không thì CI chết ở `npm ci` EUSAGE (dính lần 2, lần đầu 2026-07-08).
- **Coverage threshold 83% sẽ bắt component mới thiếu test render-path.** Component đo kích thước bằng ResizeObserver không render gì ở server/test (width=0) → thêm prop `fixedWidth` để test exercise được SVG paths.
- **Smoke đỏ ngay sau push branch: nghi deploy-race trước khi nghi code.** 3 lần đỏ = 3 test khác nhau (chunk 404, SW-reload navigation destroyed, focus flake), đều pass khi rerun trên preview ổn định. Phân biệt: chạy đúng test đó local với PLAYWRIGHT_BASE_URL=preview — pass ngay = môi trường.
- **PWA offline test tay trên iPhone cần đợi ≥30s sau lần mở đầu từ icon** — iOS standalone container cài lại SW + precache từ đầu, tách biệt Safari. Màn trắng khi test vội không phải bug. Repro chuẩn: Playwright context.setOffline sau khi SW controlled.
- **risk-tier.mjs classify theo working tree, không theo PR** — dính file untracked của phiên khác (apple/, android/) làm RED reason sai. Đọc kỹ `files` trong output trước khi tin reasons.

## 2026-07-18 — DS-03 ship
- `git stash` là REPO-WIDE, chung giữa mọi worktree/phiên: `git stash pop`/`drop` bừa trong worktree có thể nuốt stash của phiên khác (đã lỡ drop "WIP Add auth gate wrapper", cứu lại bằng `git fsck --unreachable` + `git stash store`). Đừng bao giờ pop/drop stash không phải mình tạo.
- npm >=11 install qua symlink node_modules sẽ PHÁ symlink thành thư mục thật → worktree tách khỏi node_modules chính; và lock npm-11 bị `npm ci` npm-10 (CI) từ chối — luôn `npx npm@10.8.2 install --package-lock-only` khi đổi deps.
- risk-tier.mjs coi MỌI file `apple/` là RED tại merge — nếu proposal đã refine "merge revertable, submit mới RED" thì release-pilot vẫn dừng đúng luật; hoặc tách PR native, hoặc Cuong duyệt trực tiếp trong phiên. Cân nhắc thêm nhãn `apple-source-only` cho classifier.
- Smoke main sau merge đỏ vì deploy-race asset 404 (flake đã biết, rerun qua) — ĐỪNG revert theo phản xạ: verify tay entry chunk trước (curl file hash từng 404 → 200 = race, không phải regression).

## 2026-07-19 — cụm ux-01-05-organizer-wizard (#406-#409)

- **CodeQL chặn bank-fields-vào-localStorage** (`js/clear-text-storage-of-sensitive-data`, high): autosave form có field ngân hàng sẽ đỏ check. Fix đúng = loại field nhạy cảm khỏi draft serialization (cả web lẫn native), không dismiss. Ranh giới trùng luật D3 template — "payment account không persist ngoài DB" giờ là invariant có test 2 nền.
- **Panel /idea đảo ngược nhau ở vòng 2 là bình thường**: architect tự siết (nhận instrument-first) đúng lúc pre-mortem rút gate (thấy localStorage giết cơ chế sự cố) — đối chất làm cả hai phía DI CHUYỂN, ledger bắt được vì có bằng chứng file:line. REFINE-hội-tụ vẫn phải OPEN_FOR_CUONG.
- **Recon 1 lượt có thể sai dữ kiện then chốt** ("form 1 trang khổng lồ" — thực tế đã là stepped wizard): agent vòng 1 nào xây phương án trên recon PHẢI tự verify claim load-bearing; ui-ux-critic bắt được vì đọc code thật.
- **Session limit giết agent giữa release**: release-pilot chết khi đang soak → merge/deploy/smoke làm tay được nhưng soak 30' chính quy mất. Phiên dài nhiều agent: để release-pilot chạy SỚM trong ngày, đừng dồn cuối.
- **Smoke main đỏ ngay sau merge = nghi deploy-race flake trước** (lần 2 xảy ra, test focus A11Y-01): rerun --failed trước khi đào bới; 2 lần retry trong 1 run vẫn có thể cùng đập vào deploy đang settle.
- **2 agent song song sửa chung i18n vi.ts/en.ts OK nếu chia vùng namespace rõ** (common/teamMatch vs socialEvents.create) — dặn rõ trong prompt vùng nào của ai.
- **QuickTable draft scope**: web theo shareId (row pre-created), native theo "new" (1 sheet) — chấp nhận lệch, ghi ở proposal §9; đừng ép parity mù.

## 2026-07-20 — livestream-gate-hardening (PR #415)

- **`risk-tier.mjs --base` quét cả working tree (untracked).** Máy Cuong có rác untracked (android/.gradle, .claude/agents, scripts/agents) → classifier báo RED giả (native shell + guardrail). Tier thật của một branch = `--files "$(git diff --name-only origin/main ...)"` trên diff COMMIT. release-pilot đã dừng đúng vì RED — cách gỡ đúng là làm cho diff sạch (dời code khỏi file RED-tier), không phải cãi classifier.
- **Đụng `useAuth.tsx` = RED kể cả khi chỉ thêm analytics.** Attribution/tracking cần listener `onAuthStateChange` RIÊNG trong module khác (xem `src/lib/livestreamGateAttribution.ts`), đừng nhét vào AuthProvider.
- **Cloudflare Pages preview alias cắt 28 ký tự.** Branch `feat/livestream-gate-hardening` → `feat-livestream-gate-hardeni.pickle-hub-pro.pages.dev`. Đặt tên branch dài là phải dò alias, đừng poll URL đầy đủ chờ 200.
- **Module top-level import supabase client sẽ nổ trong CI env-less** (`supabaseUrl is required`) khi bị component test kéo vào. Test nào render component đụng chuỗi import đó phải mock `@/integrations/supabase/client`.
- **Gate overlay: z-index không phải rào a11y.** Screen-reader rotor kích hoạt được element bị che → element nguy hiểm phải unmount/`inert` khi gated, và handler phải tự check cờ (`handleTapToPlay` check `gatedRef`).
- **CÒN NỢ (PR riêng):** presence-gated cho admin viewer list — merge-gate = runtime test khẳng định `channel.track()` được gọi LẠI khi `isGated→true`; TUYỆT ĐỐI không đưa `gated` vào subscribe deps (collision 2026-07-08). Native /apple hoàn toàn chưa có gate (đợi cùng đợt signed playback — tầng 3).

## 2026-07-21 — Column-level REVOKE (invite_code lockdown, PR #430)

- **`?select=*` sau REVOKE 1 cột = 42501 chết CẢ query, KHÔNG degrade êm.** Chốt bằng curl thực nghiệm trên prod. PostgREST expand `*` từ schema cache role-agnostic → luôn liệt kê cả cột bị thu quyền. Mọi migration REVOKE cột sau này: client phải narrow select TRƯỚC, xác nhận web live, RỒI mới áp REVOKE (expand-then-contract). Panel từng cãi nhau 2 vòng về điểm này — 1 lệnh curl trả lời được.
- **INSERT/UPDATE `.select()` không tham số = RETURNING \* — cũng cần SELECT privilege trên MỌI cột.** Grep cả `.select()` (không arg) chứ không chỉ `select('*')` khi rà consumer trước một column-REVOKE. Panel 4 agent + GPT-5.6 đều sót; lộ ra lúc đọc code để implement.
- **Cột bị native binary nêu tên (kể cả trong WHERE/.eq) là cột KHÔNG THỂ revoke** — user không update app. Trước mọi column-REVOKE: `grep -rn "<col>" apple/`.
- Release-pilot từ chối merge RED dù được nhắn "Cuong đã duyệt" — đúng thiết kế (agent message không phải consent). Flow đúng: orchestrator giữ kênh user thật tự merge sau khi có duyệt tường minh trong phiên.

## 2026-07-22 — auto-milestone-run (PR #432 + #433)

- **GitHub rút SARIF upload khỏi private repo free plan** → check codeql đỏ "Code scanning is not enabled" KHÔNG phải lỗi code; Settings không còn mục bật. Fix đã ship: CodeQL chạy `upload: never` + gate cục bộ `scripts/codeql-gate.mjs`. **Dismissal trên Security tab chết theo entitlement** — thay bằng `scripts/codeql-baseline.json` (ruleId+file+reason, người duyệt ghi lý do). Gate mới còn NGHIÊM hơn cũ: finding mới fail thẳng job.
- **Flake auth E2E: root cause là mint-per-test, không phải route.** Magic-link token single-use + bị generateLink sau đó cùng email vô hiệu → N worker song song tự phá nhau. Fix đúng tầng: setup-project mint 1 lần/role (vẫn chạy verifyOtp thật, fail-hard) + cache storageState + 1 canonical test tiêu thụ fresh link mỗi run. "User+link mới mỗi test" nghe an toàn hơn nhưng chính là nguồn race (risk-auditor CONCEDE có file:line).
- **Hard-fail "DUPR SSO iframe" trên CI = preview chunk-reload**, không phải CSP (trace artifact cho thấy navigation giữa assertion; CSP prod/preview đều đủ dupr, client key nướng trong cả 2 bundle). Trước khi skip/fixme một test "env-only": tải trace artifact về đọc — 15 phút đọc trace tiết kiệm một quyết định sai.
- **Đối chiếu CSP 2 tầng phải khoá bằng test**: functions/_middleware.ts tự nhận "kept in sync with public/_headers" nhưng frame-src thiếu 2 domain DUPR nhiều tháng. Comment "kept in sync" không phải cơ chế. → src/__tests__/csp-parity.test.ts (PR #433).
- **Hammer mint local khi verify lặp sẽ đập rate limit Supabase Auth** ("Request rate limit reached") — đó là throttle, không phải flake code; verify lặp phải giãn cách 45-60s. CI thật chỉ mint 4 lần/run nên không chạm.
- **release-pilot 2 lần "ngủ" không có background child sống** (chờ notification không bao giờ tới) — sau khi giao việc dài (soak/poll), orchestrator phải kiểm `ps`/output file khi nhận notification "stopped", đừng tin câu "tôi sẽ được đánh thức". Soak bị mất thay bằng soak hồi cứu: query client_errors từ mốc deploy (0 lỗi/94 phút vẫn là bằng chứng mạnh hơn 30 phút watch).
- **Review "Comment: ok" ≠ Approve** — cổng RED từ chối đúng; và GitHub còn bẫy thứ hai: bấm Approve mà quên "Submit review" thì API vẫn 0 APPROVED (pending review vô hình). Hướng dẫn Cuong đủ 2 bước.

## referee-pin (/ship 2026-07-22)

- **Component .tsx mới không test → tụt coverage global < 83% → cổng `quality` required ĐỎ** dù 1135 test pass. qa-verifier báo PASS nhưng KHÔNG enforce ngưỡng coverage như CI (`vite.config.ts` thresholds.statements=83) → chỉ lộ ở release-pilot. Bài học: thêm test cho MỌI file .tsx/.ts mới ngay trong /ship, đừng để tới release-pilot. Fix đúng = thêm test thật (không hạ ngưỡng/không sửa workflow).
- **Component test mock cả module referee-helpers → module đó 1/58 stmt covered** (mock thay code thật). Muốn phủ helpers phải có test riêng import THẬT + fake supabase client (rpc/from chainable stub). Đó mới là đòn bẩy coverage lớn nhất (helpers +57 stmt).
- **Project KHÔNG có @testing-library/jest-dom** — `toHaveTextContent`/`toBeInTheDocument`/`toBeDisabled` throw "Invalid Chai property". Dùng DOM thuần: `el.textContent).toContain()`, `el).toHaveProperty('disabled', true)`, `queryBy...).toBeNull()`.
- **`dialog.tsx` đọc `t.common.close`** cho nút X (sr-only) → mock `useI18n` cho component có Dialog PHẢI kèm `common: { close }`, không thì "Cannot read properties of undefined (reading 'close')".
- **RED rate-limit: per-user budget một mình KHÔNG đủ** — kẻ tạo nhiều acc throwaway (đăng ký free) grind được keyspace 6 số. Thêm budget per-(format,parent_id) toàn cục (correct PIN không bị đếm nên không khóa referee thật). qa-verifier bắt được cái này.
- **Migration đã áp prod trước khi merge**: khi cần sửa hàm sau (thêm rate-limit thứ 2), CREATE OR REPLACE + CREATE INDEX IF NOT EXISTS qua Management API là idempotent, an toàn re-apply.
- **GitHub Actions HẾT NGÂN SÁCH nhìn y hệt CI hỏng, và log KHÔNG nói gì.** 2026-07-27: 100/100 run gần nhất đỏ trên mọi nhánh kể cả `main`, mỗi job chết trong 2 giây với `steps: []`. `gh run view --log-failed` trả `log not found` (không có log vì job chưa bao giờ chạy). Lý do thật CHỈ nằm ở `gh api /repos/<o>/<r>/check-runs/<job_id>/annotations` → `"The job was not started because an Actions budget is preventing further use."` Cách chẩn đoán: thấy job 2s + 0 step → đọc annotations TRƯỚC, đừng đi tìm bug trong diff. Kiểm nhanh xem có phải lỗi của mình không: `gh run list --limit 10` — nếu `main` và nhánh khác cũng đỏ thì không phải PR của mình. Hệ quả im lặng: `uptime-ping` (*/10) và `deploy-guard` chết theo → mất luôn cả lớp phòng thủ blob-loss chạy bằng Actions, không ai được báo.
- **`encodeURIComponent` KHÔNG escape `(` `)`** — verify: `encodeURIComponent("a)bad(x") === "a)bad(x"` (comma thì có → `%2C`). Nhét path segment vào filter `or=(col.eq.X,col2.eq.X)` của PostgREST bằng `encodeURIComponent` là **filter injection**. Repo đã có `src/lib/escapePostgrestSearch.ts` cho lớp lỗi này (dùng ở ClubsList/VenuesList/Match/usePaginatedSearch). Với khoá **exact-match** (slug, id) thì shape-guard `^[a-z0-9-]+$` đúng hơn escape: đơn giản hơn, không có góc khuất, và từ chối input không thể tồn tại. `qa-verifier` bắt được cái này — nó đọc diff và đối chiếu với helper đã có trong repo, đừng bỏ qua bước đó.
- **Test import hook `src/hooks/*` chạm Supabase client lúc import → nổ env trong vitest node env.** Shim sẵn có: `vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }))` — đặt TRƯỚC import của module cần test (xem `useFeaturedParentTournaments.test.ts`).
- **Preview Pages KHÔNG set `CANONICAL_HOST`**, nên mọi redirect/hreflang do SSR sinh ra trên preview đều trỏ về `https://www.thepicklehub.net` (giá trị fallback ở `_middleware.ts:440`). Verify preview vẫn đọc được **status code và Location**, nhưng không đi tới đích trên chính preview được — đừng coi đó là bug.
- **Blob-loss: redeploy KHÔI PHỤC được blob đã mất** (2026-07-27, dữ kiện cho SU-429781): `og-flex-tournament`/`og-quick-table` trả `NOT_FOUND_FUNCTION_BLOB` ở gateway dù status ACTIVE → `supabase functions deploy --use-api` xong là 200 ổn định. Hàm og-* là class idle-nhất fleet, đúng hồ sơ nạn nhân blob-loss.
- **Ngay sau Pages deploy, vài isolate còn serve code cũ vài phút** — 4/18 path trả kết quả cũ với `x-prerender-cache: MISS` (tức không phải cache). Đừng kết luận fix hỏng ngay: lấy mẫu lặp 3-5 phút chờ hội tụ trước khi báo/revert. Header `X-Prerender-Cache` phân biệt được cache-cũ vs code-cũ.
- **`og-*` (og-quick-table/og-flex/og-doubles/og-tournament) là code chết trên đường share**: nút share dựng URL trang thường, `BOT_UA` trong middleware bắt zalo/facebook → bot đi qua `functions/_lib/render/*`, không bao giờ chạm edge function (function_edge_logs 7 ngày: 0 invocation). Sửa OG cho share preview = sửa `functions/_lib/render/`, KHÔNG phải `supabase/functions/og-*`. Nhưng og-* vẫn public-callable → guard privacy vẫn phải có ở cả 2 tầng.
- **Middleware chỉ cache response 200 vào KV prerender** (`_middleware.ts` ~L497). Hệ quả kép: (a) fix đổi 200→404 KHÔNG tự đè bản cache cũ — bản leak sống tới hết TTL 6h, `?nocache=1` chỉ bypass đọc chứ không xoá; (b) không có đường purge từng key trong repo (`PRERENDER_CACHE.delete` = 0 kết quả) — muốn cắt ngay chỉ có bump version toàn cục.
- **PostgREST `single: true` biến "không có bài" thành "lỗi mạng".** Header `Accept: application/vnd.pgrst.object+json` + 0 dòng → **406 `PGRST116` "The result contains 0 rows"**, và wrapper `viBlogFetch` ném Error. Nếu component route `error` → ErrorState thì bài không tồn tại sẽ hiện **"Lỗi kết nối — Thử lại"**: bảo người dùng thử lại một URL không bao giờ chạy được. Bỏ header đó thì cùng query trả `200 []` — vắng mặt là **dữ liệu**, chỉ lỗi truyền tải thật mới ném. Verify bằng curl thật: có header → 406, không header → 200 `[]`. Áp dụng cho MỌI chỗ dùng `.single()`/`single: true` để tra một bản ghi có thể không tồn tại.
- **Tách `error` khỏi `!post` là đúng, nhưng chưa đủ.** Sửa nửa vời còn tệ hơn: trước khi tách thì lỗi mạng bị gọi là "bài đã xoá"; sau khi tách mà chưa sửa nguồn 406 thì bài đã xoá bị gọi là "lỗi mạng". Đổi một nhãn sai lấy một nhãn sai khác. Luôn kiểm cả HAI nhánh bằng trình duyệt thật, không chỉ nhánh vừa sửa.
- **Gate của repo này chỉ đo nhánh BOT.** `curl -A "Googlebot"` đọc `functions/_lib/render/*`; người dùng đọc SPA `src/pages/*`. Hai bản cài đặt song song của cùng một trang, và chỉ một được verify — đó là cách 6 thẻ bài trang chủ VI trỏ vào 404 mà mọi gate vẫn xanh. Từ 27/07 có `tests/human-path.spec.ts` (project `human-path`, nằm trong `e2e:smoke`) chạy trình duyệt thật. Nó kiểm **cả status lẫn text trong body**, vì SPA trả 200 cho mọi route và render lỗi trong body — soft-404 mà status code không nhìn thấy.
- **Test chạy vào prod phải xác nhận 404 hai lần.** Request rơi đúng cửa sổ Cloudflare thay build sẽ miss 1-2 giây (đã gặp thật khi ship chính gate này). Link hỏng thật thì 404 mọi lần. Không có retry thì gate đỏ mỗi lần deploy, và gate mà người ta học cách phớt lờ thì tệ hơn không có gate.
- **Chứng minh test SỐNG bằng cách cho nó đỏ.** Cả `indexnow-slug-parity` lẫn gate human-path đều được verify bằng cách tái tạo lỗi cũ và xem test fail, rồi mới sửa. Test xanh ngay từ đầu không chứng minh nó bắt được gì.

## champion-on-event-card (/ship + release 2026-07-27) — REVERT VÌ GATE SAI, KHÔNG PHẢI CODE SAI

- **Baseline soak 24h là QUÁ NGẮN cho site nền lỗi ~2 lỗi/ngày → false positive khiến revert oan.** Release này bị revert vì soak báo "new signature" cho `message = "{}"` (`unhandled_rejection`, `/vi/tournaments`, iPhone Safari, 1 lần, không stack) 10 phút sau deploy. Truy lại 30 ngày: signature `{}` **đã tồn tại từ 2026-07-09**, 2 lần/30 ngày — nó chỉ "mới" so với cửa sổ 24h vì quá hiếm để lọt vào 24h. Luật: **cửa sổ baseline phải ≥ 30 ngày** khi nền lỗi < ~10 lỗi/ngày; "chưa thấy trong 24h" ở site ít lỗi KHÔNG đồng nghĩa "mới xuất hiện sau SHA của bạn". Đây là lỗ hổng của gate, không phải của feature — feature đã verify sạch toàn bộ (8 bước quality, preview smoke 28/28, seo-verify 40/0, curl prod đúng 2 chiều).
- **`JSON.stringify(reason)` = `"{}"` là signature RÁC, không phải signature.** `errorReporter.ts` L120-134: reason không phải Error/string thì stringify — mọi object rỗng/Event/reason non-enumerable đều đổ về đúng một chuỗi `{}`, stack `null`, `details` `null`. Nó gộp nhiều nguyên nhân khác nhau vào một signature và **không mang thông tin chẩn đoán nào**. Hệ quả: không thể quy trách nhiệm cho SHA nào. Việc nên làm (chưa làm): log thêm `reason?.constructor?.name`, `Object.keys(reason)`, và `ev.reason?.toString()` để `{}` thôi vô dụng. Lưu ý `isChunkErrorMessage` KHÔNG bắt được lớp này vì nó chỉ nhận `string`.
- **`git revert` merge squash xoá luôn file migration khỏi ledger trong khi prod vẫn giữ schema đã áp → drift ngay lập tức.** Khi migration đã áp prod TRƯỚC merge (đúng ops-runbook §1) rồi phải revert code, cột/trigger vẫn sống trên prod nhưng file SQL biến mất khỏi repo. Cột không dùng thì vô hại, nhưng ledger sai. Revert-the-revert khôi phục lại file; nếu quyết định bỏ hẳn feature thì phải xử lý schema riêng bằng tay.
- **Đừng để script soak chết âm thầm rồi đọc nhầm thành "sạch".** Bản soak tối thiểu chạy 4 poll rồi nổ `UND_ERR_CONNECT_TIMEOUT` (undici, timeout 10s) tới `api.supabase.com` ở phút ~21 — harness vẫn báo exit 0. Flake mạng không được phép đọc thành PASS **cũng không được đọc thành regression**: phải retry (4 lần, backoff) rồi mới bỏ cuộc và nói to.
- **4 phiên song song merge vào `main` trong 25 phút (#479→#483) làm việc quy trách nhiệm gần như bất khả.** Lỗi lúc 08:48Z nằm sau 3 deploy khác nhau. Trước khi revert, đọc `git log --format='%h %cI'` để biết còn ai vừa deploy — nếu lỗi ở route mình không đụng, nghi can là người khác.
- **Preview deploy dùng `x-prerender-cache` để phân biệt code-cũ với cache-cũ.** 3 poll đầu sau merge prod vẫn trả description cũ (`MISS` = không phải cache, mà là isolate chưa cập nhật) — chờ ~2 phút là hội tụ. Đúng như bài học 2026-07-27 trước đó: đừng revert ở phút đầu.
- **Tier by BLAST-RADIUS, không chỉ reversibility**: gọi việc-0 SEO-guardrail = GREEN vì "git-revert được" là SAI. `risk-tier.mjs` chấm `functions/_middleware.ts` = RED ("prerender entrypoint — bug 404s Googlebot toàn site") và `functions/_lib/render/*.ts` = RED ("SSR truth table"). Đụng 2 file đó = RED bất kể revert được, vì blast-radius. release-pilot từ chối merge đúng. Bài học: chạy `node scripts/agents/risk-tier.mjs --base origin/main` (per-file diff mode) để lấy tier THẬT — `--files "a,b,c"` gộp comma thành 1 path (fileCount:1) nên ra tier sai (chỉ khớp rule đầu). RED cần Cuong duyệt tường minh (chat approval = đủ theo pattern orchestrator-merge).
- **Guard-3 (VI-blog hreflang HTTP-check trong seo-verify.sh) bắt orphan THẬT ngay lần đầu**: PR #449 (301 free-pickleball-bracket-generator→/tools) để sót VI post THẬT trong DB `vi_blog_posts` slug `cong-cu-tao-bracket-pickleball-mien-phi-2026` (recon lúc #449 chỉ quét REPO, không quét DB → tưởng slug "không tồn tại"). alternate_en_slug của nó vẫn trỏ URL đã 301 = orphaned hreflang. BÀI HỌC: khi 301 một EN blog, LUÔN query `vi_blog_posts` tìm row có alternate_en_slug trỏ tới nó (leg thứ 5, ngoài repo, CI mù). Fix tối thiểu = set alternate_en_slug=NULL (reversible), số phận VI post để dành S1.

## 2026-07-24 — Supabase Edge Function blob-loss (`NOT_FOUND_FUNCTION_BLOB`)

**Trạng thái:** ticket Supabase Support đang mở và đã được support escalate tới Edge
Functions team. Cuong đã gửi update incident 24/7; chờ support trả lời. Không đóng
ticket chỉ vì redeploy làm function chạy lại — đây mới là mitigation, chưa có root
cause/fix platform.

**Project:** `ajvlcamxemgbxduhiqrl`.

**Bản chất lỗi:** Supabase vẫn có metadata/version và Dashboard có thể hiện function
ACTIVE, nhưng edge runtime không đọc được code blob. Endpoint trả:

```json
{"code":"NOT_FOUND_FUNCTION_BLOB","message":"Requested function was not found"}
```

Có hai failure mode đã quan sát:

1. Blob mất kéo dài cho tới khi CLI redeploy.
2. Blob 404 chập chờn rồi tự hồi phục mà không có deploy, gợi ý blob-store
   read/replication inconsistency giữa worker/POP.

**Điểm support đã xác nhận/cần diễn đạt đúng:**

- `pro-tour-ingest` bị `supabase-branching` PATCH lúc 15:26:51 UTC 22/7 với
  entrypoint `/app/...`, rồi trả blob 404. Timeline draft ghi manual deploy 15:33
  là sai; CLI deploy thật lúc 15:40:21.
- Log support còn cho thấy function trả 405/401 rồi HTTP 200 lúc 15:40:19, tức
  đã tự vào được handler **2 giây trước** CLI deploy. Đây là bằng chứng cho
  flickering/replica inconsistency, không thể kết luận CLI là thứ làm nó hồi phục.
- Các request CLI từ IP Việt Nam lúc 05:16 UTC 23/7 là remediation của mình,
  chạy sau khi `geo-check` blob-404 khoảng 05:13; không phải nguyên nhân của lỗi
  trước đó. `bundleOnly=true` là các upload con của full-fleet CLI deploy.
- Nói chính xác là “fleet-wide blob loss affecting 73/75 functions”, không khẳng
  định mọi invocation của mọi function fail liên tục suốt 6 giờ. Khi support đưa
  số success/failure aggregate, cần xin breakdown theo slug/version/POP.

**Incident mới đã gửi support — 24/7:**

- Khoảng 15:11 UTC, nút Scrape prod báo
  `Failed to send a request to the Edge Function`.
- Probe trực tiếp `pro-tour-trigger-scrape`: 12/12 GET và 6/6 OPTIONS đều
  `404 NOT_FOUND_FUNCTION_BLOB`.
- Request ID trước khi heal:
  `019f94ae-7afc-730d-a6f5-92a3436add25`; edge region `ap-northeast-2`.
- Cùng thời điểm `pro-tour-ingest` trả GET 405 đúng handler, nên lỗi chỉ nằm ở
  blob của trigger function.
- Tác động: manual Pro Tour Scrape chết ngay hop đầu
  (`browser → pro-tour-trigger-scrape`), chưa auth/admin check, chưa tạo log
  `running`, chưa gọi Cloudflare scraper, chưa ingest. Browser hiện generic fetch
  error vì cả CORS preflight cũng nhận blob 404. Cron Cloudflare gọi thẳng
  `pro-tour-ingest`, nên có thể vẫn chạy khi riêng trigger bị hỏng.

**Khôi phục đã làm:**

```bash
npx supabase functions deploy pro-tour-trigger-scrape \
  --project-ref ajvlcamxemgbxduhiqrl \
  --use-api \
  --output-format text \
  --agent no
```

Deploy cùng source, không cần sửa code. Verify sau deploy lúc ~15:20 UTC:

- 12/12 GET → 405 `{"error":"Method not allowed"}`.
- 6/6 OPTIONS → 200.
- unauthenticated POST → 401 `{"error":"Unauthorized"}`, chứng minh request vào
  handler thật.
- Cuong đã thử nút Scrape trên prod và xác nhận hoạt động.

**Cảnh báo vận hành:** local CLI ban đầu hết auth nhưng đã login lại thành công,
token CLI hiện được lưu trên máy. Workflow `Uptime ping` self-heal không dùng được:
manual run `30104415254` ngày 24/7 fail trước khi có runner (`steps=[]`,
`runner_id=0`) vì GitHub báo recent account payments failed hoặc spending limit
cần tăng. Cho tới khi xử lý GitHub Billing & plans, đừng tin watchdog Actions sẽ
redeploy; probe trực tiếp và dùng CLI local khi blob-loss tái phát.

## 2026-07-28 — native-bilingual (String Catalog VI+EN, PR #495)
- **Native gate một-locale = bài "chỉ đo nhánh bot" lặp lại.** Trước song ngữ, bundle chỉ có vi nên `xcodebuild test` vô tình chạy vi; job `-testLanguage en -testRegion US` trong apple-tests.yml là human-path của native — lần chạy đầu bắt ngay 3 file test assert VI mà 2 vòng review tĩnh (recon đếm 2 file, auditor đếm 4) đều thiếu. Tổng thật: 7 file.
- **Làm yếu assertion phải khai báo tường minh.** 4 file test đổi từ literal VI sang `String(localized:)` cùng key — giữ đúng ý test (chọn key nào) nhưng thành tautology về bản dịch; ghi rõ trong commit 0d13866e, đừng sửa lén cho xanh.
- **Helper String cục bộ là lớp mù của mọi phép đếm tĩnh** (partnerButton("Log trận") — literal trùng key đã extract từ navigationTitle nên diff-baseline không thấy). Chỉ screenshot 2 locale trên sim bắt được. Luật: mọi PR chạm chuỗi native phải kèm 1 cặp screenshot vi/en màn liên quan.
- **In-app language override: dùng per-app AppleLanguages, không dùng .environment(\.locale).** String(localized:) ngoài SwiftUI không theo environment — override kiểu environment cho app trộn ngôn ngữ. AppleLanguages seed sớm trong App.init + restart prompt = nhất quán mọi tầng.
- **Regex format-specifier: flag class không được chứa dấu cách** — "75% of players" bị đọc thành %o, chặn oan 4 bản dịch (scripts/native-i18n-gates.mjs đã fix).
- **Đòn bẩy đổi signature đo thật +457 key** (ước lượng vòng 2 +143~156) — LocalizedStringKey lan qua helper mở khóa nhiều call site hơn census AST-lite thấy; đo bằng export thật > mọi ước lượng.
- **`xcodebuild test` CÀI ĐÈ app lên sim đích** — test host (CODE_SIGNING_ALLOWED=NO) thay mất bản có ký đã cài tay → Cuong mở app dính "Auth session missing"/"keychain error" dù trước đó login tốt (28/07, sau merge #495). Luật: sau MỌI lần chạy test trên sim mà Cuong đang test tay, cài lại bản có ký (`xcodebuild build` không flag + `simctl install`); hoặc chạy test trên sim khác.
- **Python urllib/requests treo hàng phút trên máy này với call curl làm <1s** (đo 03/08: requests treo 449s, urllib treo >8 phút fetch sitemap; curl luôn ≤7.5s). Script mới đụng network → shell qua `curl --max-time` (index_coverage.py là mẫu). Script scripts/seo/ cũ dùng requests vẫn có nguy cơ treo.
- **GSC trả chuỗi bản địa hoá, không phải enum** — `coverageState` đổi theo languageCode ('vi' → "Đã được gửi và lập chỉ mục"), header CSV export theo ngôn ngữ UI ("Trang hàng đầu" chứ không phải "Trang"). Mọi parser GSC phải pin languageCode=en-US + normalize enum + hard-fail chuỗi lạ; so sánh chuỗi thô = đếm ra 0 âm thầm.
- **Gate khoá HÀM không khoá CALLER thì bug tái phát qua đường vòng** — #468 khoá buildTitle byte-safe nhưng venues.ts:306-309 tiền-kiểm `.length` rồi né hàm → 5/10 title venue prod cụt mà utils.test.ts vẫn xanh. Sửa xong một bug đếm-đơn-vị: grep mọi caller và mọi tiền-kiểm cùng hằng số.
- **Gate SEO lấy mẫu hàng khoẻ nhất là gate mù** — sweep lấy `<loc>` đầu tiên + segment sort updated_at DESC = luôn test bản ghi vừa được chăm. Floor số lượng + sample first/middle/last (ship PR #530) là thuốc; mọi gate sampling mới phải tự hỏi "mẫu này có bias về phía khoẻ không".
- **Soak baseline 24h pha loãng bởi giờ đêm — so với GIỜ LIỀN KỀ, không so trung bình 24h** (03/08: 0.23/phút nhìn như spike 6x vs baseline 24h nhưng THẤP hơn 3 giờ trước merge; repo từng revert oan vì đúng lỗi này 27/07).

## notification-bell-not-clickable (2026-07-23, PR #454 / 9e77431a)
- **Pseudo-element hit-area nuốt click**: `.tl-icon-btn::after {position:absolute; inset:-4px}` (PR #300, mở hit-area 44px) hit-test NHƯ element gốc + đè trên con trong paint order. Khi class nằm trên `<div>` bọc (UnifiedNotificationBell truyền className vào div, KHÔNG vào Button) → pseudo của div nuốt mọi pointer click, button bên trong không bao giờ nhận. Chuông chết click 2 TUẦN, không ai bắt. Keyboard vẫn sống. Fix scoped 1 dòng: `div.tl-icon-btn::after {pointer-events:none}` (chỉ div, 5 nút `<button>` thật giữ 44px). Bẫy chẩn đoán: `button.click()` JS LUÔN mở panel (bỏ qua hit-test) — chỉ click chuột thật / Playwright click mới lộ. Test regression PHẢI là e2e click thật (J11), jsdom vô dụng.
- **Coupling chí mạng: GitHub Actions artifact-storage-quota giết luôn self-heal blob-loss**. Khi quota artifact hết → job Visual/Security đỏ ở bước UPLOAD (gate thực chất vẫn success) VÀ các workflow self-heal blob (deploy-guard poll + uptime-ping) KHÔNG chạy được → Supabase blob-loss flap không được tự vá. Trong phiên này blob-loss chết 68/76 fn 2 lần (lúc ship + giữa soak), phải `supabase functions deploy --use-api` vá tay cả 2 lần (heal ~2', idempotent, 0/76 sau đó). Bài học: khi thấy blob-loss KHÔNG tự lành sau 10-15', nghi ngay Actions quota — self-heal đang chết. Fix gốc = Cuong tắt integration "Deploy to production" + giải phóng Actions storage.
- **/idea thiếu script**: `scripts/agents/debate-ledger.mjs` + `risk-tier.mjs` không tồn tại trong repo — cưỡng chế luật vòng 2 thủ công (mọi CONCEDE/REFINE kèm file:line), ghi chú trung thực vào proposal.

## 2026-08-04 — audit fact-check + đóng lỗ RLS + dựng soak-watch/risk-tier (PR #538, #539)

- **Bảng audit "khắt khe" vẫn phải fact-check từng số.** 23 claim → 12 đúng, 4 đúng-hướng-sai-số
  (i18n thật 1686 ternary chứ không phải 1017; xcstrings 1764 needs_review chứ không phải 851 —
  TỆ HƠN báo cáo), 3 sai/stale (types.ts KHÔNG thiếu bảng; coverage đã 85.92% từ CLOSE-03 nên đề
  xuất "re-base ngưỡng" là thuốc sai bệnh). Mẫu lỗi: chỗ sai đều là **trạng thái cũ** — audit viết
  một phần từ ghi chú thay vì đo tươi. Luật: điểm số của audit vô nghĩa, danh sách việc mới có giá.
- **Grep repo KHÔNG đủ để quyết định REVOKE một grant.** Trước khi revoke phải hỏi DB:
  RPC nào ghi bảng, `prosecdef` DEFINER hay INVOKER, và **INVOKER thì EXECUTE cấp cho role nào**.
  `social_event_guest_register` là INVOKER + có INSERT — nếu authenticated có EXECUTE thì REVOKE đã
  giết luồng guest OTP. Thoát vì EXECUTE chỉ cấp service_role. Chi tiết: [[event-registrations-insert-hole-closed]].
- **Drop policy phải drop CẢ CỤM, không chỉ cái thủng.** Policy còn lại mà không có grant hiện ra
  như "thiếu grant" dưới sweep `pg_policies × has_table_privilege` → lần sweep sau tự cấp lại grant,
  mở lại đúng lỗ vừa vá.
- **`scripts/agents/` chưa từng tồn tại** dù release-pilot.md + risk-auditor.md gọi 4 script trong đó
  từ lúc viết. Mọi "soak 30p 🟢" trước 04/08 là lệnh KHÔNG THỂ chạy. Bài học rộng hơn: **agent doc mô tả
  một lệnh không có thật thì agent sẽ ứng biến im lặng thay vì báo lỗi** — định kỳ kiểm mọi đường dẫn
  script trong .claude/agents/*.md có thật hay không.
- **Công cụ chống-xanh-giả tự tạo xanh giả.** qa-verifier bắt: `--minutes 0` hoặc gõ nhầm
  `--minutes abc` (`Number("abc")=NaN`) làm `while (Date.now() < deadline)` false ngay → 0 lần poll,
  0 lần gọi API, vẫn in "🟢 soak clean" exit 0. Luật cho MỌI gate mới: test trường hợp **gate không chạy**,
  không chỉ trường hợp gate pass/fail. Alarm chưa từng thấy kêu = alarm chưa tồn tại — phải ép nó kêu
  (baseline rỗng → exit 1 với 14 signature) trước khi tin.
- **ESLint không phủ `.mjs`** (`eslint.config.js` chỉ match `**/*.{ts,tsx}`) — `npx eslint file.mjs`
  exit 0 vì KHÔNG MATCH CONFIG, không phải vì sạch. Đúng cho mọi script trong scripts/.
- **`fast-xml-parser` là dep của worker con** (`workers/news-fetcher/package.json`), root `npm install`
  không kéo về → `tsc -b` + 1 suite vitest đỏ local trong khi CI xanh. Worktree còn cần symlink riêng
  `workers/news-fetcher/node_modules`. Đỏ local ≠ đỏ thật; kiểm CI trước khi đi sửa.

## 2026-08-04 (b) — DS-04 error states cho Live/News/TournamentDetail (PR #540)

- **Thêm test có thể LÀM TỤT coverage.** Test import 3 page lớn → lần đầu kéo cả cây con vào
  MẪU SỐ v8 (DoublesEliminationBracket ~280 stmt @6%, useDoublesElimination 111 @0.9%) →
  1334 test pass nhưng statements 85.92%→72.22%, gate 83% đỏ. Local chạy `vitest run` KHÔNG thấy.
  **Luật: test nào import component lớn phải chạy `--coverage` trước khi push.** Cách sửa đúng là
  stub barrel con mà test không dùng (`@/components/tournament`, `@/components/content`) → 84.32%;
  KHÔNG hạ ngưỡng, KHÔNG blanket exclude.
- **`hidden={...}` là xanh giả kiểu CSS.** `.tl-filters` có `display:flex` từ author stylesheet, đè
  `[hidden]` của UA → phần tử VẪN HIỆN trên màn hình nhưng BIẾN MẤT khỏi cây a11y, nên
  `queryByRole(...)` trả null và test PASS. jsdom không đọc stylesheet nên không unit test nào phân
  biệt được. **Muốn ẩn thì unmount, đừng dùng `hidden`** — ghi lý do vào cả component lẫn test.
- **`.single()` là bẫy của convention DS-04**: PGRST116 khi 0 dòng làm "slug không tồn tại" và
  "mạng chết" tới trang dưới cùng một `isError` → chỉ hiện được 1 thông báo cho 2 chuyện ngược nhau
  (not-found bảo người ta bỏ cuộc, network error bảo thử lại). Dùng `.maybeSingle()`. Đã ghi vào
  docs/state-patterns.md.
- **Luôn thử gỡ bản vá xem test có đỏ không.** Làm với cả 4 test ở PR này — đỏ cả 4. Test state mà
  pass ở cả hai chiều là đồ trang trí. Cùng họ với bài học soak-watch: alarm chưa thấy kêu = chưa có.
- **Checkout chính có thể đứng sau main hàng chục commit** (04/08: nhánh phiên khác, sau main 32
  commit) → mọi phép đếm/audit chạy ở đó đo nhầm cây. Audit/fact-check phải ghi rõ **commit SHA**
  mình đứng, và đo trên worktree tạo từ `origin/main` khi kết luận về "repo hiện tại".

## 2026-08-05 — `git pull` in "Updating X..Y" rồi vẫn FAIL, và deploy từ tree cũ (dính 2 lần trong 1 ngày)
- `git pull --ff-only` khi tree bẩn: in dòng `Updating <old>..<new>` TRƯỚC rồi mới abort vì "local changes would be overwritten" — `tail -1` nuốt mất lỗi, ref KHÔNG nhích. Hậu quả thật 05/08: deploy 3 edge function từ tree cũ ngay sau khi merge PR #549 (phát hiện nhờ `git log -1` in ra SHA cũ; đã redeploy đúng trong vài phút).
- LUẬT: mọi lệnh deploy-from-tree phải assert cùng câu lệnh: `[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && <deploy>` — đúng guard đã thêm vào redeploy-edge-functions.sh, áp cả cho deploy tay.
- `git checkout <branch> -- <file>` GHI ĐÈ patch chưa commit trong working tree (mất patch ops-job-control 1 lần, phải gõ lại).
- Commit với path tường minh vẫn cuốn theo file ĐANG STAGED từ trước (stash pop tự stage) — `git restore --staged .` trước khi commit có chủ đích.

## 2026-08-06 (b) — live-viewer-count-comparison: /idea + ship Option A' (PR #555)

- **Recon đếm consumer bằng grep tên file mà KHÔNG truy barrel + git log = sai 3-thành-1.** Vòng 1
  recon báo useLivePresence có 3 consumer; thật ra LiveBroadcastHero bị gỡ khỏi trang chủ từ #251 và
  LiveCardWithPresence chỉ còn trong barrel không ai lấy — 2 agent phải CONCEDE ở vòng 2 sau khi tự
  truy `components/content/index.ts` qua cả 6 caller và `git log -S`. LUẬT: kết luận "X có N consumer"
  phải truy barrel re-export tới caller thật + git log -S trước khi cho vào proposal.
- **`scripts/agents/debate-ledger.mjs` vẫn không tồn tại** — lần /idea thứ 2 liên tiếp orchestrator
  phải cưỡng chế luật vòng 2 bằng tay (ghi vào debate.json khoá `ledger_enforcement`). Viết nó hoặc
  xoá khỏi skill /idea.
- **Worktree guard chặn CẢ Bash compound** (`for`/`until`/`;` dài) trong session worktree — poll dài
  phải ghi script ra scratchpad rồi `bash script.sh` (1 lệnh đơn). Và worktree KHÔNG có node_modules:
  npx fallback lên node_modules repo chính (stale) gây lỗi ma (`fast-xml-parser` thiếu dù
  package.json@main có) — `npm ci` trong worktree (~4s nhờ cache) là bắt buộc trước tsc/build.
- **Bot PAT bị classifier chặn cả 2 đường (file + env) → release-pilot dừng đúng luật, KHÔNG mượn
  keyring user.** Đường thoát đã dùng: soạn sẵn PR body ra file + đưa Cuong lệnh `! gh pr create/merge`
  — user tự bấm bằng danh tính thật, agent chỉ watch CI/smoke/soak (đọc-only). Soak chuẩn
  (soak-watch.mjs) cũng cần PAT → chỉ chạy được soak giảm cấp uptime-poll; ghi rõ "giảm cấp" vào
  close-out, đừng để dòng soak xanh nói quá điều nó chứng minh.

---

## Venue directory data-source policy (Cường approved 2026-07-28)

**Rule:** Build the `/san` venue directory ONLY from legit sources:
- **OSM** (Overpass, license ODbL — reusable with attribution) — primary bulk source.
- **Community submissions** (`/san/them`) — how the 691 VN venues were built; owned data, no ToS risk. The real moat.
- Public association/listicle pages — selective, factual, with care.

**NEVER scrape / reproduce for the directory:**
- **Google Maps / Places API** — ToS forbids storing/caching place data to build a permanent directory. Risk: Google penalty/deindex of the whole site (would nuke the organic SEO we're building).
- **Pickleheads / PlayPickleball** (and similar) — direct competitors; their compiled venue DB is their core asset. Scraping = ToS breach + database-rights/legal risk (cease-and-desist).

**Court count / other fields:** fill ONLY when a public source states it. Never fabricate.

**Context:** OSM coverage of pickleball in Asia is very uneven (2026-07 scan: MY 24, PH 30, TH 8 workable; KR 0, ID 1, TW 2, JP rate-limited = near-empty). Comprehensive data for the empty countries lives in Pickleheads/Google → off-limits. Grow those via community submissions, not scraping.

---

## Cowork: read/edit code from a FRESH github clone, NEVER the stale mount (reinforced 2026-07-30, Cuong)

**Occurrence:** Misdiagnosed "2 newest VI posts missing from homepage" as a prerender-cache issue by reading `src/pages/Index.tsx` from the mounted repo, which sat on commit `b3569523` (a side branch whose homepage sources stories from Supabase `vi_blog_posts`). Deployed `main` actually builds homepage "Tuần này" stories from `blogMetadata` (static bilingual manifest) — a different code path that structurally cannot show VI-only posts. The stale read produced a wrong root-cause and cost a round.

**Rule:** Before reasoning about DEPLOYED behavior or editing any source file, fetch it fresh from `origin/main` (GitHub API `contents?ref=main`, or `git clone --depth 1`). The mount `/Users/cm10/pickle-hub-pro` is frequently on a stale/side branch (git HEAD may be far from `main`). Do edits in the fresh clone and push from there. Verify `git rev-parse HEAD` of the clone matches `main` before trusting any file.

**Also:** homepage VI stories (deployed main) = `blogMetadata` manifest only (EN+VI titles). VI-only Supabase posts appear on `/vi/blog` (Bảng tin) but NOT the homepage unless the homepage is changed to read `usePublishedViBlogPosts()` (branch `fix-home-vi-stories-supabase`, PR 2026-07-30).

---

## US growth: task tracker + báo cáo sau MỖI task (Cường yêu cầu 2026-08-07)

**Rule:**
- Mọi task phát triển US ghi ở **`growth-tasks/US-GROWTH-TASKS.md`** (tracker sống: STATUS + OWNER + ngày + "Nhật ký task"). Đây là nguồn sự thật cho tiến độ US; đừng để task trôi trong session.
- **Báo cáo sau MỖI task US hoàn thành** — thêm 1 dòng "Nhật ký task" (kết quả + link commit/verify) + notify Cường ngắn gọn. **KHÔNG gộp im lặng** nhiều task rồi mới báo.
- Owner: **em** (Claude) = on-page/đo GSC/content; **anh** (Cường) = backlink outreach + duyệt keyword. Đo GSC US **hàng tuần** khi Cường mở browser → ghi `US-CLICKS-GROWTH-PLAN`.
- Chiến lược: `US-GROWTH-SPRINT-2026-08-07.md` (sprint 30 lồng 90 ngày). Đòn bẩy #1 = backlink trỏ `/tools` (cụm generator đã tự leo pos ~15 không cần link).

**Cập nhật 2026-08-07 (Cường chốt):**
- Báo cáo per-task = **CHAT** là đủ (không tạo file report riêng mỗi task). Mục "Nhật ký task" trong `US-GROWTH-TASKS.md` vẫn cập nhật làm bản lưu bền.
- **Backlink**: Cường tự làm toàn bộ + **chủ động cung cấp thông tin** (đã gửi link nào, ở đâu) khi agent cần đo/theo dõi. Agent không tự đọc được hoạt động outreach → không đoán, chờ Cường đưa dữ liệu.

## VI blog posts: meta_title ≤60 bytes, meta_description ≤160 BYTES (not chars) — Vietnamese is multi-byte

**Occurrence (1 — HCMC recap VI insert, 2026-08-10):** First `vi_blog_posts` INSERT for `hcmc-open-2026-ket-qua` failed `23514` check constraint `vi_blog_posts_meta_description_seo_bytes`. meta_description was 154 chars but **176 bytes** (Vietnamese diacritics + `Đ`/`ế`/`ị`… are 2–3 UTF-8 bytes each). meta_title similarly capped.

**Constraints (live on `public.vi_blog_posts`):**
- `vi_blog_posts_meta_title_seo_bytes` → `octet_length(meta_title) <= 60`
- `vi_blog_posts_meta_description_seo_bytes` → `octet_length(meta_description) <= 160`
- `title` (the H1) has **no** byte cap — only meta_title/meta_description do.

**Rule:** When composing a VI post, size meta_title/meta_description in **bytes**, not characters. Rule of thumb: a VN string with typical diacritics runs ~1.15–1.25 bytes/char, so keep meta_title ≲ 48–50 chars and meta_description ≲ 128–135 chars, then verify:
```python
len(s.encode('utf-8'))  # meta_title ≤60, meta_description ≤160
```
Trim set-score parentheticals / drop the leading "Kết quả PPA Asia 500 …" prefix first — those buy the most bytes. The INSERT uses `WHERE NOT EXISTS` on slug, so a failed attempt leaves **no partial row** — just fix the two fields and re-run (idempotent).

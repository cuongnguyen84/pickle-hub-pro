# Devil's advocate — GPT-5.6 (risk-auditor pass)

- Ngày: 2026-07-27
- Model: `gpt-5.6` (OpenAI Responses API, gọi trực tiếp bằng `curl` vì
  `scripts/agents/ask-model.mjs` KHÔNG tồn tại trong repo — xem
  memory `idea-pipeline-missing-scripts`).
- Lưu nguyên văn: system prompt + brief + reply, không biên tập.

---

## System prompt (nguyên văn)

```
You are a hostile staff SRE reviewing a change to a live product run by one person. Your job is to find the specific failure this change causes in production. Be concrete: name the mechanism, the trigger, the user-visible symptom. Reject generic risk language. If the change is genuinely safe, say so plainly and briefly.
```

---

## User prompt / brief (nguyên văn, self-contained — model KHÔNG đọc được repo)

````markdown
# Change under review: "champion on event card"

## Product
ThePickleHub — a bilingual VI/EN pickleball platform, ~2,000 real users, ~95% Vietnamese,
built and operated by ONE person (solo operator, no on-call rotation).

Stack: React 18 + Vite SPA on Cloudflare Pages. Cloudflare Pages Functions do bot-only SSR
prerendering into a KV cache. Supabase Postgres + Supabase Edge Functions (Deno, ~75 of them).
Capacitor/native SwiftUI iOS app ships separately through App Store review.

## The proposed change
When a community tournament reaches status `completed`, display the champion (player or
team name) in three places:
1. The card in the list page `/tournaments` (Community tab, plus a "featured multi-event" card).
2. The event detail page.
3. The Open Graph share preview (shown in Zalo/Facebook/Messenger link previews).
If no champion can be determined, hide the line entirely.

Scope: three tournament tables — `quick_tables` (formats `round_robin` and `large_playoff`),
`doubles_elimination_tournaments`, `flex_tournaments`. Native iOS parity is mandatory.

## The data model, as it actually is (verified against production today)

- No denormalized champion column anywhere. Champion must be derived from child match rows.
- `quick_table_matches`: columns include `is_playoff bool`, `playoff_round int`,
  `player1_id`, `player2_id`, `score1`, `score2`, `winner_id`, `status`, `score_version bigint`
  (optimistic-lock column).
- Champion for quick tables = winner of the match with MAX(playoff_round) where
  is_playoff AND status='completed'.
- `doubles_elimination_matches.winner_id` FKs to `doubles_elimination_teams`.
  `doubles_elimination_teams` has a `final_placement int` column that EXISTS but is
  NULL on all 178 rows — never written by anything.
- `flex_matches.winner_side`; flex is an explicitly "custom/arbitrary" bracket format
  where the notion of "the final" is not defined by the schema.

## Production numbers (queried live, today)

- `quick_tables`: 108 rows total, ALL `is_public = true`. 88 are `status='completed'`.
- Of those 88 completed: 84 are `round_robin`, 4 are `large_playoff`.
- Only 24 of the 88 have ANY playoff match at all. Only 23 have a completed final with a
  winner. The 4 `large_playoff` rows have ZERO matches (empty/abandoned).
- => a champion is derivable for 23 of 88 completed events (26%). 65 cards show nothing.
- The 64 completed round-robin events with no playoff have 2, 3, 4, 6 or 8 GROUPS
  (group_count distribution: 2→23, 3→11, 4→34, 6→7, 8→9). There is no single winner
  by construction; only per-group standings.
- `doubles_elimination_tournaments`: 5 rows, ZERO completed.
- `flex_tournaments`: 5 completed public; 2 of them have any decided matches.
- `quick_table_players`: 1,096 rows, `name` is FREE TEXT typed by the organizer
  (not linked to a user account). 744 distinct names.
- Across 210 completed playoff matches, `winner_id` and `score1>score2` agree 100%
  (0 disagreements, 0 ties).

## Existing prior art the team almost missed

A Postgres function `surface_quick_table_results(uuid)` already exists and runs daily via
pg_cron at 06:00 UTC. For every quick table completed in the last 36h it:
- finds the final (MAX playoff_round, status='completed'),
- decides the winner by comparing `score1 > score2` (NOT by reading `winner_id`),
- inserts rows into a public `matches` table with `is_public=true`,
  `verification_status='verified'`,
- creates "ghost profile" rows in `public.profiles` with `is_ghost=true` and a
  deterministic id `md5('tphtg:'||lower(trim(name)))::uuid`, so the organizer-typed
  free-text player name becomes a public profile row.
- 556 such ghost profiles are already visible in the public profiles view today.

So one definition of "who won the final" already exists in SQL, keyed on score comparison.
The new feature would add a second definition, in TypeScript, keyed on `winner_id`.

## Row-level security, as it actually is

- `quick_tables`: SELECT allowed when `is_public = true` OR you are the creator.
- `quick_table_players` / `quick_table_matches`: SELECT allowed via an EXISTS subquery
  against the parent table's is_public/creator check. Correct, but it means the RLS
  predicate runs per row.
- `doubles_elimination_tournaments` / `_teams` / `_matches`: SELECT policy is
  literally `USING (true)` — no is_public column exists on that table at all.
- `flex_*`: gated by `can_view_flex_tournament(tournament_id, auth.uid())`
  (is_public OR creator). 18 flex tournaments are `is_public = false`.

## The OG (share preview) functions

Each format has its own public Supabase Edge Function (`og-quick-table`,
`og-flex-tournament`, `og-doubles-elimination`, `og-tournament`), all with
`verify_jwt = false`. Each:
- sniffs the User-Agent for known crawler strings; non-bots get a 302 redirect,
  bots get a small HTML document with title/description/og:* meta tags,
- queries Supabase using the **SERVICE ROLE key** (bypasses all RLS),
- returns `Cache-Control: public, max-age=60`.

`og-flex-tournament` selects the `is_public` column but never checks it — it will happily
render name + player count + match count for the 18 private flex tournaments to anyone
who sends a crawler User-Agent string.

## Bot SSR / prerender cache

Cloudflare Pages middleware (`functions/_middleware.ts`) serves crawlers from a KV cache
keyed `pr:v32:${pathname}` with a 6h TTL, rendered by per-route handlers. Changing SSR
output requires bumping the version prefix (v32 → v33), which invalidates EVERY cached
path for EVERY route at once (blog posts, venue pages, news, tournaments, rankings...).
On a cache MISS the middleware runs a chain of Supabase queries against a Tokyo region
with an 8-second budget; on timeout it falls through to the empty SPA shell.

Important: the tournament *detail/tool* pages already emit
`<meta name="robots" content="noindex, follow">`. The `/tournaments` list page IS indexed,
but its SSR handler only lists rows from a separate `tournaments` table (pro tour events),
not the community brackets this feature is about.

## Client data flow on /tournaments

`src/pages/Tournaments.tsx` calls ~11 `useQuery` hooks unconditionally on mount, regardless
of which tab is active. That includes `useCompletedPublicQuickTables({limit:100})`,
`useCompletedDoublesElimination({limit:100})`, `useCompletedFlexTournaments({limit:100})`,
`useCompletedTeamMatchTournaments({limit:100})`. The default tab is "featured"; the
completed lists are behind two clicks but their queries still fire on first paint.

Measured on production with EXPLAIN ANALYZE as the `anon` role, the additional query
"fetch all playoff matches for the 100 most recent completed public quick tables" costs
35.6 ms planning + 86.3 ms execution, 880 shared buffer hits, with the RLS EXISTS subplan
executed 196 times (once per returned match row). Vietnam mobile RTT to the Supabase region
is typically 150–400 ms per round trip.

## Operational context that matters

- There is a LIVE, UNRESOLVED Supabase platform incident (ticket SU-429781): edge function
  code blobs get evicted per-region and fail to re-fetch, returning
  `NOT_FOUND_FUNCTION_BLOB` 404s. Confirmed mechanism: a function that receives no traffic
  for roughly 30–90 minutes gets its blob evicted from an edge node; the re-fetch from the
  blob store fails; the function 404s until a new deploy rewrites the blob. Functions with
  steady traffic are never affected. Mitigation in place: a watchdog that probes canaries in
  3 regions and triggers a fleet redeploy, plus an hourly uptime-ping that redeploys all
  ~75 functions. Function versions are already around 500.
- A CI "deploy guard" redeploys changed edge functions on every push to main. Touching a
  shared module redeploys all ~75 functions.
- Bundle budget is CI-enforced: total gz JS 1970 KB ceiling, currently ~1822 KB.
  First-paint INITIAL budget 280 KB, currently ~265 KB.
- The SLOs that exist: web availability 99.5%; auth 99%; registration 99%;
  scoring "score save + bracket propagation persists, 99.5%, ZERO lost-update incidents —
  a lost bracket slot is an incident, not a rate"; cron 100% monitored-healthy;
  Vietnam mobile p75 LCP ≤ 2.5s / INP ≤ 200ms / CLS ≤ 0.1; push ≥95%.
- `doubles_elimination_matches` already has an AFTER UPDATE trigger
  `advance_doubles_elimination_after_score` that propagates the winner to the next round.
- The iOS app selects explicit column lists (never `SELECT *`) and ships through App Store
  review; old versions stay installed on user devices indefinitely.
- Database migrations cannot be undone by `git revert`; there are no automatic
  down-migrations in this project.

## Your task
Name the specific ways this change breaks production. Mechanism, trigger, user-visible
symptom. If a class of failure here is genuinely not a concern, say so plainly.
Pay attention to failure modes a Claude-family reviewer would plausibly under-rate.
````

---

## Reply (nguyên văn)

## Verdict: reject as currently specified

The quick-table portion is implementable read-only. The cross-format and OG portions are not safely defined. The concrete production failures are:

### 1. Private flex champions will leak through share previews

**Mechanism:** `og-flex-tournament` uses the service role and does not enforce `is_public`. `verify_jwt=false` plus User-Agent sniffing is not authorization.

**Trigger:** Anyone requests a private flex tournament URL while sending a Facebook/Zalo crawler User-Agent.

**Symptom:** The response exposes the private tournament name and, after this change, the champion’s name. A real social share can then publish that information in its preview.

This is already leaking tournament metadata; adding a person’s name materially worsens it. Fix authorization before adding champion output. Return 404/noindex for non-public tournaments, regardless of User-Agent.

---

### 2. Organizer-controlled names can inject markup into OG HTML

**Mechanism:** Quick-table player names are unrestricted free text. Edge functions commonly construct meta tags with string interpolation. React and SwiftUI escape text, but raw HTML templates do not.

**Trigger:** A champion is named something like:

```text
"><meta property="og:title" content="Hacked">
```

or includes `&`, `<`, `>`, `'`, or `"`.

**Symptom:** Broken or attacker-controlled Zalo/Facebook previews. With more aggressive payloads, crawler-UA requests receive stored HTML/script injection from the Edge Function origin.

Every champion value inserted into HTML attributes must be HTML-attribute escaped. JSON escaping is not sufficient.

---

### 3. Flex has no valid champion derivation

**Mechanism:** `flex_matches.winner_side` says who won a match, but the schema provides no definition of which arbitrary match is “the final.”

**Trigger:** Code chooses a heuristic such as latest match, highest round-like value, or last decided match.

**Symptom:** A completed flex tournament displays the wrong person/team as champion.

Hiding the line for all flex tournaments is safe and conforms to “if no champion can be determined, hide it.” Claiming flex support without adding an explicit canonical final/champion concept is not.

---

### 4. Doubles support will silently produce nothing or eventually guess incorrectly

**Mechanism:** `final_placement` exists but is NULL on every team. No completed doubles tournaments currently exercise the feature. Therefore a `final_placement = 1` implementation appears harmless in testing while being nonfunctional.

**Trigger:** The first doubles tournament becomes completed.

**Symptom:** No champion appears despite a completed bracket. If code instead guesses the final without a schema-backed final identifier, it can display the winner of the wrong match.

The existing advancement trigger does not make `final_placement` usable. Do not modify that trigger for a display feature; a regression there creates lost bracket slots, which is explicitly an incident.

---

### 5. The obvious list implementation adds latency to every `/tournaments` visit

**Mechanism:** The page already starts all completed-event queries regardless of active tab. Adding “all playoff matches for the latest 100 completed quick tables” therefore runs on first paint even when the user never opens Community.

The measured database cost is about 122 ms before network time, with the RLS subplan running 196 times. Vietnam adds 150–400 ms RTT.

**Trigger:** Any visit to `/tournaments`, including the default Featured tab.

**Symptom:** The champion-dependent card arrives roughly hundreds of milliseconds later; if loading states are aggregated, the whole card area waits or flickers. Every visitor also pays the query and mobile-data cost for content hidden behind two clicks.

Do not fetch all playoff matches. Fetch the champion only for IDs actually rendered, preferably through one security-correct SQL/RPC query returning one row per event. Do not use a hard-coded “latest 100” pool: once there are more than 100 events, an older featured event will incorrectly lose its champion line.

---

### 6. The cron and UI will have two conflicting winner definitions

**Mechanism:** The existing SQL publication path uses `score1 > score2`; the proposed TypeScript path uses `winner_id`.

**Trigger:** A score correction, legacy write, or partial scoring failure updates scores without updating `winner_id`, or vice versa.

**Symptom:** The tournament card names one champion while the verified public match/ghost profile created by the cron names another.

There is no mismatch in production today—210/210 completed playoff matches agree—so this is not an immediate data incident. It becomes a real failure once two independently maintained definitions ship. Put the derivation in one SQL function/view and use it from both the cron and presentation paths.

Do not derive through `public.matches` or ghost profiles: the cron runs only daily and only processes recently completed events, so cards would be absent or stale until the cron runs.

---

### 7. OG previews will be stale after corrections

**Mechanism:** `Cache-Control: max-age=60` only governs caches honoring that response. Facebook, Messenger, and Zalo maintain their own scrape caches, often much longer.

**Trigger:** A URL is shared before the final result is entered, or the score/champion is corrected after the first scrape.

**Symptom:** The web detail page shows the corrected champion while the social preview continues showing no champion or the old champion.

This needs an explicit re-scrape/cache-busting operational story. A 60-second header does not provide one.

---

### 8. The known Edge Function incident makes OG delivery intermittently fail

**Mechanism:** These low-traffic OG functions are exactly the functions affected by `NOT_FOUND_FUNCTION_BLOB` after 30–90 minutes without traffic.

**Trigger:** A social crawler requests an affected regional function after its blob has been evicted but before the hourly redeploy repairs it.

**Symptom:** The crawler receives a 404 and generates no rich preview, so the promised champion preview is absent.

This change does not cause SU-429781, but it cannot honestly claim reliable OG support while depending solely on the affected path. Touching a shared Edge Function module also redeploys all ~75 functions; avoid doing that merely to share champion formatting code.

---

### 9. Free-text names can break card layouts

**Mechanism:** Champion names have no stated length or character constraints.

**Trigger:** A long unbroken name, repeated emoji, or organizer-entered text with unusual Unicode.

**Symptom:** Horizontal overflow, oversized cards, truncated controls, or materially different web/iOS layouts.

Use bounded lines, `min-width: 0`, overflow wrapping/truncation, and equivalent SwiftUI line limits. Do not “fix” stored organizer names by joining through normalized ghost-profile names; unrelated players with the same normalized free-text name collapse to the same deterministic ghost identity.

---

## Things that are not production failures

- Showing no champion for 65 of 88 completed quick tables is correct under the stated requirement. Most are multi-group round robins with no single winner.
- The four empty `large_playoff` events should also show nothing.
- Doubles has zero completed rows today, so it causes no immediate visible regression.
- A strictly read-only champion query does not threaten optimistic locking, score persistence, or bracket propagation.
- No database migration is required. Because iOS uses explicit column lists, an additive column would not normally break old clients, but adding a denormalized champion column is unnecessary.
- The Cloudflare prerender version does not need to change. Community cards are not in the indexed list SSR output, and detail pages are already `noindex`. Bumping `v32` to `v33` for this feature would needlessly flush every route and cause cache-miss query bursts and timeout-generated empty bot shells.
- React and SwiftUI text rendering are not the HTML-injection problem; the raw OG HTML templates are.

## Minimum safe scope

Ship quick-table champions only, using a single canonical SQL derivation, queried only for displayed event IDs. Enforce public visibility in every OG function and HTML-escape names. Hide champions for flex and doubles until their schemas define a canonical champion. Release web and the reviewed iOS build under an explicit parity plan; old installed iOS versions cannot literally gain this UI without updating.

---

## Thẩm định của risk-auditor (không chép nguyên xi)

Xem mục "Phản biện độc lập" trong `round1/risk-auditor.md` để biết luận điểm nào
đã xác minh được trong repo và luận điểm nào bị bác.

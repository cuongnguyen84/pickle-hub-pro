# Codex Review Request — 2026-07-16 session

**Range:** `3637ab66..0a5d76ed` (20 squash-merged PRs #322–#341 + 2 hotfixes, 67 files)
**All merged to `main`, all CI green** (quality, smoke, pgTAP, Apple tests, Deploy guard, Edge auth parity). Three migrations are **already applied to production and ledgered** — review findings on them need forward fixes, not reverts.

Review stance requested: adversarial. Each section lists what to attack. Docs-only PRs (#326, #332, #334–#336, #338, #341) are listed at the end for factual spot-checks only.

---

## 1. Race-condition fixes (highest scrutiny)

### #324 DB-01 — atomic event/slot capacity (`supabase/migrations/20260716090000`, `reactivate-registration`, `phone-otp-verify`)
- Two RPCs (`social_event_reactivate_registration`, `social_event_guest_register`) serialize capacity writes with `pg_advisory_xact_lock(hashtextextended('event_capacity:'||event_id, 0))`; check+write in one transaction; SECURITY INVOKER; service_role-only EXECUTE.
- Deliberate: each caller keeps its historical active-row predicate (`cancelled_at IS NULL` vs `status <> 'cancelled'`) — semantics preserved, only atomicity added.
- Evidence: pgTAP 18/18 (`event_capacity_rpc.test.sql`) on fresh replay; two-connection repro (second session blocked ~2.4s → `event_full`, count stayed at max).
- **Attack:** hash collisions across events sharing a lock (accepted: advisory lock collision = serialization, not corruption — confirm); the `event_missing` path; unique-violation → `already_registered` mapping breadth (any unique violation maps there — is that ever wrong, e.g. profile_id unique?); reactivation's unguarded unique-violation (pre-existing 500 path, deliberately unchanged); cancel paths intentionally lock-free.

### #329 DB-02a — DoublesElimination R3→R4 slot claim (`DoublesEliminationBracket.tsx`)
- Replaced stale-props first-empty-slot scan + unguarded UPDATE with fresh R4 read + guarded claim (`.is(field, null)`), plus re-propagation idempotency guard (winner already seated → return).
- **Attack:** the fresh-read/claim window (guard makes the claim atomic per slot; loser advances to next slot — verify loop covers "all slots taken"); re-scored match whose WINNER CHANGES still leaves the old winner seated (known, documented as organizer-manual — confirm acceptable); client-side writes still under RLS as the referee user — verify UPDATE policy allows the guarded form.

### #330 DB-02b — match-confirm DUPR dedupe (`match-confirm/index.ts`)
- Verify UPDATE now `WHERE verification_status='pending'` + RETURNING; only the winner runs `autoSubmitToDupr` + notifications; loser reports `already_verified_concurrent`.
- **Attack:** the CLB `confirmation_status` patch rides the same guarded UPDATE — if a match were verified WITHOUT the CLB fields set (other surface), the loser path skips patching them. We believe fetch-time `!== "pending"` rejection makes that unreachable; falsify if you can. Also: the loser's own `match_participants.confirmed` update already happened — confirm no user-visible inconsistency.

## 2. Money/notification paths

### #322 BE-02 — push broadcast (`send-push-notification` split + `AdminPushNotification.tsx`)
- Server-side recipient resolution (`broadcast: true`), `dry_run` counts for the confirm dialog, 1000-row pagination (`order(id)` + `range`), FCM chunks of 50 via `Promise.allSettled`, UNREGISTERED prune. Auth gate unchanged. 8 vitest cases.
- **Attack:** pagination stability under concurrent token churn (order(id), page drift); prune false-positives (404 vs `errorCode UNREGISTERED` detection against FCM v1 reality); the OAuth token memoized per-request (3600s exp — fine for one request?); internal callers' `user_ids` contract unchanged — verify.

### #328 QA-08 — payment handlers extraction (`create-payment-order/handler.ts`, `mark-payment-claimed/handler.ts`)
- Claimed **zero behavior change**: every status code/body/log step preserved; one narrowed contract — secret-lookup DB error now 500 `secret_lookup_failed` (was already 500 in original; the adapter previously wrote had a 401 bug that was fixed pre-merge — verify final code). 18 vitest cases; exactly-once organizer push invariant.
- **Attack:** diff the handler logic against the pre-split index.ts (`git show 3637ab66:supabase/functions/create-payment-order/index.ts`) line by line for contract drift; the unique-violation matching by message substring (`reference_code` / `registration_id`) — column names appearing in OTHER error messages.

## 3. Product rule change

### #325 + #327 — MLP total-score winner (`src/lib/teamMatchResult.ts`, `TeamMatchRepository.computeMatchResult`, both scoring sheets, `TeamMatchScoring.tsx`, `TeamMatchView.tsx`)
- Cuong's rule: total-score mode ON → higher cumulative total wins, decided only when EVERY game has a decided score; equal totals → no winner. Default mode unchanged (games majority). 10 mirrored tests per platform.
- **Attack:** "every game decided" uses `a !== b` — a legitimately 0-0-final game is impossible in to-N scoring, confirm no format allows ties; dreambreaker rows are included in the sum — intended? completed matches recompute on next save only — any surface reading `winner_team_id` stale vs totals?; the `total_score_mode` flag threading (TeamMatchScoring fetches via `select('*')` because generated types lag — regenerate types later?).

## 4. Security migration (LIVE IN PROD)

### #331 SEC-05 — `supabase/migrations/20260716120000`
- `search_path='public'` pinned on 3 blog definer functions; `error_alert_dedup` RLS'd + API-role grants revoked; 11 gated RPCs: `REVOKE FROM PUBLIC, anon` + explicit `GRANT authenticated, service_role`.
- **Attack:** enumerate callers of each of the 11 (we verified web/native/edge callers are authenticated — falsify, especially `get_table_registration_emails`, `lookup_user_by_email` on native, `find_profile_by_phone` in CreateGhostProfileModal); anything anon-facing that breaks (blog counts verified still serving); pgTAP `sec05_hardening.test.sql` asserts repo-wide invariants — check the assertions can't go stale-green.

## 5. Frontend hygiene batches

### #339 QA-01 — 30→0 exhaustive-deps (22 files)
- Three classes: useCallback for pure helpers/loaders; 8 justified `eslint-disable-next-line` sites (each with an inline reason); 2 real bug fixes (DoublesEliminationScoring keys on `user?.id` not `user`; useChatMessages reconnect reads latest timestamp via `latestMessageAtRef`).
- **Attack:** each useCallback dep list (stale-closure vs loop); the DoublesEliminationBracket auto-trigger effects gained deps (`isAssigningR3`, hook fns, parent callbacks) — the `hasTriggeredR3Ref`/`matchStatusKey` guards must make refires no-ops, verify no double `checkAndAssignR3`; GroupBlock deselect-all regression was CONFIRMED and already fixed in `0a5d76ed` (default-select keys on teamsInGroup only again) — verify the fix; CommentSection now deps `userInfoCache` (loop-safe via early return — verify).

### #337 A11Y-01/03 — skip link, route focus, reduced motion (`App.tsx`, `SkipToContent.tsx`, `index.css`, `smoke.spec.ts`)
- **INCIDENT (already hotfixed, review the fix):** the original `#main-content` wrapper broke prod scrolling site-wide for ~40 minutes. `html/body/#root` are `overflow:hidden` + `position:fixed`; pages scroll inside their own containers, and the un-sized wrapper between `#root` (flex column) and the pages collapsed every page's height chain. Hotfix `7804167d` makes the wrapper `flex min-h-0 w-full flex-1 flex-col`; verified by rendering prod and driving a scroll. **Review asks:** (1) is the flex geometry now exactly equivalent to pre-#337 for ALL route layouts (TheLineLayout pages, admin, full-page scoring)? (2) why didn't Playwright smoke catch it — the suite asserts render + console errors but never scrolls; consider requiring a scroll assertion. (3) our local verification for #337 tested skip-link focus but not scroll — process gap noted.
- **Attack:** `#main-content` div wraps ALL routes incl. modals-as-routes — focus steal on PUSH navigations that open sheet-like routes (`/tools/team-match/match/:id/score`)? global reduced-motion `!important` near-zero durations — anything relying on transition timing (Radix exit animations, toast auto-dismiss)?

### #340 BASE-02 — funnel instrumentation (`src/lib/journeys.ts`, `RegistrationModal.tsx`, `CreateSocialEvent.tsx`)
- Contract: `docs/north-star-journeys.md`. Envelope in one lib; completion once per journey_id; steps dropped outside active journey; failure codes = edge functions' structured codes.
- **Attack:** PII leak paths (we send `event_id` + enums only — verify no free-form strings reach `trackEvent`); `startJourney` on every modal `open` change (re-opening = new denominator per contract — confirm no double-start on re-render since effect deps `[open]`); organizer `creation_started` fires once per mount via ref — but page remount (route re-entry) mints a new journey, intended; `journeyPropsRef` pattern staleness; GA4 event-name/props match the contract doc exactly.

## 6. CI/infra

### #323 HOT-05 — auth context memoized on `[user, session, loading]`; handlers reference module-level client only. **Attack:** anything reading handler identity or depending on re-renders.
### #333 — bundle budget 1950→1970 KB stopgap #2; ratchet rule now in `docs/perf-budgets.md`. **Attack:** nothing — but confirm the ratchet wording is enforceable.

## Deliberate non-fixes (do not report as findings)
- `find_profile_by_phone` keeps authenticated EXECUTE (feature need; logged-in enumeration accepted, revisit on telemetry).
- DoublesElimination re-score winner-change cleanup stays manual.
- quick_table advancement (deterministic column mapping) and cancel paths left lock-free per DB-00 verdicts (`memory: db-00-race-verdicts`).
- 5 SECURITY DEFINER views intentionally definer (PII-lockdown read surfaces).
- Playwright smoke deploy-race transient on main (hit 5× today, rerun-green every time) — known, separate backlog item.

## Verification inventory
- Vitest 735 pass / 10 skipped (31 new tests today); pgTAP 6 files / 70 assertions on fresh `db reset`; Apple tests 52/52 in CI; production build + 1970 KB guard green.
- Prod probes recorded in roadmap completion log per task (DB-01 RPC probe, SEC-05 grant matrix, BE-02 401 gate, A11Y smoke assertions ran against prod after deploy).
- Owed manual checks: admin push broadcast end-to-end; first live GA4 funnel events.

## Incident log (this session)
- 2026-07-16 ~14:2x ICT: prod scroll broken site-wide by #337's focus wrapper (deployed ~13:5x). Detected by Cuong manually. Hotfix `7804167d` pushed direct-to-main; prod re-verified scrolling via scripted browser check. Follow-ups for review: add a scroll smoke assertion; treat layout-chain edits under `#root` as requiring a real-browser scroll check before merge (runbook §5 addition pending).

# idea-recon — auto-milestone-run-2026-07 (nguyên văn, 2026-07-21)

## Prior art

- **This exact idea is already mid-flight.** `docs/proposals/auto-milestone-run-2026-07/00-intake.md` (created 2026-07-21 21:51, today) contains a fuller version of this same intake — same 6 milestones, same table, already answers "who/pain/success" without asking Cuong. `round1/`, `round2/`, `external/` sibling dirs exist but are **empty** — panel analysis hasn't run yet. Don't re-intake; the panel step is what's missing. *(Ghi chú orchestrator: intake đó do chính phiên này vừa viết ở Bước 0/1 — không phải duplicate.)*
- No mechanism anywhere in the repo makes a future session "wake up on date X." The only date-triggered automation is GitHub Actions `schedule:` cron (`.github/workflows/{dupr-refresh,lighthouse,migration-drift,security,theline-audit,edge-auth-parity}.yml`) — all fixed-interval CI jobs, none of them start an agent session or read a roadmap doc.
- The closest thing to a cross-session "todo queue" is the Telegram command queue: `scripts/ops/telegram_queue.py` (Supabase `telegram_commands` table, webhook-pushed) + `notify_telegram.py`/`telegram_poll.py`. It's Cuong-initiated (he sends a message), not date-triggered.
- Milestones today live only in `.claude/memory/` (this session's own `MEMORY.md`) — proven to leak: intake §"Ràng buộc" cites soak checks for PR #407/#409 that never ran because of session-limit cutoff.

## Touch surface (likely)

- `docs/proposals/auto-milestone-run-2026-07/round1/`, `round2/` — where the actual panel debate belongs (currently empty).
- `.claude/memory/MEMORY.md` — wherever the mechanism ends up, it has to survive here or somewhere more durable.
- `docs/roadmap-8.5-9.md:230,364,375,389` — canonical milestone table already has PERF-05 row and the owed-work note; any new mechanism should write status back here, not invent a parallel tracker.
- `.github/workflows/playwright.yml:132-149` — existing Telegram-on-CI-failure pattern to copy for OPS-04.
- `scripts/check-theline.mjs` Rule 4 (advisory→HARD switch — currently `advisory.push` line ~155, needs to move to `hard.push` after 2026-08-01, gated by nothing automatic today).

## Data

- **QA-04**: no DB table, GH PR #431 (`chore/wire-e2e-auth-secrets`, OPEN, draft, 1 file changed). CI right now: `smoke` FAILURE (3 flaky: `/feed` title race, `tests/a11y.spec.ts:224` filter-pill contrast — axe hits "execution context destroyed" from navigation, `auth.spec.ts:102` `/match/confirm` — `verifyOtp failed: Email link is invalid or has expired`; 1 hard fail: `auth.spec.ts:76` DUPR SSO iframe modal), `codeql` FAILURE, everything else (lighthouse/quality/npm-audit/visual/Cloudflare) green.
- **OPS-04**: `error_alert_dedup` table + `ops_cron_alert_state` table (per `docs/ops-runbook.md:120,212-219`); alert function `supabase/functions/errors-telegram-alert/index.ts` (10-min cron, threshold 3 occurrences/10min, 60min dedupe).
- **PERF-05 / funnels (#5, #6)**: **no Supabase table** — `trackEvent` (`src/utils/ga.ts:32`) only calls `window.gtag`, GA4-only. `src/lib/journeys.ts` wraps this for `organizer_tournament` steps; `reg_count_badge_impression` fires from `src/pages/Tournaments.tsx:272`. Reading either requires GA4, not SQL. `scripts/seo/ga4_report.py` exists but only reports sessions/pageviews/top-pages/channels/countries — **does not** query custom event params (journey steps, badge impressions). Would need extension.

## Binding constraints found

- `docs/roadmap-status-2026-07-21.md` — QA-04/OPS-04 marked "UNBLOCKED 2026-07-21"; PERF-05 earliest ~2026-07-24; UX-07 funnel gate ~2026-08-02 is a **decision gate**, not busywork (D5 unresolved).
- `scripts/check-theline.mjs:1-30` header — Rule 4 explicitly "Report-only during trial window; promote to HARD after 2026-08-01 if no false positives" — manual judgment call, not auto-flippable.
- `CLAUDE.md` JWT ES256/HS256 and blog checklist — not directly touched by this meta-task.

## Test coverage today

- `tests/playwright.yml` smoke suite covers the exact 3 flaky groups named in the ask (feed, contrast, match/confirm) — live-reproduced above. No test covers "did the milestone doc get updated on schedule" (there's nothing to test — no scheduler exists).

## Unknowns worth asking Cuong

1. Should the panel just resume in the existing empty `round1/`/`round2/` dirs, or is a fresh proposal wanted?
2. Is a human-in-the-loop trigger (Cuong pastes "check milestones" via Telegram queue) acceptable, given no in-repo scheduler exists — or is external cron (e.g., GitHub Actions `workflow_dispatch` + `schedule` opening an issue) in scope?
3. For funnel reads (#5/#6), is extending `ga4_report.py` for custom-event params acceptable, or does Cuong want to read GA4 UI by hand as before?

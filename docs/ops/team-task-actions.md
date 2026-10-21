# Telegram task execution — 22 September 2026

`/xuly T28,T29` and **Xử lý ngay** operate on the existing task IDs. The bridge
records an internal `team execute` control; it does not send bare IDs to an
engineering model. Invalid batches are rejected before any item is queued.
Repeated clicks do not duplicate active work. Task collectors retain ownership
of finding resolution; action progress is stored separately as `action:<id>`.

The owner authorized **automatic deployment of ordinary code fixes** on
22 September. The installed ledger records `ordinary_code_autodeploy=true` and
the authorization text. This does not authorize payment/auth/migrations,
unverified ranking imports, or incomplete bilingual blog publication.

## Execution

- A task report and the morning digest expose an action button for each displayed
  open task. `/tien_do` paginates the rest.
- Analytics milestones use fixed read-only GSC/GA4 adapters. T28 measures both
  exact queries by page; an inconclusive result schedules another measurement
  in four weeks. Measuring is not a production change or an SEO success claim.
- Tasks with an owner decision return that precise action instead of trying to
  solve an account/token decision with generated code.
- Ordinary code: prepare a scoped patch, apply it to current `origin/main` in an
  isolated checkout, install dependencies without lifecycle hooks, run typecheck,
  tests and production build, and verify the tested files match the commit.
  Publish a PR and wait for CI on that exact head. Main must still match the
  validated base before merge. Then verify the exact merged SHA is Cloudflare's
  active production deployment and smoke-check the public homepage.
- If automatic deployment is disabled, the PR receives a revision-bound
  **Duyệt triển khai** button. Stale approvals cannot merge a changed head.
- Failures produce a durable Telegram result. Interrupted actions are not
  silently replayed. An interrupted merge is reconciled by reading the PR.

## Current limits

Code execution requires the Claude file-editing adapter; the existing Codex
adapter is report-only. Markdown proposals are not publishable application
patches. Editorial publication needs the existing reviewed content mechanism.
WPR still requires a manual source comparison under `docs/milestones.md`;
clicking its action does not supply verified player data or source permission.
GA4 and /san measurements retain their remaining review/tracker steps explicitly.

## Validation and installation

111 Python controller tests and 11 Telegram presentation tests passed; frontend
typecheck passed. Live GSC queries and exact Cloudflare deployment lookup passed.
The webhook function `ops-job-control` and both local v2 launch agents were
updated. Unrelated differences between the installed supervisor and repository
were preserved. The original T69 request was repaired into a control referring
to T28/T29, retaining its original request and failure evidence.

Runtime location: `team-v2/installation.json` under
`~/Library/Application Support/PickleHub`. Backup:
`team-v2/backups/actions-20260922-085413` (previous installation metadata,
launch-agent plists, and a consistent SQLite backup). Reports and delivery
receipts remain in the existing ledger; no historical quota or attempts were reset.

## Session recovery and execution receipts — 22 September, 21:25 ICT

The 09:03 restored terminal session corresponded to Codex thread
`01a0c6c0-c65c-7321-a990-f45554a6b572`. Its last turn stopped on a usage limit
after editing the T27 receipt flow, before validation and installation.

Completed and deployed that follow-up:

- An accepted click says **ĐÃ NHẬN / CHỜ BẮT ĐẦU** and changes its original
  button into a progress link. Pending control records appear in progress before
  the next supervisor tick; active and closed tasks retain their existing state.
- The controller sends **ĐANG XỬ LÝ** and publishes a running snapshot before
  execution. Snapshot failure is recorded without dropping the accepted work.
- Verification commands cannot interrupt an active execution. Owner-completion
  buttons only appear for tasks with an owner decision.
- Measurement follow-ups display their actual next scheduled date in ICT.

Validation: 114 Python tests, 14 Telegram presentation tests, application
TypeScript check and `git diff --check` passed. Deployed `ops-job-control` and
installed runtime `releases/20260922-212539/scripts/ops`. Both launch agents loaded
with `RunAtLoad`, exited successfully, and published a fresh remote snapshot.
The installed supervisor's unrelated differences were preserved. SQLite,
installation metadata and launch plists were backed up under
`backups/receipts-20260922-212539`.

T27 had already measured GA4 at 09:01 ICT and delivered result message 4972.
It remains `waiting_followup`, scheduled for 29 September at 09:01 ICT; this is
a measurement result, not a completed performance fix or production deployment.

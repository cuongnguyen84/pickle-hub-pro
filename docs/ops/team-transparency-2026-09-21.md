# Agent progress audit — 21 September 2026

At inspection, the live ledger contained 13 open tasks: 7 `open`, 5
`awaiting_review`, 1 `needs_review`; no `running` or `queued` tasks. The owner's
bulk request is T62 / XL149. Its first isolated draft attempt failed with
`draft_model_failed`. Monitoring continued, but the work queue only consumes
`queued` Telegram/scheduled tasks. No automatic continuation consumes these
13 outstanding items. This change does not claim to implement that missing
execution/review pipeline or complete the backlog.

## Live changes

- `/tien_do` (also `/tien-do`) reports counts, actual execution state, blockers,
  responsibility and whether a completion date exists. Five tasks per page;
  navigation covers the whole ledger. `/tien_do xong` exposes closed tasks.
- Detail pages expose full notes, source-note freshness, next steps and owner
  decisions. Synchronization time is explicitly separate from task progress.
- Inline Telegram buttons carry the actual task ID: details, saved report and
  priority for a fresh queued task only. The webhook checks the existing chat
  and owner identity before dispatch. No callback evaluates arbitrary commands.
- T21 links to the existing authenticated reports screen for the rights decision.
  T26 links to Instagram sources and explains that Meta credentials need secure
  reauthorization. Neither is falsely marked resolved by clicking a button.
- New-task acknowledgements explicitly distinguish receipt from execution and carry
  an XL tracking button. Control acknowledgements no longer claim hourly business
  execution. Failed tasks appear before ordinary backlog on the overview.
- Other ordinary bot replies and supervisor outbox messages include navigation.
  Report/action buttons never infer permission to deploy from model prose.
- All 13 open tasks have reviewed next-step notes. Measurements from September
  13–15 are explicitly historical, not presented as new measurements.
- Isolated draft success/failure preserves original request evidence and remote
  ID. Historical Telegram IDs can also be recovered from the stable dedupe key.
- No-heartbeat snapshots use the epoch instead of inventing a current heartbeat.
  Staleness checks cover both heartbeat and snapshot age.

Runtime source was backed up and atomically replaced under the supervisor lock:
`~/Library/Application Support/PickleHub/team-v2/backups/progress-20260921-093410/`.
The backup includes the SQLite ledger. Runtime remains the existing September
15 release location. The scoped `ops-job-control` Edge Function was deployed.
Snapshot publication is a control-plane write; no extra notification was sent.

## Verification

- 9 Vitest tests: pagination coverage, payload bounds, callback allowlist,
  stale state, decision links, completed-task access, honest idle state.
- 51 Python controller/content tests: includes source-evidence retention,
  unknown heartbeat and per-response navigation.
- TypeScript check of the pure progress module and `git diff --check` pass.
- Post-deployment function status ACTIVE and published snapshot checked separately.
  All live task detail pages and navigation payloads rendered successfully; longest
  response was 2,083 characters, below the Telegram limit.
- A real Telegram click round trip has not been generated in this session;
  callback routing is covered locally. Existing authenticated webhook handles it.

## Remaining execution work

T21 and T26 need owner-controlled information/access. T27–T30 need current
measurements and milestone acceptance; T41 needs job diagnosis; T45/T56 need
editorial review; T47/T52 need reconciliation of partial publication and remaining
automation; T55 needs a current calendar answer; T62 needs an actual continuation
workflow. No completion date has been established for that work. The report
must keep these visible rather than calling all outstanding tasks “in progress.”

## Follow-up: close the owner-action verification loop (10:03 ICT)

The owner resolved the moderation report in `/admin/reports` at 09:41 ICT.
The previous daily-only community collector had not seen it. A successful read
at 10:03 verified no unresolved reports; T21 is now `resolved`, its obsolete
owner decision was cleared, and Telegram receipt **4722** confirms delivery.
T26 still has expired-token errors on **8/8** active sources. Updated guidance
with actual Meta/Supabase destinations was delivered, receipt **4723**.

The runtime now reconciles community reports every five minutes alongside the
existing fast checks. It treats `reviewed` as unfinished even if `resolved_at`
is set by the admin UI. Verification checks source statuses, not that a link
was clicked or that the user said the repair was complete.

- `team verify T<id>` reads a finding's actual collector without a model call.
- `team owner_done T<id>` records the owner's reported action and requests a
  recheck; it never directly resolves the finding.
- For Instagram, each active source must have a recent successful sync. After
  an owner-action request, every source's evidence must also be newer than that
  request. The existing sync runs at minute `:20`; polling runs every five
  minutes while the host is awake. Old errors are not presented as a failed
  new repair. If fresh results never arrive, the follow-up is a cron/collector
  investigation for the team, not another demand for a token.
- A verified resolution clears stale instructions, sends a deduplicated result
  and continues monitoring. Recurrence reopens the same ID and sends an update.
- Observation failures preserve the last business state and explicitly say
  verification is unavailable. Findings no longer cycle resolved/open on every
  successful sweep or reset their progress timestamps just because polling ran.
- Durable transition markers survive a crash between state update and reply
  generation. Progress-note/notification writes are transactional. Control
  commands remain queued until their reply is durable.
- Recheck buttons on code/content drafts without a collector are not offered;
  manually calling the control returns the missing acceptance-check requirement.
  This is not an autonomous implementation/deployment pipeline for all drafts.

Backing up the prior runtime and SQLite ledger under the supervisor lock:
`~/Library/Application Support/PickleHub/team-v2/backups/verification-20260921-100336/`.
The runtime/source files match, the published snapshot exposes the new states,
and a subsequent unattended heartbeat/snapshot was observed at 10:04 ICT.

Validation: **64 Python tests + 10 Vitest tests**, pure-module TypeScript check,
and diff whitespace check pass. Live T21/T26 rendered payloads were 1,038 and
1,632 characters; callback payloads round-trip locally. No synthetic Telegram
user click or false report that the owner renewed the token was generated.

Token guidance is based on the deployed `feed-embeds-sync` configuration
(`IG_ACCESS_TOKEN`, `IG_USER_ID`, Instagram through Facebook Login),
[Meta's published API collection](https://www.postman.com/meta/instagram/folder/u4g5a2a/instagram-api-with-facebook-login),
and [Supabase's production-secret instructions](https://supabase.com/docs/guides/functions/secrets).
The token value is never collected through Telegram. The bot provides a help
control for locating the existing Meta app; renewing account authorization
still requires the owner's Meta access.

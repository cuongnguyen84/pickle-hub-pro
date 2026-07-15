# View-event tracking contract

Status: SEC-02 hardened on 2026-07-15

## Measurement purpose

`view_events` measures sustained video/livestream page engagement and feeds the aggregate `view_counts` shown in product and creator/admin analytics. One client tick represents 30 seconds on a watch surface. The browser batches ticks every 60 seconds and caps each target session at 20 ticks.

This is engagement telemetry, not a unique-view metric. The existing 30-second server dedup window remains unchanged so the SEC-02 security work does not redefine historical reporting.

## Event contract

| Field | Source | Rule |
|---|---|---|
| `target_type` | Client | Must be `video` or `livestream` |
| `target_id` | Client | UUID and must resolve in the corresponding server-side table |
| `source` | Client | `embed` or normalized to `direct` |
| `viewer_user_id` | Server | Valid optional JWT; anonymous calls store `null` |
| `organization_id` | Server | Read from the resolved video/livestream row |
| `is_replay` | Server | `true` only when the resolved livestream status is `ended` |
| `viewer_ip` | Server | Forwarded request IP; used for anonymous dedup |

The client no longer sends user, organization, or replay state. Older deployed clients may still include those properties, but the parser discards them before validation or insert.

## Abuse and privacy controls

- POST only; 32 KiB body limit; at most 20 events per batch.
- Invalid target type/UUID is rejected before database insert.
- Target existence and organization are verified through service-role reads.
- Duplicate identity + target events inside 30 seconds are not inserted.
- Atomic fixed-window limit: 120 submitted ticks per authenticated user per 10 minutes; 600 per anonymous IP per 10 minutes. The anonymous allowance is intentionally higher for shared NATs.
- Rate-limit identities are SHA-256 hashes. The short-lived limiter table stores no raw user id or IP and deletes windows older than two days.
- Only `service_role` can call the limiter RPC. The old permissive `view_events` INSERT policy is removed; production already had no anon/authenticated INSERT table grants.

## Baseline and validation

The pre-change production baseline was 2,701 events in 30 days: 1,841 authenticated and 860 anonymous. The highest observed identity bucket was 15 accepted events per 10 minutes, leaving substantial headroom below the new limits.

Production contract verification against `batch-view-events` v44:

- valid anonymous event: HTTP 200, inserted once;
- immediate repeat: HTTP 200, deduplicated;
- target-type/id mismatch: HTTP 400;
- 21-event batch: HTTP 413;
- spoofed `viewer_user_id`, `organization_id`, and `is_replay` were ignored; the stored row used anonymous user, target organization, server-derived replay state, preserved `embed`, and recorded a server IP;
- the verification row and its aggregate count increment were removed after the assertion so analytics stayed clean.

Database migration `20260715160000_view_event_rate_limits.sql` was transaction-tested before apply and is recorded in the production migration ledger. The pgTAP regression is `supabase/tests/view_event_rate_limit.test.sql`.

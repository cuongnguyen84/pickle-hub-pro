# Supabase support ticket — edge function code blobs intermittently lost

_Draft for Cuong to file at https://supabase.com/dashboard/support/new (plan: paid).
Attach: this timeline + any forensics-*.json snapshots from the session tmp dir._

---

**Subject:** Edge Functions intermittently lose their code blob (NOT_FOUND_FUNCTION_BLOB) — 6+ incidents in 24h, full-fleet outage

**Project ref:** `ajvlcamxemgbxduhiqrl` (region ap-northeast-1)

**Severity:** High — one incident took down all ~75 edge functions for ~6 hours (auth email hook, OTP, payments, webhooks).

## Symptom

Functions whose dashboard status is ACTIVE start returning:

```
HTTP 404
{"code":"NOT_FOUND_FUNCTION_BLOB","message":"Requested function was not found"}
```

`GET /v1/projects/ajvlcamxemgbxduhiqrl/functions/<slug>/body` returns
`{"message":"Function store not found"}` — i.e. metadata exists, code blob does not.

Redeploying via CLI (`supabase functions deploy --use-api`) restores them
immediately, until the next incident.

## Timeline (UTC, 2026-07-22 → 23)

| Time | Event |
|---|---|
| 22/07 15:26 | `pro-tour-ingest` bumped to v578, entrypoint `file:///app/...` (platform-side deploy, not ours) — blob missing |
| 22/07 15:33 | Manual redeploy → OK |
| 22/07 18:45 | ~1 min after a push to our repo's main: **73/75 functions blob-less** (fleet outage ~6h) |
| 23/07 00:47 | Manual fleet redeploy → OK |
| 23/07 ~02:00 | 3+ functions blob-less again (~5 min after another push) |
| 23/07 ~02:45 | 45 functions blob-less (minutes after we disabled the GitHub integration "Deploy to production" toggle) |
| 23/07 ~04:1x | 2 functions blob-less after another push (our CI self-heal caught it) |
| 23/07 04:22 | We disabled Branching entirely (`DELETE /v1/projects/{ref}/branches` → 200, branches now `[]`) |
| 23/07 ~05:13 | `geo-check` blob-less AGAIN — with GitHub integration **and** Branching both disabled, and **zero** GitHub Actions runs in the window |

## Why we believe it is platform-side

- Broken deploys carry entrypoint `file:///app/supabase/functions/...` — the
  path your git-integration/branching builder uses (our CLI deploys show
  `file:///home/runner/...` or local paths).
- `pro-tour-ingest` reached version ~580 while sibling functions sit at ~390 —
  something platform-side has been redeploying it on every push for weeks.
- The final incident (05:13 UTC 23/07) happened with the GitHub integration
  disabled, Branching disabled, and no CI activity — nothing on our side
  deploys in that state.

## Questions

1. What is redeploying our functions from the `/app/` builder after both the
   GitHub integration and Branching were disabled?
2. Why do these deploys register metadata without a code blob?
3. Can you purge whatever queued/stuck sync state remains so it stops?

## Current mitigation (ours)

CI self-heal: sweep every function after each push + periodic watchdog; any
`NOT_FOUND_FUNCTION_BLOB` → full fleet redeploy via CLI. This bounds outages
to minutes but is a workaround, not a fix.

## Update 06:30 UTC 23/07 — second failure mode: FLICKERING 404s

Besides the persistent losses above, we now observe SHORT-LIVED blob 404s
(no deploy events at all, both integrations disabled, zero CI activity):

- 06:00:1x — our cron caller got NOT_FOUND_FUNCTION_BLOB from
  `pro-tour-ingest`; the same function answered normally by 06:08.
- ~06:14-06:19 — `geo-check` returned blob-404 (CORS preflight failures
  across our site); answered normally again at 06:22 **without any
  redeploy from our side**.

This looks like intermittent read failures against the function blob
store (ap-northeast-1) rather than deploy-pipeline corruption alone.

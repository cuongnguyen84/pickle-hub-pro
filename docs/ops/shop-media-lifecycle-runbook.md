# Runbook — Shop product media lifecycle

> Owner: Cuong · Introduced with P2a.2 (`feat/shop-production-phase-2a`)
> Status: **not deployed**. Everything below has been exercised against a local
> stack only. No migration has been applied to production and the function has
> not been deployed.

## Five things that are not the same thing

Most incidents in this area come from treating one of these as another. Say
which one you mean, every time.

| # | Thing | Where it lives | Who can change it |
|---|---|---|---|
| 1 | **Database row** | `public.product_media` | seller (limited columns), transitions, admin |
| 2 | **Private original** | bucket `shop-product-media-draft`, `<shop_id>/<product_id>/<media_id>/original` | owner/manager of that shop |
| 3 | **Public rendition** | bucket `shop-product-media`, `<shop_id>/<product_id>/<media_id>-v<n>.webp` | **service role only** |
| 4 | **Queued cleanup** | `public.shop_media_cleanup_jobs`, state `pending`/`in_progress` | the worker |
| 5 | **Completed cleanup** | same table, state `done`, `completed_at` set | the worker |

"The image is gone" is ambiguous and has meant all five. Ask which.

## Consistency model

- **Database visibility — immediate.** Unpublish, reject, archive and shop
  suspension clear `public_path` inside the same transaction. From commit,
  `public_products` and the media policies serve nothing, to anyone.
- **The object itself — asynchronous.** The same transaction writes a row to
  `shop_media_cleanup_jobs`. Until the worker runs, **a person who already has
  the URL can still fetch the file.**
- **Operational default (configuration, not a product SLA):** worker every 5
  minutes, target p95 deletion within 10 minutes. Retry ladder 1m → 5m → 25m →
  2h → 10h → capped 24h, 8 attempts, then `failed`.
- **Storage errors never count as success.** A job is marked `done` only after
  Storage confirms. An object that is already absent is a success.

If someone needs "gone within N seconds", that is a new decision and a
different design (signed URLs with short TTL on the public surface, at a real
cost to CDN and SEO — the trade D1 explicitly declined).

## Daily / on-call: is the queue healthy?

```sql
SELECT * FROM public.shop_media_cleanup_health;
```

| Column | Healthy | What it means when it is not |
|---|---|---|
| `pending` | small, moving | growing → the worker is not running |
| `due_now` | ~0 | consistently > 0 → cron is not firing |
| `stuck` | 0 | > 0 → a worker died mid-job; reconcile returns them |
| `failed` | 0 | > 0 → Storage refused 8 times; investigate before retrying |
| `oldest_failure_at` | null | how long an object has outlived its revocation |

Detail for a specific failure (admin JWT or `psql`):

```sql
SELECT id, bucket_id, object_path, reason, attempts, next_attempt_at, last_error
FROM public.shop_media_cleanup_jobs
WHERE state IN ('failed', 'pending') AND attempts > 0
ORDER BY attempts DESC, created_at
LIMIT 50;
```

`last_error` is truncated to 500 characters and has query strings stripped, so
a signed URL cannot land in it. **If you ever see a `token=` in there, that is
a bug — report it, do not paste the row into Telegram.**

## Retrying safely

Retry is idempotent by construction: the worker deletes the object, then marks
the job. Re-running a job whose object is already gone succeeds.

```bash
# One drain pass, out of band. Same thing cron does every 5 minutes.
curl -sS -X POST "https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/shop-media-lifecycle" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"action":"cleanup"}'
```

To put failed jobs back in the queue after fixing the cause:

```sql
UPDATE public.shop_media_cleanup_jobs
SET state = 'pending', attempts = 0, next_attempt_at = now(), last_error = NULL
WHERE state = 'failed' AND id = ANY($1);   -- name the ids; never a blanket UPDATE
```

## Reconciling the database against Storage

```bash
curl -sS -X POST ".../functions/v1/shop-media-lifecycle" \
  -H "Content-Type: application/json" -H "x-cron-secret: $CRON_SECRET" \
  -d '{"action":"reconcile"}'
```

It does two things and nothing else:

1. Returns jobs left `in_progress` for more than 15 minutes to `pending`.
2. Queues objects nothing points at — public objects older than 1 hour with no
   `public_path` referencing them, private objects older than 24 hours with no
   media row. The grace periods exist so a copy that is mid-flight toward its
   commit is never swept out from under itself.

It never deletes anything directly and never touches an object that is in use.

## Orphans

An orphan is normal, not an incident: a seller abandons an upload, or a publish
copies bytes and the commit fails. Reconciliation queues them on its next pass.

Only investigate if `orphans_queued` is large and repeating — that means
publishes are failing between copy and commit. Look at
`shop-media-lifecycle` logs for `commit_failed`.

## A suspended or closed shop

Suspension already revokes: `shops_revoke_media_on_state_change` clears every
`public_path` for that shop and queues each object. Verify:

```sql
SELECT count(*) FILTER (WHERE public_path IS NOT NULL) AS still_public,
       count(*) FILTER (WHERE state = 'pending')       AS queued
FROM public.product_media m
LEFT JOIN public.shop_media_cleanup_jobs j ON j.media_id = m.id
WHERE m.shop_id = $1;
```

`still_public` must be 0 immediately. `queued` drains within the operational
window above.

## Storage API outage

1. Do not disable the cron. Jobs accumulate as `pending` and back off; that is
   the designed behaviour.
2. Do not mark jobs `done` to clear the alert. A `done` job with a live object
   is exactly the state this system exists to make impossible.
3. Watch `shop_media_cleanup_health.failed`. Once Storage returns, requeue the
   failed ids and run one manual drain.
4. If the outage runs past a few hours and a specific image must be gone now,
   the honest lever is unpublishing the whole shop (`shops.state`), which is a
   database change and therefore immediate.

## Permissions

| Task | Needs |
|---|---|
| Read the health view / job rows | admin JWT (aal2) or `psql` |
| Drain or reconcile | `CRON_SECRET` |
| Delete an object by hand | service role — **last resort only** |

**Never run cleanup with a public/anon client**, and never hand the service key
to anything that also takes user input. `shop-media-lifecycle` is the only
component that holds the service role over these buckets, and that is the point
of it.

## Hand deletion is not the normal flow

If you find yourself deleting objects in the Supabase dashboard, something in
the pipeline is broken — fix that instead. A hand deletion leaves the job row
behind, and the next worker pass will mark it done for an object it did not
delete, which quietly hides whatever was actually wrong. If you must, delete
the object **and** close its job with a note:

```sql
UPDATE public.shop_media_cleanup_jobs
SET state = 'done', completed_at = now(), last_error = 'manual: <ticket>'
WHERE id = $1;
```

## What is still manual after P2a.2

- **Deploying the function and scheduling the cron** — not done, see the status
  note at the top.
- **`cron_secret` in vault** must exist before the schedule can fire; it is the
  same secret the other cron-only handlers use.
- **Seller-facing upload UI** is step 6 of P2a: the canvas re-encode, per-file
  progress, retry, and the error copy. Until then the contract is enforced but
  nothing calls it from a screen.

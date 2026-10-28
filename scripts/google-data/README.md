# Google data pipeline (GSC + GA4) — runbook

Fetches weekly Search Console and GA4 snapshots **on the Mac** (the
service-account key never leaves this machine), commits them into the repo
under `data/google/`, where Bot SEO reads them for the Monday 08:00 weekly
report.

## One-time setup (Cường)

1. Service-account key (JSON) saved at `.claude/secrets.local.gsc-ga4-sa.json`
   in the repo (git-ignored; never commit it). Override the location with
   `--key <path>` or `$GOOGLE_DATA_SA_KEY` if it ever moves.
2. Grant the service account access:
   - Search Console property `sc-domain:thepicklehub.net` → add the SA email
     as a user with **Restricted** permission (enough for Search Analytics).
   - GA4 property `522556358` → add the SA email as **Viewer**.
   - In GCP project `thepicklehub-dee20`, enable **Google Search Console
     API** and **Google Analytics Data API**.
3. Verify access (also creates the local venv on first run):
   `./scripts/google-data/run.sh --selftest`
   Expect `SELFTEST: PASS` with the property listed. If it fails, the
   output says which side (GSC or GA4) and why.
4. Install the schedule (Mondays 07:15 local):
   ```
   cp scripts/google-data/com.picklehub.google-data.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.picklehub.google-data.plist
   ```

## Manual run

```
./scripts/google-data/run.sh            # fetch + write + commit + push
./scripts/google-data/run.sh --no-commit  # write snapshots only (inspect first)
./scripts/google-data/run.sh --selftest   # permission check only
```

Snapshots land in `data/google/gsc-<date>.json` and `data/google/ga4-<date>.json`
(date = run date, Asia/Ho_Chi_Minh).

## What the snapshots contain

- **GSC**: 28 days ending 2 days before the run (Search Console lag), plus
  the previous 28 days — totals (clicks/impressions/CTR/position), a per-day
  series (`daily`: date/clicks/impressions/CTR/position for the current
  window), top 25 queries, top 25 pages, and up to 15 pages losing the
  most clicks.
- **GA4**: 28 days ending yesterday — daily sessions/users/views, totals,
  top 25 pages by views, top channels by sessions, and a per-day
  sessions/users series by referral source (`daily_by_source`:
  date/source/medium/sessions/users for facebook.com, m.facebook.com,
  l.facebook.com, lm.facebook.com, x.com, t.co, google and (direct) —
  sum the Facebook rows for total Facebook sessions on a day).

## Behaviour notes

- The commit touches **only** the two snapshot files (pathspec commit), so
  an unrelated dirty working tree can neither block it nor leak into it.
- Exit codes: `0` ok (or snapshots unchanged), `2` key missing / selftest
  failure, `3` git add/commit/push failure — push failures are printed to
  stderr and the log, never swallowed. Log: `~/Library/Logs/picklehub-google-data.log`.
- Dependencies live in `scripts/google-data/.venv` (created automatically by
  `run.sh` from `requirements.txt`: `google-auth` + `requests`). Nothing is
  installed globally. Delete `.venv` to force a rebuild.

## Remove

```
launchctl unload ~/Library/LaunchAgents/com.picklehub.google-data.plist
rm ~/Library/LaunchAgents/com.picklehub.google-data.plist
```

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
./scripts/google-data/run.sh            # fetch + write + commit onto origin/main + push
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

- **Push path (since 2026-11-05).** The snapshot commit is built with git
  plumbing on top of a freshly fetched `origin/main` — temp index →
  `write-tree` → `commit-tree -p origin/main` → `git push origin
  <sha>:refs/heads/main`. The checkout's branch, HEAD, index and dirty files
  are never touched, so the job works whatever branch
  `/Users/cm10/pickle-hub-pro` is on; nobody has to stay on `main`. Only the
  two `data/google/*` files are in the commit. If main moves between fetch
  and push the push is rejected and retried on the new tip (up to 3 times —
  the rebase equivalent). **Never force-pushed.** After a successful push the
  working-tree copies are deleted if the current branch doesn't track them
  (otherwise the next `git pull`/merge of main aborts with "untracked working
  tree files would be overwritten"); they arrive with the next pull of main.
- Exit codes: `0` ok (or `origin/main` already has identical snapshots),
  `2` key missing / selftest failure, `3` git fetch/commit/push failure —
  printed to stderr and the log, never swallowed. Log:
  `~/Library/Logs/picklehub-google-data.log`. On exit 3 the snapshot files
  are still in `data/google/` of the checkout; rerun
  `./scripts/google-data/run.sh` once the cause (network, auth) is fixed —
  the data is re-fetched and pushed.
- **Why exit 3 happened on 2026-11-02.** The old code did a pathspec
  `git commit` on whatever branch the checkout was on, then
  `git push origin HEAD:main`. The checkout was on
  `feat/tournament-assistant-float`, which is not a fast-forward of main, so
  the push was rejected (non-fast-forward) and the snapshot commit
  (`b3ab4917`) stayed stranded on the feature branch. Those 2026-11-02 files
  were copied onto main by the PR that introduced the new push path.
- **TLS / certifi.** python.org macOS builds have no CA bundle, and launchd
  runs with a clean environment, so HTTPS failed with
  `CERTIFICATE_VERIFY_FAILED` or hung. `run.sh` exports `SSL_CERT_FILE` from
  the venv's certifi, and `_ensure_ca_bundle()` in the Python repeats the fix
  for direct `python fetch_google_data.py` runs (missing or bogus path →
  certifi; a valid path is left alone). Keep both.
- Dependencies live in `scripts/google-data/.venv` (created automatically by
  `run.sh` from `requirements.txt`: `google-auth` + `requests`). Nothing is
  installed globally. Delete `.venv` to force a rebuild.

## Verify after a Monday run (no secrets needed)

```
launchctl list | grep com.picklehub.google-data     # 2nd column = last exit, want 0
tail -5 ~/Library/Logs/picklehub-google-data.log   # "git: committed (origin/main; ...)"
git fetch origin main && git log --oneline -3 origin/main -- data/google
```

Dry-run the push logic without the SA key or network:
`cd scripts/google-data && python3 -m unittest test_fetch_google_data` —
it builds throwaway local repos (feature-branch checkout, main moved,
push race) and never touches GitHub.

## Remove

```
launchctl unload ~/Library/LaunchAgents/com.picklehub.google-data.plist
rm ~/Library/LaunchAgents/com.picklehub.google-data.plist
```

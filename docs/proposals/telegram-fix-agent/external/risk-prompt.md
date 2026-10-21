# Brief: Telegram "Fix" button spawns an autonomous AI ops agent

## The product
ThePickleHub — a Vietnamese pickleball web platform. ~2000 real users. Built and
operated by exactly ONE person (Cuong). Stack: React SPA on Cloudflare Pages,
Supabase Postgres + 80 Deno Edge Functions, several Cloudflare Workers (news
scraper, pro-tour scraper), GitHub Actions for CI and for ops "repair" workflows,
Capacitor + native iOS app, Mux livestream, FCM push, Resend email.

## What exists today
A Telegram bot ("TPH AI Support") is the operator's console. A Supabase Edge
Function `ops-job-control` receives Telegram webhooks. Facts about it, verified
by reading the source:

- Webhook auth: Telegram is configured with `secret_token = SHA256(CRON_SECRET)`
  (hex). The function accepts the request if header
  `X-Telegram-Bot-Api-Secret-Token` equals that hash. Otherwise it falls back to
  requiring the `x-cron-secret` header. So the Telegram webhook secret is
  *derived from* the same CRON_SECRET used by every internal cron caller.
- Authorization: the only check is `chat_id === TELEGRAM_CHAT_ID` (Cuong's
  private chat with the bot). There is no per-user check beyond that; from_id
  and from_username are recorded but never validated.
- Every inbound message is INSERTed into a Postgres table `telegram_commands`
  (columns: update_id, chat_id, from_id, from_username, text, status, result).
  Messages matching `/start|help|jobs|retry|diagnose|functions|probe|fix` are
  handled inline by the Edge Function. **Any other text** is inserted with
  status='pending' and the bot replies literally: "Đã vào hàng đợi — agent sẽ xử
  lý ở lần chạy tới" ("queued — an agent will handle it next run").
- A pg_cron job runs every minute and calls the function to drain the queue,
  but the drain query filters to that same slash-command allowlist. So
  free-text rows accumulate as `pending` forever today.
- `/fix <job>` currently: probe edge runtime; if the job's edge function is
  `missing_blob` → dispatch a GitHub Actions workflow that redeploys that one
  allowlisted function from branch `main`; if runtime is fine → call a
  SECURITY DEFINER RPC `ops_request_job_retry` which only supports jobs whose
  executor is `pg_net` (it re-executes the stored pg_cron command text). Jobs
  whose executor is `cloudflare_worker` or `github_actions` return
  `{ok:false, code:'retry_not_supported'}`. There is a 10-minute cooldown
  enforced by an advisory lock + a "no running/dispatched request in last 10
  minutes" check.
- The operator runbook states as a deliberate limit: "the bot does not fix
  application logic, change data, merge PRs, or deploy unapproved code…
  Telegram cannot pass arbitrary shell commands."

## The proposed change
Pressing 🛠 Fix in Telegram (or sending free text) should spawn an autonomous AI
coding agent — Claude Code in headless mode, `claude -p "<prompt>"` — **on
Cuong's personal Mac**, which is always on. The agent would:

- diagnose the failing job by reading the repo and querying production,
- take real production ops actions: retry a job, redeploy an Edge Function or a
  Cloudflare Worker from `main`, re-enable a disabled GitHub Actions workflow,
  UPDATE rows in the monitoring tables when it judges the monitor itself wrong,
- then post a verdict back to Telegram: "fixed / not fixed + root cause".
- Target SLA: 5–10 minutes per invocation. It is explicitly NOT allowed to
  change application code — code bugs get reported for human approval.

The Mac already has, in the shell environment or in plaintext files:
- `~/Downloads/secrets.local.md` (7.6 KB) containing the Supabase service-role
  JWT, the Supabase Management API PAT (`sbp_…`), a GitHub classic PAT for a
  machine account with Write on the repo, Telegram bot token, Cloudflare token.
- An authenticated `gh` CLI session that authenticates **as Cuong's own GitHub
  account** (keyring OAuth, scopes repo+workflow) — meaning anything it does on
  GitHub carries Cuong's identity, including PR approvals.
- Authenticated `wrangler` (Cloudflare) and Supabase CLI.
- A helper script that, if `SUPABASE_SERVICE_ROLE_KEY` is not in env, greps the
  plaintext secrets file with a regex for the first `eyJ…` JWT and uses it.

## Critical ambient fact discovered during this audit
There is an existing launchd job on that same Mac,
`com.picklehub.edge-redeploy-hourly`, StartInterval 3600. It runs a shell script
that does `cd /Users/cm10/pickle-hub-pro` and then, with no `git pull`, no branch
check and no clean-tree check, enumerates every directory under
`supabase/functions/*/index.ts` **in the working tree as it currently sits** and
runs `supabase functions deploy <name> --use-api` for each. Log shows it firing
hourly, most recently deploying 80/80 functions.

At the moment of this audit that working tree is checked out at a local `main`
that is **41 commits behind `origin/main`**, has an unresolved merge conflict,
has uncommitted edits to two edge functions, and is missing three edge-function
directories that exist on `origin/main`. So the next hourly fire will push
day-old code for 77 functions to production, silently.

## Alternative under consideration
Instead of an AI agent: just extend the existing hard-coded `/fix` branches so
that `executor='cloudflare_worker'` triggers a `wrangler`-equivalent action (a
GitHub Actions workflow_dispatch that redeploys that worker from `main`), and
`executor='github_actions'` re-dispatches its workflow — the same allowlisted,
auditable, cooldown-guarded pattern already used for `missing_blob` repair. No
agent, no new prompt surface, no new credentials in play.

## Your job
Find the specific, concrete production failures the AI-agent proposal causes.
Name the mechanism, the trigger, the user-visible symptom, and say which is
worse than the alternative. Be specific about: the prompt-injection / account-
takeover path; what happens when two Fix presses overlap; unbounded token spend;
the Mac rebooting mid-run; whether headless Claude Code can do any of this
without `--dangerously-skip-permissions` and what that flag removes; rollback.
If some of my concerns are overblown, say which and why.

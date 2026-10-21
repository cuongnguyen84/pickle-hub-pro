# Telegram policy (owner decision 20/10/2026)

Cuong's Telegram gets real incidents instantly and everything else in two
**Grok Bot digests at 08:00 and 21:00 (Asia/Saigon)**. Every message starts
with `[Grok Bot]`; instant alerts read `[Grok Bot] 🔴 …`, recoveries `[Grok Bot] ✅ …`.

## Instant (deduped per incident, one recovery message)
| Source | Rule |
|---|---|
| `uptime-ping.yml` | GitHub probes `/` and `/feed` twice; first red run of an outage pages, next green run sends "back up". A down site fails the run. |
| team-v2 site probe (Mac) | Never pages by itself. Two failed sweeps in a row dispatch `uptime-ping.yml` so GitHub decides (max once per 30 min, plus one recheck after recovery). |
| team-v2 commerce findings | Overdue orders / unconfirmed transfer claims: one message per change, one when cleared (`payment:` / `payment-resolved:` outbox kinds). |
| `phone-otp-send` | OTP failed on every channel. |
| `errors-telegram-alert` | Error spikes, failed scheduled jobs and cron incidents **only when payment/auth related** (`errors-telegram-alert/telegram-policy.ts`); SLO burn alerts always. |
| `ops-edge-health` | Only `CRITICAL_EDGE_FUNCTIONS` (payment, OTP, auth email, prerender). |
| `deploy-guard.yml` | Every failure on main. |
| `quality.yml`, `security.yml` | First red run on main, then one "green again". |
| `news-repair` | Only when rows are stuck (with its buttons) or the queue is unreadable. |
| team-v2 `watchdog`, replies to commands and button presses (`control`, `accepted`, `action-*`, …) | As before, labelled. |
| `fb_browser_post.py` / `x_browser_post.py` | Every successful post, instantly: `[Grok Bot] Đã đăng bài`, platform (Facebook page / X), headline, link (owner rule 21/10/2026). Failures only when posting fails 2+ times in a row (job stops); a single failure retries next run. Also: picker returned an already-posted item; X posted without its link reply (flagged in the post notice). |

## Digest (team-v2 `scheduled_digest`, reads sources, no new tables)
- Held outbox rows: `verification`, `alert`, `starting`, `request`, `fallback`, `provider*`, `blocked-*`, `tournament-autopublish`, `content-*` (status `held` → `digested`).
- `gh run list` on main since the last digest: Quality, Deploy guard, Security, Playwright smoke/full, Lighthouse, Uptime, Milestone-due.
- Supabase reads: `ops_job_health_snapshot` (replaces the 09:15 `ops-job-digest` Telegram; set `OPS_JOB_DIGEST_TELEGRAM=on` to restore), non-available edge functions, open cron incidents, `client_errors`, published posts (`fb_post_log`, `x_posts`).
- 08:00 only: due milestones from `scripts/due-milestones.mjs` (`milestone-due.yml` no longer messages).

## Social posting
- Chrome posters (`fb_browser_post.py`, `x_browser_post.py`, run by launchd from the repo checkout) send one instant `[Grok Bot] Đã đăng bài` per published post (restored 21/10/2026). The digest still counts posts.
- `workers/social-poster` (API path, currently unused: both pages and X post via Chrome) does not send per-post Telegram.

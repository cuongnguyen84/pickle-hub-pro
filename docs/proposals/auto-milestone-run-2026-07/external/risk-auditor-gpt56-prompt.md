# Risk brief — auto-milestone meta-task (self-contained)

Product: ThePickleHub, a bilingual pickleball web+mobile app, ~2000 real users,
run by ONE solo operator (Cuong). React SPA on Cloudflare Pages, Supabase backend,
Capacitor mobile, Telegram used as the ops alert channel. Bot-heavy GA4 (US
datacenter traffic pollutes global numbers; only the Vietnam segment is trusted).

This is NOT a user-facing feature. It is a "meta" change: a mechanism so that
future autonomous coding-agent sessions (context wiped between sessions) reliably
execute 6 roadmap milestones on their due dates instead of forgetting them.

The 6 milestones:

1. QA-04 — stabilize a flaky Playwright E2E suite (10 user journeys). Current CI
   on the draft PR: smoke FAILS with 4 issues — (a) /feed page-title race,
   (b) an accessibility filter-pill contrast check where axe hits "execution
   context destroyed" because the page navigates mid-scan, (c) auth.spec `/match/confirm`
   fails with "verifyOtp failed: Email link is invalid or has expired", (d) a hard
   fail on a DUPR single-sign-on iframe modal. Also codeql FAILS repo-wide with
   "Code scanning is not enabled" (an org/repo config problem, not this PR's code).
   The stated goal is "make these specs stable." Auth (login/OTP) and registration
   are each governed by a 99% reliability SLO; the E2E is a key detector for them.

2. OPS-04 — extend an EXISTING Telegram alerter (a Supabase edge function on a
   10-minute cron that already sends error-spike alerts and cron-health alerts to
   ONE Telegram chat) to also alert on SLO error-budget burn. SLOs 2 and 3 (auth,
   registration) are currently measured off GA4 funnel events, which are bot-polluted.

3. PERF-05 — after ~1 week of real-user monitoring, compare Vietnam mobile p75
   web-vitals (LCP/INP/CLS) before vs after a perf change, to decide if it worked.

4. .tl-btn ratchet HARD — a design-system lint rule (an operator script, run in CI
   on changed files only) currently ADVISORY is scheduled to flip to HARD (fails the
   build) after a date, "if no false positives." It fails a PR only if a changed
   .tsx file increases its count of a legacy CSS button class vs the file's base version.

5. Funnel read (UX-07) — after 2 weeks of data, read a GA4 conversion funnel for a
   tournament-organizer flow (~small sample) to decide whether to build a feature.

6. Telemetry badge read — after ~2 weeks, read a GA4 impression counter to decide
   whether to keep or kill a "social proof" registration-count badge.

Mechanism options being weighed to make these fire on time: (a) a markdown doc that
future sessions must remember to read — same leak as the memory files that already
dropped milestones; (b) a GitHub Actions scheduled workflow that opens an issue on
the due date; (c) a Telegram reminder that depends on Cuong; (d) a "scheduled Claude
routine" that auto-launches an autonomous agent session on the date. A standing
instruction already tells autonomous sessions to "run the roadmap automatically."
Autonomous sessions have NO human in the loop and are blocked from merging RED-tier
changes without explicit human consent.

Your job: name the SPECIFIC production/operational failure each of these causes.
Be concrete — mechanism, trigger, user-visible or operator-visible symptom. Reject
generic "there may be risk" language. Focus especially on:
- How "stabilizing" a flaky auth E2E can silently disable a real production-outage
  detector (false-green).
- What happens when SLO-burn alerts share one Telegram channel with existing alerts.
- Whether GA4 bot pollution can make an SLO alert fire wrong or stay silent wrong.
- The risk of a date-triggered AUTONOMOUS session doing unsafe work with no human present.
- Whether reading a 1-2 week funnel/RUM sample of a ~2k-user app yields a decision
  you can trust, or noise dressed as signal.
If any of these is genuinely safe, say so plainly and briefly.

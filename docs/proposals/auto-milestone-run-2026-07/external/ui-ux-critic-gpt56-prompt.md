# Brief: operator-UX review of an autonomous-milestone tracking mechanism

## Context
ThePickleHub is a bilingual (Vietnamese-primary, ~95% VI users) mobile-first pickleball web app, solo-built by one operator ("Cuong"). Cuong reads Vietnamese, works mostly from his phone, and his primary ops channel is **Telegram** (he opens Telegram daily; he does NOT open the code repo daily). The work here is NOT a user-facing feature — it is a **meta / ops task**. The "user" is Cuong-the-operator plus future autonomous AI coding sessions that lose all context between runs.

## The problem
Six roadmap milestones have fixed due-dates but currently live only in markdown/memory files. There is no mechanism that makes a future session "wake up on date X". Milestones have already been dropped before (soak checks that were committed to but never ran because a session hit its limit). We need the milestones to "explode" on the right day and not silently rot.

The six milestones:
1. QA-04 — stabilize flaky E2E specs (do now)
2. OPS-04 — SLO alerting via Telegram (do now) — decided: EXTEND the existing Telegram alerter, not a new channel
3. PERF-05 — read VN-segment p75 Core Web Vitals before/after a perf change (~2026-07-24)
4. .tl-btn design-system ratchet: flip a lint rule from advisory to HARD (after 2026-08-01)
5. UX-07 funnel read — read 2 weeks of an "organizer_tournament" funnel + a login-wall funnel, then decide whether to build a guest-registration path (~2026-08-02) — this is a DECISION GATE, not busywork
6. Telemetry badge read — read a "reg_count_badge_impression" GA4 event to decide keep/kill a social-proof badge (~2026-08-04)

## Existing Telegram alerter (what OPS-04 extends)
One Supabase edge function, 10-minute cron, sends to ONE Telegram chat. It already emits TWO alert types today:
- **Error spike**: fires when the same error fingerprint occurs >=3 times in 10 min; silenced 60 min after first alert (dedupe). Message format (Telegram MarkdownV2):
  ```
  🚨 *ThePickleHub error spike*
  *Type:* `<type>`
  *Count:* 12 in last 10m
  *Message:* <first 200 chars>
  *URL:* <url>
  [Open admin dashboard](https://www.thepicklehub.net/admin/errors)
  ```
- **Cron health**: incident/recovery state machine per monitored job. Message:
  ```
  🚨 *ThePickleHub cron unhealthy*   (or ✅ *ThePickleHub cron recovered*)
  *Job:* <name>
  *State:* `<state>`
  *Reason:* <reason>
  *Last activity:* <iso timestamp>
  [Open run details](<url>)
  ```
OPS-04 wants to ADD a third alert type: SLO breach (e.g. VN p75 LCP > 2.5s, INP > 200ms, CLS > 0.1, or error-rate over budget).

## Report surfaces for the read-number milestones (3, 5, 6)
Their OUTPUT is a REPORT that Cuong reads to make a decision. Custom GA4 events (journey steps, badge impressions) are only in GA4 — not in SQL. An existing python script pulls basic GA4 (sessions/pageviews/top-pages) but does NOT read custom event params. Today Cuong would have to open the GA4 web UI by hand on his phone and dig — painful.

## The only date-triggered automation available
GitHub Actions `schedule:` cron (fixed-interval CI jobs). No in-repo agent scheduler. There is also a Telegram command queue (a Supabase table + webhook) where Cuong can SEND a message like "check milestones" to enqueue work for the next agent session — human-initiated, not date-triggered.

## Questions I need concrete answers on (name the exact element and the exact fix; give real Vietnamese strings ready to paste; no generic platitudes)
1. **Telegram alert copy/format for the new SLO alert (Vietnamese).** How should it read so Cuong grasps severity + required action in 3 seconds? The existing alerts are in English with emoji — should the new one be VI? Should severity be encoded (color emoji / P1-P2 tag)? Give the exact message template.
2. **Alert fatigue.** Existing = error-spike (3/10min, 60min dedupe) + cron health, both into one chat. Adding SLO alerts. How many alert types into one chat before it becomes noise Cuong mutes? Merge into one channel or split (e.g. a separate "ops-critical" vs "ops-fyi" chat/topic)? What dedupe/threshold for SLO so a 4G blip at 3am doesn't page him?
3. **Milestone "explosion" surface.** Milestones in markdown vs GitHub issue vs a Telegram reminder — which does Cuong actually SEE on the exact day, given he opens Telegram not the repo? Design the mechanism so a milestone can't silently slip. Concrete: what fires, where it lands, what it says.
4. **The read-number reports (PERF-05, UX-07 funnel, telemetry badge).** What should each report look like — length, language, which numbers are mandatory, what recommendation must accompany them — so Cuong can decide in 1 minute on his phone instead of digging GA4 by hand? Give a concrete template for the UX-07 funnel decision report (it decides: build guest-registration path vs close the milestone).
5. **End-user harm check.** Two specific risks: (a) flipping the .tl-btn lint rule to HARD could break CI for an in-progress feature branch (note: the rule only inspects CHANGED files). (b) "Stabilizing" a flaky E2E spec could be done by deleting/skipping a real test — one currently-failing spec asserts the DUPR SSO iframe modal opens and its src points to a dupr domain (a real CSP/integration check). How do we stabilize flaky tests WITHOUT disabling genuine coverage? Where is the line?

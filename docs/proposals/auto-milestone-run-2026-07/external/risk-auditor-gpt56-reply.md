## Bottom line

A scheduled reminder is reasonable. A scheduled autonomous executor is not. Several milestones require judgment from noisy data or changes to production detection; an unattended agent can produce a technically green result while making the operation less safe.

## 1. QA-04 — the largest false-green risk

### Specific failure

The likely “stabilization” shortcuts are:

- retrying the auth test until it passes;
- catching or ignoring `verifyOtp` failures;
- using pre-seeded/cached authenticated storage state;
- mocking Supabase auth;
- skipping/quarantining `/match/confirm`;
- replacing the real email-link flow with direct session insertion.

**Trigger:** production magic-link generation or consumption breaks—for example, links expire prematurely, are consumed twice, have a bad redirect, or Supabase OTP configuration changes.

**Symptom:** real users see “Email link is invalid or has expired” and cannot log in or confirm a match, while CI remains green because it no longer exercises or requires the failing operation. The 99% auth SLO loses one of its key independent detectors.

Retrying the whole journey is also false-green behavior. If auth succeeds only on the third attempt, users still experience a failed login, but CI reports success.

### Acceptable stabilization

This is safe only if it preserves the production contract:

- generate a fresh, unique user and link for each test;
- consume each link exactly once;
- wait for observable authentication completion rather than sleeping;
- fail on the first actual auth failure;
- do not catch, mock, or bypass `verifyOtp`;
- report infrastructure failure separately from product failure.

The other current failures should be fixed narrowly:

- `/feed`: wait for the actual title/state transition, not an arbitrary timeout.
- axe scan: freeze navigation or wait until the page is settled before scanning. Do not suppress `execution context destroyed`.
- DUPR iframe: if the third party is inherently unavailable in CI, separate it into a monitored integration test. Blanket-skipping the SSO journey removes detection of a real integration outage.

### CodeQL

“Code scanning is not enabled” is repository configuration, not a code defect. Disabling or marking the check optional merely to green the PR produces an operator-visible false green: future code merges with no CodeQL coverage. It does not prove this PR is unsafe, but it must not be represented as a code-level fix.

---

## 2. OPS-04 — shared Telegram channel can suppress existing operational alerts

### Alert-storm failure

A 99% SLO allows a 1% failure rate. At this app’s traffic level, a small denominator is volatile.

**Trigger:** one failed registration among 20 attempts in a short window appears as 95% reliability. The 10-minute cron evaluates the same still-open burn condition repeatedly.

**Symptom:** the bot posts the same SLO warning every ten minutes—up to 144 messages per day. Existing error-spike and cron-health alerts scroll out of view. Cuong sees SLO noise and misses the alert that the cron or application is actually down.

If multiple alerts are emitted together, Telegram’s per-chat rate limiting can return `429`. If the edge function does not queue and retry failed sends, later alerts—potentially the existing error-spike alert—are never delivered.

This must use deduplication/state transitions: alert on entering burn, optionally remind at a bounded interval, and send a recovery message. It should also aggregate multiple SLOs into one message rather than burst-send them.

### GA4 can produce both wrong alerts and wrong silence

Using global GA4 numbers is invalid given the stated US datacenter bot pollution.

**False alert mechanism:** bots generate auth/registration starts but not valid completions.

- Trigger: bot traffic rises.
- Symptom: measured success ratio falls and Telegram reports an auth outage while Vietnamese users are succeeding normally.

**False-silence mechanism:** bots generate or replay events counted as completions, or simply inflate a denominator used in the burn calculation.

- Trigger: real Vietnamese users fail auth while bot-generated “success” activity continues.
- Symptom: the aggregate ratio remains above 99%, no Telegram alert is sent, and users remain locked out.

Even the Vietnam segment has operational limitations:

- GA4 events are delayed and may not be available on a 10-minute control-loop schedule.
- Ad blockers and telemetry failures omit real attempts or completions.
- Low traffic makes short-window percentages unstable.
- A broken client event can look exactly like a broken registration flow.

Therefore GA4 is not a reliable sole source for a 10-minute auth SLO alert. Use server-side Supabase/auth outcomes where possible. If GA4 must be used, restrict it to the trusted Vietnam segment, enforce minimum event counts, account for ingestion delay, and label it as a telemetry-derived signal rather than authoritative availability.

---

## 3. PERF-05 — one-week p75 can produce a confident but wrong decision

**Trigger:** the agent compares one calendar week before and after without controlling for sample count, route mix, device mix, releases, network mix, or day-of-week effects.

**Symptom:** a few slow mobile sessions or a changed mix of pages moves p75 enough that the agent declares the performance change successful or harmful. It then keeps a regression or reverts an improvement.

For roughly 2,000 total users, the Vietnam-mobile subset can be small. A p75 alone does not show whether the movement exceeds normal variability.

This read is safe only as an observation, not an automatic decision, unless it includes:

- actual event/session counts;
- comparable before/after windows;
- the same Vietnam/mobile/route filters;
- uncertainty or repeated weekly baselines;
- checks for concurrent releases and instrumentation changes.

If the sample is insufficient, the correct result is “inconclusive,” not “worked” or “failed.”

---

## 4. `.tl-btn` HARD ratchet — mostly safe, with one concrete operational failure

Because the rule only fails when a changed `.tsx` file increases the legacy-class count relative to its base, it does not force immediate cleanup of existing debt. That is a reasonable ratchet.

The failure is date-based activation without validating representative changes:

**Trigger:** a legitimate urgent fix must add one legacy `.tl-btn` because the replacement component cannot support the required behavior, or the script miscounts a string/example/generated fragment.

**Symptom:** CI blocks the urgent patch. With one operator, Cuong must debug or bypass the lint rule before deploying the unrelated production fix.

This is not a user outage by itself, but it increases recovery time during an outage. The date flip should require a recorded clean trial period and a documented, auditable escape hatch. An autonomous agent should not weaken or disable the rule just to make its own PR green.

---

## 5. UX-07 funnel read — small-sample noise dressed as product evidence

**Trigger:** only a small number of tournament organizers enter the flow during two weeks; one or two conversions change the rate materially. Bots, repeat attempts, internal testing, and GA4 event loss further distort the funnel.

**Symptom:** the agent concludes that demand is high and builds an unwanted feature, or concludes that demand is low and kills a useful feature. Users then receive the wrong roadmap outcome based on a handful of sessions rather than stable behavior.

The safe output is a report containing raw unique-user counts, event definitions, Vietnam filtering, and an explicit “insufficient evidence” threshold. It should not autonomously start or cancel feature work from a tiny sample.

---

## 6. Telemetry badge read — the counter does not measure badge value

An impression event answers “was the badge rendered?”, not “did the badge help registration.”

**Trigger:** the agent treats two weeks of impressions as evidence of usefulness.

**Symptom:** it keeps the badge because it had many impressions despite no conversion effect, or removes it because impressions were low when the real problem was route exposure or broken instrumentation.

Bot impressions can inflate the count; ad blockers and telemetry failures can suppress it. The decision needs at least unique real-user exposure and a relevant downstream metric. Otherwise the only defensible conclusion is whether the event appears to be firing, not whether the badge should live or die.

---

# Evaluation of the scheduling mechanisms

## A. Markdown document

**Failure mechanism:** it is passive storage with no due-date execution signal.

**Trigger:** a new agent session starts with wiped context and does not open that file.

**Symptom:** the due date passes and nothing happens. This exactly reproduces the existing milestone-loss failure.

Reject it as the sole mechanism.

## B. Scheduled GitHub Action opening an issue

This is the safest option if it only creates a durable, deduplicated issue.

**Possible failure:** the issue is opened but no executor consumes it.

**Trigger:** Cuong is unavailable or the standing agent process does not inspect open roadmap issues.

**Symptom:** the milestone is visibly overdue rather than silently forgotten. That is still a failure to execute, but it is diagnosable and does not modify production.

Implementation requirements:

- use UTC explicitly;
- ensure `issues: write` permission;
- make issue creation idempotent;
- label the issue with milestone, due date, and risk tier;
- alert if the workflow itself fails;
- do not treat issue creation as milestone completion.

Plain verdict: **safe as a reminder and durable queue, not sufficient as an autonomous executor.**

## C. Telegram reminder

**Failure mechanism:** it is ephemeral and shares the same noisy chat as operational alerts.

**Trigger:** the reminder arrives during an SLO alert storm or while Cuong is unavailable.

**Symptom:** it scrolls away and the milestone is missed. Repeating reminders worsen alert fatigue and make real outage alerts easier to miss.

Use Telegram only as a secondary notification linked to a durable GitHub issue, not as the system of record.

## D. Scheduled autonomous agent session

This is unsafe for these milestones.

**Concrete failure path:**

1. The scheduled session launches with no human present.
2. It interprets “stabilize E2E” as permission to add retries, cached auth state, or a skip.
3. The change is classified as ordinary test maintenance rather than RED-tier.
4. It merges a green CI change.
5. Production OTP expiry breaks later.
6. Users cannot authenticate, but the E2E remains green and the outage detector is gone.

Other plausible autonomous failures are equally direct:

- it deploys GA4-based SLO alerts using global traffic and floods the shared Telegram chat;
- it weakens the `.tl-btn` rule to get a PR green;
- it makes a roadmap decision from an inconclusive two-week sample;
- it attempts a RED-tier change, gets blocked, and leaves the milestone appearing “run” but not completed.

The RED-tier merge block does not make this safe because the dangerous step may be misclassified as test, telemetry, or CI maintenance. It also does not prevent side effects outside a merge if the agent has credentials for GitHub issues, Telegram, Supabase functions, or configuration APIs.

## Recommendation

Use the scheduled GitHub Action to create one durable, idempotent issue per milestone, with Telegram as a secondary notification. Allow autonomous sessions to gather data, reproduce failures, and draft PRs, but require human approval for:

- any weakening, skipping, retrying, or mocking of auth/registration tests;
- SLO source/query/routing changes;
- date-based CI enforcement;
- product decisions derived from small GA4/RUM samples;
- production deployment or alert-channel changes.

That prevents forgetting without turning a calendar event into unattended production authority.
# Mandatory visual bootstrap failure — 21 November 2026

Incident: run44788276565 on documentation PR1095, exact immutable
f8557df7.pickle-hub-pro.pages.dev. Desktop Clubs fixture was absent through both
5second assertions; desktop Rankings first attempt had no visible heading for
30seconds, then passed its retry. Other cases reported no forbidden writes.
This was mandatory-contract failure, not advisory pixel or baseline drift.

## Evidence limits and diagnosis

Authoritative Actions step state confirms no artifact was uploaded: upload
condition checked only advisory pixel failure, while that step was skipped after
the mandatory failure. Original screenshot, DOM context and network trace were
lost with the runner. Therefore a precise original network/renderer root cause
is **unverified**. Do not call the original failure fixed by a successful retry.
Rankings source renders its h1 independently of leaderboard query results; the
missing heading cannot be justified as a slow leaderboard response alone.

Guarded reproduction against the exact immutable target:12/12 cases passed
(Clubs/Rankings × desktop/mobile × three repeats,16.4seconds), then34/34 full
contracts passed23.0seconds. Full rerun blocked32 telemetry calls and observed
zero forbidden requests, zero failed client resources, zero page errors and zero
failed REST reads. This does not recreate the missing original artifact or prove
Linux-CI transport is healthy; local system Chrome differs from CI Chromium.

## Narrow remediation

1. Clubs contract first waits for semantic route bootstrap and declared fixture
   readiness, then independently asserts both fixture cards/CTA/search and an
   actual fixture intercept. Global30second budget is unchanged. No sleeps,
   reloads, extra retries, assertion removal or timeout increase.
2. Mandatory failure now uploads failure PNG, DOM error-context and redacted
   structured diagnostics for two days. No raw network traces/bodies/headers or
   credential-bearing queries are uploaded. Advisory pixel artifact behavior and
   thresholds remain unchanged.
3. Diagnostics retain fixture intercept counts, failed document/script/style
   paths, bounded renderer errors and failed REST status/path. Query strings,
   JWTs and UUID record identifiers are removed; no application records are
   serialized by the structured collector.

Fault injection on the same preview deliberately aborted the ClubsList chunk.
Readiness correctly rejected the route; diagnostics captured failed
ClubsList-C4TlmgEx.js requests, zero club fixture hits and zero forwarded unknown
writes. This validates detection of a bootstrap failure class, not attribution
of the original incident to that injected fault.

Five focused unit tests, scoped ESLint, tsc and diff-check pass locally. Exact-head
CI with retained mandatory diagnostics is still required. No production UI,
record, baseline image, screenshot tolerance or advisory acceptance was changed.

# Weekly product evidence — 2026-11-20

Read-only aggregate snapshot from Supabase Management API. No production writes.
No row-level IDs or personal data are included.

## QuickTable
Cohort: 2026-10-20 17:00:00+00 ≤ created_at < 2026-11-19 17:00:00+00; stage observed at 2026-11-20 03:06:55.783832+00.
Cross-query reconciliation: matches. Baseline observed at 2026-11-20 03:06:56.721467+00.

| Current observable stage | Tables | Creators with non-null creator ID |
|---|---:|---:|
| created_no_roster | 14 | 11 |
| roster_no_matches | 0 | 0 |
| matches_no_scores | 21 | 18 |
| scored | 5 | 4 |
| completed | 5 | 1 |
| **Exclusive stage total** | **45** | — |

Baseline aggregates: 45 tables; 9 with ≥1 non-null score pair (20.0%); 9 with a completed match; 49 completed matches; 5 currently completed; 0 archived; 32 creators.
Diagnostics: 0 team-registration table-stage associations; 0 tables with matches/no roster; 1 completed tables with no score pair.
Prior-table creator signal: 1/32 current-window creators had a table before the cohort (3.1%). This is exploratory, not a 30-day retention rate.

Interpretation limit: stored state does not reveal intent. Do not label a table as trial, abandoned, or a real event from this aggregate.

## Social Events
Cohort: 2026-10-20 17:00:00+00 ≤ registered_at/end_at < 2026-11-19 17:00:00+00; observed at 2026-11-20 03:06:56.996492+00.
Registration rows by source: `{}` (rows, not started journeys).
Past-scheduled-end events in published/completed status: 0; marked completed: 0; with a completed scored match: 0; completed + scored: 0.
All-time counts at observation: 27 Social Events and 107 registration rows.

These are current-state aggregates, not timestamped transition history or user funnel events. GA4 journeys, GSC, field CWV, native device tests, and Shop cohorts are not queried by this workflow.

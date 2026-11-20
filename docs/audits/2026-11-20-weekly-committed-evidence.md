# Weekly server-observed evidence integration — 20 November 2026

The weekly read-only collector now includes committed-product-evidence.sql:
first_published_at publication counts and quick_table_score_evidence counts.
It reports the last 30 complete Vietnam calendar days, observed_at, unknown
publication timestamps and retained receipt totals. No IDs, scores, names,
tokens or inferred intent are output.

Read-only production execution succeeded at 2026-11-20T13:29:05Z. Window:
2026-10-20T17:00:00Z <= timestamp < 2026-11-19T17:00:00Z. Publications 0,
unknown publication timestamps 27, score receipts in window 0, retained score
receipts 0. The window predates rollout, so zero is not proof of inactivity.
Current-day transitions enter a future complete-day report.

These record first observed post-rollout publication/qualifying score writes,
not first-ever activation, actual event intent, GA4 delivery or retention.
Historical correction/republish can create evidence; deleting a tournament
deletes its receipt. No historical backfill or production write was performed.

Validation: Node contract suite 7/7, scoped ESLint and git diff check passed.

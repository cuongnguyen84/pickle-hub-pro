# First observed publication timestamp rollout — 20 November 2026

PR #1061 merged at 86382da2 after Quality, Security, Smoke, Visual and pgTAP
clean-replay gates passed. Production preflight found no column or ledger
entry and counted 27 historical Social Events.

Applied reviewed migration 20261120130000 and its ledger row atomically.
Separate read-only verification confirmed applied=true, trigger_enabled=true,
27 event rows and zero stamped rows. No historical publication dates were
invented. No real event was created or republished for verification.
Runtime publication behavior is covered by twelve pgTAP assertions on the
clean replay; future production observations remain necessary for analytics.

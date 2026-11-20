# Release controls verification — 20 November 2026

Read GitHub API found main unprotected, no rulesets and migration-drift workflow
disabled_manually. Under the authorized quality roadmap, enabled the existing
read-only daily workflow and dispatched it. Independent API read confirmed
state=active.

Run 44750967690 failed an actual mismatch: main had 431 migrations, production
430; missing ledger version 20261120200000_match_proposal_verifications_admin_read.
This is not a false alert or grounds for blanket ledger repair. Review migration,
originating CI and production catalog before reconciliation. No SQL applied by
this control change.

Main protection configured and read back: required status checks quality and
smoke, strict up-to-date checks, applies to administrators, pull-request policy
with zero external approvals (solo maintainer), conversation resolution required,
force pushes and branch deletion disabled. These checks do not replace manual
review, database pgTAP or source-specific gates.

At this initial observation, OPS-2 remained partial pending reconciliation and
a green run. The remediation below supersedes those two outstanding items;
other schedules and end-to-end deployment reliability remain separately scoped.

## Remediation and independent rerun

Read-only investigation confirmed the missing migration was truly unapplied:
the authenticated verification SELECT policy lacked its new top-level
is_admin() branch, not just a ledger row. Source PR #1064 and its five CI
workflows were reviewed. Applied the exact reviewed SQL and ledger entry
atomically, then read back applied=true and the policy's top-level admin branch
with prior branches preserved. No application rows were selected or edited.
Migration-drift run 44752651464 then completed SUCCESS. This closes the detected
ledger mismatch and re-enabled-control proof, not full schema equivalence.

PR #1073 was behind main under strict protection despite passing its older
checks. Updated its branch through the GitHub update-branch endpoint and let
checks rerun; no admin bypass or status-check weakening was used.

Independent PR read-back: #1073 merged at 2026-11-20T14:54:11Z as
`83ada796cf050151536c1f04060c85de8a89feb5` after all PR checks passed.
The local coverage regression suite passed 13/13. This verifies the reviewed
gate source/CI merge, not execution of a configured isolated staging suite or
registration/publish writes. No branch protection bypass was used.

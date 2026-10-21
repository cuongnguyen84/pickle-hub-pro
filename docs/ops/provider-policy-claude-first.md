# Provider preference: Claude first

## Latest user configuration

Claude calls explicitly select `--model opus`. The arbitrary internal 12-call/
9-USD-equivalent gate is disabled through `internal_budget_enabled=false`, and
the CLI `--max-budget-usd` flag is removed. Historical reservations are retained
for audit, not treated as invoices or used to block work. Per-task timeouts,
single-task queue processing, permissions and quota circuit breakers remain.
Earlier references below to preserving the shared cap describe the prior policy.

User instruction: ordinary agent work uses the user's Claude account. Codex is
fallback only when Claude explicitly reports exhausted usage/session quota.

Runtime setting: `provider_policy=claude_first`. No model/session login or secret
is changed. Existing CLI adapters use the owner's authenticated accounts.

- Claude first, including scheduled analysis and isolated worktree drafts.
- Explicit quota exhaustion opens Claude's existing six-hour cooldown and
  selects Codex. At cooldown expiry the next eligible task tries Claude again.
  This is a retry policy, not a claim that the account quota has reset.
- Network errors, authentication errors, generic rate limiting, invalid output,
  or reaching the controller's internal cap do not trigger Codex fallback.
- Report requests rejected for quota remain queued with the original request.
  A worktree request can retry as a Codex report only if its tree is unchanged;
  partial edits remain for review. Codex remains report-only, not a publisher.
- Switching and blocked work are reported on Telegram. The shared 12-call cap
  and conservative reservations are unchanged; no extra quota is purchased.
- Explicit `/xuly team provider codex|claude` is still a manual override and
  switches policy to `manual`. This user-directed deployment sets Claude-first.

Verification: provider selection/return, no fallback on auth/network errors,
and original-request preservation on quota are tested offline. No claim of
live account capacity is made from those tests.

# Telegram queue incident — 13 September 2026

## Cause and verified state

T47 (daily Kuala Lumpur Cup article updates, remote XL136) and T48 (switch
Claude to Codex, XL137) were accepted but not executed. Claude exhausted its
account quota. The generic provider-switch request was itself queued behind
Claude's circuit breaker. The bridge's remote `done` means transferred to the
local ledger, not completed work; that legacy compatibility limitation remains.

Twelve reserved model attempts still occupy the rolling 24-hour allowance.
Failed attempts remain counted conservatively; neither the cap nor historical
reservations were reset. Earliest slot expiry measured at 11:16 ICT:
**19:38 on 13 September 2026**, not a completion promise.

## Changes deployed

- Deterministic `/xuly team provider codex|claude` control works without a model,
  including while paused or Claude is blocked. Provider circuits are separate.
- Codex uses a new ephemeral session and existing ChatGPT authentication, not
  another terminal's session. User configuration, MCP, shell, apps, web search
  and multi-agent tools are disabled; sandbox is read-only. Report-only mode:
  no autonomous code edits, publication, merge or production changes.
- Work sends a start message only after a model reservation succeeds. Blocked
  provider and budget states produce deduplicated Telegram explanations.
- Codex JSONL requires a completed turn and report text. Token usage is kept;
  subscription dollar cost is explicitly unknown. The existing conservative
  scheduling allowance and shared 12-call cap are unchanged.
- Source request evidence is preserved when analysis produces a draft.

28 offline tests pass, including provider switching while Claude is blocked,
JSONL completion validation and blocked-message deduplication. A live probe
using the actual adapter and sanitized runtime environment returned
`TEAM_CODEX_OK`. This diagnostic probe is separate from queued business work.

Runtime snapshot: `team-v2/releases/20260913-111628/scripts/ops` under the user's
`Library/Application Support/PickleHub`. Prior snapshot and rollback data kept.
Both v2 launch agents loaded; fix-agent and edge-redeploy schedules preserved.

## Task outcomes and delivery

- T48 resolved: authenticated owner request verified; Codex selected and probed.
  Telegram delivery receipt **3974**.
- T47 remains queued, not implemented or published. Once capacity is available,
  the current Codex adapter can provide analysis/a draft, not install a daily
  article publisher. Budget-blocked explanation delivered, receipt **3975**.

The missing daily publication workflow must not be reported as implemented just
because the agent returns a draft. Full source verification, publication rights,
idempotent update logic and operational acceptance are separate remaining work.

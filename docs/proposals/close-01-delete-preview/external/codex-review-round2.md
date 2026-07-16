## Prompt sent

<task>
Repo: /Users/cm10/pickle-hub-pro, branch `close-01-delete-preview` (PR #350), base `main`. Working tree is clean. This is round 2 of a review — round 1 already ran and found 3 findings, which have since been fixed in commit `5641f3d9` on this same branch.

Round 1 findings (now claimed fixed, re-verify each):
1. Duplicate formatters: `formatDate`/`formatTime`/`formatRelative` were exported a second time from src/components/layout/TheLineLayout.tsx, and src/pages/Index.tsx had local `formatDate`/`formatTime` duplicating src/lib/format-datetime.ts. Claimed fix: removed the 3 duplicate exports from TheLineLayout.tsx; Index.tsx now imports formatDate/formatTime from @/lib/format-datetime. Index.tsx deliberately KEEPS its own `formatRelative` (different signature — takes a `lang` param for Vietnamese localization — so it is intentionally not a duplicate of the shared one). src/components/home/LiveSection.tsx's local `formatTime` is also a deliberately different implementation (includes day+month) and was intentionally left alone.
2. Stale docs/comments: docs/handoff-2026-07-16.md CLOSE-01 entry, and preview-related doc comments in src/components/layout/BottomNav.tsx and src/components/layout/ChatFAB.tsx. Claimed fix: handoff entry marked done (references PR #350); BottomNav.tsx/ChatFAB.tsx comments no longer mention /preview.
3. docs/perf-budgets.md: "Now" cell said 1950 KB while the baseline elsewhere said 1903.9 KB (inconsistent). Claimed fix: both now say 1904.0 KB (bundle was re-measured after the formatter dedupe).

Author also re-ran verification after the fix commit: tsc clean, eslint on touched files 0 errors AND 0 warnings, 739 vitest pass, prod build OK, bundle 1904.0/1970 KB gz.

Do a full fresh review of the entire branch diff vs main (`git diff main...close-01-delete-preview` from inside /Users/cm10/pickle-hub-pro) — do not just spot-check the 3 claimed fixes. Specifically:
1. Confirm each of the 3 round-1 findings above is actually resolved as claimed, by reading the current file contents at the referenced locations (not just trusting the claim).
2. Confirm the two "deliberately kept, not a duplicate" exceptions (Index.tsx formatRelative with lang param; LiveSection.tsx formatTime with day+month) are in fact behaviorally different from the shared src/lib/format-datetime.ts versions, not accidental near-duplicates.
3. Do a fresh full-diff pass for anything not covered by the round-1 findings: dangling imports/references to the deleted src/pages/preview/ folder, App.tsx routing correctness, BottomNav.tsx/ChatFAB.tsx hook-order correctness (hooks must run before any early return), and any other correctness issue visible in the diff.
</task>

<action_safety>
This is a REVIEW-ONLY task with one narrow exception. Do NOT modify, fix, or refactor any source file in the repository. Do NOT run destructive git commands. The only file you are allowed to create is the single markdown report described below — nothing else, and do not commit it.
</action_safety>

<structured_output_contract>
After completing the review, create the file docs/proposals/close-01-delete-preview/external/codex-review-round2.md (relative to /Users/cm10/pickle-hub-pro) containing, in this order:
1. A "## Prompt sent" section with this exact task prompt reproduced verbatim.
2. A "## Review output" section with your full round-2 review findings, including explicit confirm/deny on each of the 3 round-1 items and the 2 "deliberately different" exceptions.
Do not git add or git commit this file.

Then, as your final response text (separate from the file), give:
1. A one-line verdict: "clean" or "findings".
2. Every NEW finding (i.e. anything still wrong), verbatim, each as its own bullet with an exact `file:line` reference.
3. A short explicit confirm/deny line for each of the 3 round-1 findings and the 2 exceptions, stating whether the fix holds.
</structured_output_contract>

<grounding_rules>
Only report findings you can point to with an exact file path and line number (or an exact deleted-reference/grep match) from the actual current diff or repo state. Do not speculate about hypothetical bugs not visible in the code. If unsure whether something is a real bug, label it clearly as "possible / needs confirmation" rather than stating it as fact.
</grounding_rules>

## Review output

Verdict: findings. The preview-page deletion, shared-helper relocation, production routing, and hook ordering are correct. The remaining findings concern unrelated/stale files bundled into the round-1 fix commit, preview-only CSS left behind, and one whitespace regression.

### New findings

- [P2] `docs/agent-idea-pipeline.md:8` — The round-1 fix commit adds unrelated documentation claiming this agent pipeline is implemented and ready to run (`docs/agent-idea-pipeline.md:179` and `docs/agent-idea-pipeline.md:196`), but none of the implementation paths inventoried at `docs/agent-idea-pipeline.md:414` and `docs/agent-idea-pipeline.md:424` are tracked in this branch: `.claude/agents/`, `.claude/commands/`, and `scripts/agents/` exist only as untracked worktree content (`git ls-files` and the branch tree return no matches). A clean checkout of PR #350 therefore cannot run the documented `/idea`, `/ship`, `ask-model.mjs`, or `risk-tier.mjs` workflows.
- [P2] `docs/agent-loops-plan.md:34` — The newly added operational plan still prescribes a four-step blog publication flow, omitting the required `EN_BLOG_SLUGS` update documented at `CLAUDE.md:48` and `CLAUDE.md:54`; `docs/agent-loops-plan.md:130` also tells agents to bump `pr:v6`, while the runtime cache key is `pr:v28` at `functions/_middleware.ts:479`. The same newly added guidance is stale at `docs/agent-idea-pipeline.md:252` and `docs/proposals/_TEMPLATE.md:146` (`pr:v26`). Following these instructions can omit the sitemap slug or advance the wrong prerender-cache generation.
- [P3] `docs/agent-idea-pipeline.md:305` — The newly added pipeline documentation says the 1970 KB bundle budget has approximately 20 KB of headroom, and `docs/proposals/_TEMPLATE.md:140` repeats that value. This branch's corrected baseline is 1904.0 KB at `docs/perf-budgets.md:9` and `docs/perf-budgets.md:20`, leaving approximately 66 KB, so the fix commit reintroduces stale budget guidance even though the original `docs/perf-budgets.md` inconsistency is resolved.
- [P3] `src/styles/the-line.css:1907` — The deletion leaves the preview-only `.tl-preview-banner` selectors through `src/styles/the-line.css:1918` in the production stylesheet, while an exact tracked-tree search finds no remaining markup using `tl-preview-banner`. These selectors became dead code when `src/pages/preview/_shell.tsx` was deleted.
- [P3] `src/components/layout/TheLineLayout.tsx:1113` — Removing the duplicate formatter exports left an extra blank line at EOF; `git diff --check main...close-01-delete-preview` now reports `new blank line at EOF` at this location.

### Round-1 finding re-verification

1. **Confirm — duplicate formatter fix holds.** `src/components/layout/TheLineLayout.tsx` now ends after the component and no longer exports `formatDate`, `formatTime`, or `formatRelative`. `src/pages/Index.tsx:17` imports `formatDate` and `formatTime` from `@/lib/format-datetime`, and the former local definitions are gone. A full source-definition search found no reintroduced equivalent definitions at either location.
2. **Confirm — stale handoff/comments fix holds.** `docs/handoff-2026-07-16.md:35` marks CLOSE-01 done and references PR #350. `src/components/layout/BottomNav.tsx:27` and `src/components/layout/ChatFAB.tsx:9` no longer say those components hide on `/preview`; their runtime `/preview` predicates are also gone.
3. **Confirm — performance-baseline fix holds.** `docs/perf-budgets.md:9` and `docs/perf-budgets.md:20` both say 1904.0 KB. The newly introduced stale headroom wording is a separate finding above, not a denial of this original fix.

### Deliberately different formatter exceptions

1. **Confirm — `Index.tsx` `formatRelative` is behaviorally different.** `src/pages/Index.tsx:45` accepts a second `lang` argument and returns Vietnamese text such as `vừa xong`, `trong … phút`, and `… ngày trước` at lines 51–67. The shared `src/lib/format-datetime.ts:23` has no language parameter and returns English-only compact strings. Keeping the local implementation is justified.
2. **Confirm — `LiveSection.tsx` `formatTime` is behaviorally different.** `src/components/home/LiveSection.tsx:36` uses `toLocaleString` with day, month, hour, and minute. The shared `src/lib/format-datetime.ts:16` uses `toLocaleTimeString` with hour and minute only. Keeping the local implementation is justified.

### Fresh full-diff checks

- The moved `Countdown` is byte-for-byte identical to `main:src/pages/preview/_Countdown.tsx` (`cmp` passed). The three shared formatter bodies are exact copies of `main:src/pages/preview/_shell.tsx:527`–`557` (zero diff).
- All ten former production dependency sites now import `Countdown` or the formatters from their new locations. Exact branch-tree searches found no source import, dynamic import, runtime link, preview route symbol, or tracked file under `src/pages/preview/`.
- `src/App.tsx` removes the twelve preview lazy declarations and the matching twelve routes as a complete set. The surrounding embed, admin, public, Vietnamese, and wildcard routes remain structurally correct; retired preview URLs now fall through to `NotFound`.
- `src/components/layout/BottomNav.tsx:33`–`41` invokes `useI18n`, `useLocation`, `useKeyboardHeight`, and `useLivestreams` before the early returns at lines 44–56, with no later hook. `src/components/layout/ChatFAB.tsx:47`–`93` invokes both context/location hooks, both state hooks, and both effects before the early return at lines 95–101, with no later hook. Hook ordering is safe.
- The current checkout was not clean despite the prompt: it contained numerous pre-existing untracked files/directories, including the missing agent-pipeline implementation. They were not modified or staged. Only this required round-2 report was created.
- The author's tsc, ESLint, Vitest, build, and bundle runs were not repeated. The review used read-only branch-tree searches, exact source comparisons, direct current-file inspection, and `git diff --check`.

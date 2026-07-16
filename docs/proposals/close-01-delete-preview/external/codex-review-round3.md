## Prompt sent

<task>
Repo: /Users/cm10/pickle-hub-pro, branch `close-01-delete-preview` (PR #350), base `main`. Branch is pushed; working tree has only pre-existing untracked files (not part of this branch's diff). This is round 3 of a review — round 2 found 5 findings, since claimed fixed in commit `fae2dd16` on this same branch.

Round 2 findings (now claimed fixed/resolved, re-verify each):
1. [P2] docs/agent-idea-pipeline.md described an agent pipeline (.claude/agents/, .claude/commands/, scripts/agents/) as implemented, but those paths weren't tracked in the branch. Claimed fix: docs/agent-idea-pipeline.md, docs/agent-loops-plan.md, docs/agent-round2-rules.md, and docs/proposals/_TEMPLATE.md were untracked from the branch entirely (git rm --cached) — they were pre-existing untracked workspace files accidentally swept in by a prior `git add docs/`, and their content issues are now considered out of this PR's scope.
2. [P2] docs/agent-loops-plan.md had stale guidance (missing EN_BLOG_SLUGS step, wrong pr:v6 cache-key version vs actual pr:v28). Claimed fix: same as above — file removed from branch entirely.
3. [P3] Newly-added docs repeated a stale "~20 KB headroom" bundle-budget figure inconsistent with the corrected 1904.0 KB baseline. Claimed fix: moot, since the files carrying that figure are no longer in the branch.
4. [P3] Dead CSS: `.tl-preview-banner` selectors left behind in src/styles/the-line.css after src/pages/preview/_shell.tsx was deleted. Claimed fix: those selectors were deleted from src/styles/the-line.css.
5. [P3] Blank line at EOF in src/components/layout/TheLineLayout.tsx (introduced when duplicate formatter exports were removed). Claimed fix: fixed; author reports `git diff --check main -- ':!docs'` is clean.

Author states the branch's docs diff vs main is now only: docs/handoff-2026-07-16.md, docs/perf-budgets.md, docs/roadmap-8.5-9.md, and docs/proposals/close-01-delete-preview/external/codex-review-round1.md (this last one is the round-1 review audit trail, intentionally kept, not a defect). Re-verified by author: tsc clean, prod build OK, bundle 1903.8 KB gz / 1970 KB budget (docs synced to that figure).

Do a full fresh review of the entire current branch diff vs main (`git diff main...close-01-delete-preview` from inside /Users/cm10/pickle-hub-pro) — do not just spot-check the 5 claimed fixes. Specifically:
1. Confirm each of the 5 round-2 findings above is actually resolved as claimed, by reading the current file/branch state directly (not just trusting the claim). For findings 1-3, confirm the 4 named doc files are genuinely absent from `git diff main...close-01-delete-preview --name-only` and from `git ls-tree -r close-01-delete-preview`.
2. Confirm no other reference to `.tl-preview-banner` remains anywhere in the tracked tree.
3. Confirm `git diff --check main...close-01-delete-preview` reports no whitespace/EOF errors.
4. Do a fresh full-diff pass for anything not covered by rounds 1-2: dangling imports/references to the deleted src/pages/preview/ folder, App.tsx routing correctness, BottomNav.tsx/ChatFAB.tsx hook-order correctness, correctness of the Countdown/format-datetime helper extraction, and any other correctness issue visible in the diff.
5. Also verify that docs/proposals/close-01-delete-preview/external/codex-review-round2.md exists in the working tree with round-2's review output. If it is missing or empty, create it now using the content below as its "## Prompt sent" + "## Review output" sections are unknown to you — in that case just note in your final report that it was missing and you created a placeholder noting round 2 output should be re-attached by the author; do NOT fabricate round-2 findings content.
</task>

<action_safety>
This is a REVIEW-ONLY task with one narrow exception. Do NOT modify, fix, or refactor any source file in the repository. Do NOT run destructive git commands. The only files you are allowed to create/touch are the two markdown reports described below (round2.md only if missing, and round3.md) — nothing else, and do not commit anything.
</action_safety>

<structured_output_contract>
Create the file docs/proposals/close-01-delete-preview/external/codex-review-round3.md (relative to /Users/cm10/pickle-hub-pro) containing, in this order:
1. A "## Prompt sent" section with this exact task prompt reproduced verbatim.
2. A "## Review output" section with your full round-3 review findings, including explicit confirm/deny on each of the 5 round-2 items.
Do not git add or git commit this file.

Then, as your final response text (separate from the file), give:
1. A one-line verdict: "clean" or "findings".
2. Every NEW finding (i.e. anything still wrong), verbatim, each as its own bullet with an exact `file:line` reference.
3. A short explicit confirm/deny line for each of the 5 round-2 findings, stating whether the fix holds.
4. State whether docs/proposals/close-01-delete-preview/external/codex-review-round2.md was present.
</structured_output_contract>

<grounding_rules>
Only report findings you can point to with an exact file path and line number (or an exact grep/ls-tree result) from the actual current diff or repo state. Do not speculate about hypothetical bugs not visible in the code. If unsure whether something is a real bug, label it clearly as "possible / needs confirmation" rather than stating it as fact.
</grounding_rules>

## Review output

Verdict: findings. The five round-2 findings are resolved, and no runtime correctness defect was found in the preview deletion, routing, hook ordering, or helper extraction. One unrelated tracked test remains in the branch diff.

### New finding

- [P3] `src/lib/__tests__/i18n-standalone.test.ts:1` — The branch adds an unrelated standalone-i18n regression test that does not exercise the deleted preview pages or the extracted Countdown/date-time helpers. `git log main..close-01-delete-preview -- src/lib/__tests__/i18n-standalone.test.ts` places it in round-1 fix commit `5641f3d9`, whose stated scope was formatter deduplication and stale docs/comments; it should be removed from this PR or landed separately.

### Round-2 finding re-verification

1. **Confirm — finding 1 is resolved.** `git diff --name-only main...close-01-delete-preview -- docs/agent-idea-pipeline.md docs/agent-loops-plan.md docs/agent-round2-rules.md docs/proposals/_TEMPLATE.md` returned no rows, and `git ls-tree -r --name-only close-01-delete-preview --` for the same four paths also returned no rows. The files remain only as pre-existing untracked workspace content and are not part of the branch tree or diff.
2. **Confirm — finding 2 is resolved.** `docs/agent-loops-plan.md` is absent from both the branch diff and `close-01-delete-preview` tree by the exact commands above, so its stale `EN_BLOG_SLUGS`/`pr:v6` guidance is out of this PR.
3. **Confirm — finding 3 is resolved.** All four swept-in docs, including the files that carried the stale `~20 KB headroom` wording, are absent from both the branch diff and branch tree. The surviving performance docs consistently report the 1903.8 KB current baseline at `docs/perf-budgets.md:9`, `docs/perf-budgets.md:20`, `docs/handoff-2026-07-16.md:38`, and `docs/roadmap-8.5-9.md:250`.
4. **Confirm — finding 4 is resolved.** The `.tl-preview-banner` block is deleted from `src/styles/the-line.css`, and `git grep -n -F '.tl-preview-banner' close-01-delete-preview -- .` returned no tracked-tree match.
5. **Confirm — finding 5 is resolved.** `src/components/layout/TheLineLayout.tsx` ends directly after the component, and `git diff --check main...close-01-delete-preview` exited successfully with no output, including no EOF/whitespace error.

### Fresh full-diff verification

- The branch diff contains the four docs the author listed and no other docs. The retained `docs/proposals/close-01-delete-preview/external/codex-review-round1.md` is review audit history and does not introduce a product defect.
- `src/pages/preview/` has no entry in `git ls-tree -r --name-only close-01-delete-preview`, and exact branch-tree searches found no tracked import, dynamic import, route symbol, or runtime link into that deleted folder. Remaining textual mentions are provenance/completion comments or review documentation.
- `src/App.tsx` removes all twelve preview lazy declarations and the matching twelve `/preview/the-line*` routes as a complete set. The surrounding embed, admin, public, Vietnamese, redirect, and wildcard routing structure is unchanged; TypeScript compilation confirms the JSX/import graph remains valid.
- `src/components/layout/BottomNav.tsx:33`–`41` calls `useI18n`, `useLocation`, `useKeyboardHeight`, and `useLivestreams` before either early return at lines 44–56. `src/components/layout/ChatFAB.tsx:47`–`93` calls its location/i18n hooks, both state hooks, and both effects before the early return at lines 95–101. Neither component has a hook after an early return.
- Git identifies `src/components/Countdown.tsx` as a 100% rename of `main:src/pages/preview/_Countdown.tsx`, and a direct zero-diff comparison confirms it is byte-for-byte unchanged. The three functions in `src/lib/format-datetime.ts:5`–`35` match `main:src/pages/preview/_shell.tsx:527`–`557` exactly. All former production consumers now import from the new tracked locations; the round-1 formatter duplicates are gone.
- `src/components/home/LiveSection.tsx:36` intentionally keeps its behaviorally different day/month/time formatter, while `src/pages/Index.tsx:45` intentionally keeps its localized `formatRelative` implementation. Neither is an accidental duplicate of the shared helpers.
- Independent validation passed: `npx tsc --noEmit`; ESLint across all changed TypeScript/TSX files; the focused standalone-i18n test; and the full Vitest suite (57 files, 739 passed, 10 skipped). `git diff --check main...close-01-delete-preview` is clean. The author-reported production build and bundle measurement were not rerun because a build would write generated artifacts outside the two report-file exceptions.
- `docs/proposals/close-01-delete-preview/external/codex-review-round2.md` was present in the working tree, non-empty (10,389 bytes), and contains both `## Prompt sent` and `## Review output`; no placeholder was created and the file was not modified.
- No source file was modified, staged, or committed. Only this required untracked round-3 report was created.

## Prompt sent

<task>
Repo: /Users/cm10/pickle-hub-pro, branch `close-01-delete-preview` (PR #350), base `main`. Working tree is clean.

Review the full diff of this branch vs `main` (i.e. `git diff main...close-01-delete-preview` or equivalent, from inside /Users/cm10/pickle-hub-pro). This is CLOSE-01: deletion of the retired "The Line" web-redesign preview pages.

Summary of the change under review:
- Deleted src/pages/preview/ (13 files, ~3,900 lines) and removed the 12 /preview/the-line/* lazy imports + routes from src/App.tsx, plus a stale PublicProfile deprecation comment there.
- Before deleting, shared helpers were extracted verbatim because 10 production files imported them from the preview folder: Countdown -> src/components/Countdown.tsx (git mv, imported by src/pages/Index.tsx and src/components/home/LiveSection.tsx), and formatDate/formatTime/formatRelative -> src/lib/format-datetime.ts (imported by Blog, Forum, Live, News, NewsArticle, Tools, Tournaments, Videos in src/pages/).
- Removed now-dead "/preview" chrome-hiding checks in src/components/layout/BottomNav.tsx and ChatFAB.tsx (careful area: BottomNav had a historical hook-order regression — hooks must run before any early return).
- Updated stale comments in Index.tsx / TheLineLayout.tsx and docs (roadmap-8.5-9.md, perf-budgets.md).
- Local verification already done by the author: tsc clean, eslint on changed files 0 errors, 739 vitest pass, prod build OK, bundle 1950.0 -> 1903.9 KB gz (budget 1970).

Focus your review scrutiny on:
1. Any remaining imports/references anywhere in the repo pointing at the deleted src/pages/preview/ folder or its files.
2. Whether the extracted helpers (Countdown component; formatDate/formatTime/formatRelative in src/lib/format-datetime.ts) are truly behavior-identical to the originals, and whether all import sites were updated correctly with no leftover duplicate definitions.
3. Correctness of the BottomNav.tsx and ChatFAB.tsx edits, specifically hook-order safety — all hooks must still execute unconditionally before any early return, given BottomNav has a history of hook-order regressions.
4. Anything routing-related in src/App.tsx that this deletion could have disturbed (broken lazy import, dangling route, broken JSX, etc).
5. Any other correctness issue visible in the diff.
</task>

<action_safety>
This is a REVIEW-ONLY task with one narrow exception. Do NOT modify, fix, or refactor any source file in the repository. Do NOT run destructive git commands. The only file you are allowed to create is the single markdown report described below — nothing else, and do not commit it.
</action_safety>

<structured_output_contract>
After completing the review, create the file docs/proposals/close-01-delete-preview/external/codex-review-round1.md (relative to /Users/cm10/pickle-hub-pro) containing, in this order:
1. A "## Prompt sent" section with this exact task prompt reproduced verbatim.
2. A "## Review output" section with your full review findings.
Do not git add or git commit this file.

Then, as your final response text (separate from the file), give:
1. A one-line verdict: "clean" or "findings".
2. Every finding, verbatim, each as its own bullet with an exact `file:line` reference (use the path relative to the repo root and the line number in the current branch's version of the file unless the finding is about something deleted, in which case say so explicitly).
3. If clean, still state explicitly which of the 5 focus areas above you checked and confirmed clean.
</structured_output_contract>

<grounding_rules>
Only report findings you can point to with an exact file path and line number (or an exact deleted-reference/grep match) from the actual diff or current repo state. Do not speculate about hypothetical bugs not visible in the code. If unsure whether something is a real bug, label it clearly as "possible / needs confirmation" rather than stating it as fact.
</grounding_rules>

## Review output

Verdict: findings. No runtime correctness defect was found in the deletion, routing, helper behavior, or hook ordering; the findings below are low-severity completeness/documentation issues.

### Findings

- [P3] `src/components/layout/TheLineLayout.tsx:1114` — The new shared formatter module is not the sole definition: `formatDate`, `formatTime`, and `formatRelative` remain as byte-for-byte duplicate exports at lines 1114, 1125, and 1132, and `src/pages/Index.tsx:30` / `src/pages/Index.tsx:41` retain the same `formatDate` / `formatTime` implementations. This leaves multiple production sources of truth after an extraction whose review criterion explicitly calls for no leftover duplicate definitions; ESLint also continues to emit `react-refresh/only-export-components` warnings for the three layout exports.
- [P3] `docs/handoff-2026-07-16.md:35` — The active “Ready to start now” handoff still instructs the next session to delete `src/pages/preview/` and verify `/preview/*`, even though this branch has completed that work. The adjacent chrome comments are stale for the same reason: `src/components/layout/BottomNav.tsx:27` and `src/components/layout/ChatFAB.tsx:9` still claim those components hide on preview surfaces after the corresponding checks were removed.
- [P3] `docs/perf-budgets.md:20` — The “Now” cell still reports 1950 KB while this same document’s updated current baseline at lines 9–10 reports 1903.9 KB after CLOSE-01, leaving the performance-budget document internally inconsistent.

### Focus-area verification

1. Remaining references: no tracked source import or runtime link points into the deleted folder. The only actionable stale references are documented above; historical “deleted from” comments in `Index.tsx`, `TheLineLayout.tsx`, and `format-datetime.ts` accurately describe provenance.
2. Helper extraction: SHA-256 comparison confirms `src/components/Countdown.tsx` is byte-for-byte identical to `main:src/pages/preview/_Countdown.tsx`. A zero-diff body comparison confirms all three functions in `src/lib/format-datetime.ts` are verbatim copies of lines 527–557 of `main:src/pages/preview/_shell.tsx`. All ten former production import sites now resolve to the new component/module. The remaining duplicates are the first finding.
3. Hook ordering: `BottomNav` calls `useI18n`, `useLocation`, `useKeyboardHeight`, and `useLivestreams` before either early return. `ChatFAB` calls both state hooks and both effects before its `shouldHide` return. Removing the preview predicates did not make either hook conditional.
4. Routing: the twelve preview lazy declarations and their matching twelve routes were removed as a complete set. No preview symbol, import, route, dangling JSX, or unrelated route change remains in `src/App.tsx`.
5. Other diff correctness: all deletions are scoped to the retired preview pages, the `PublicProfile` comment removal does not disturb its still-mounted redirect aliases, and `git diff --check main...close-01-delete-preview` is clean. An independent `tsc --noEmit` run passed; ESLint over all changed source files returned 0 errors and only the three pre-existing duplicate-export warnings cited above. The author’s full Vitest/build results were not rerun.

The workspace contained substantial pre-existing untracked content despite the prompt’s clean-tree statement. It was preserved, and no source file was modified.

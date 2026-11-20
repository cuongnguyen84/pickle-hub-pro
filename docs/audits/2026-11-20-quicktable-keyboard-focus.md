# QuickTable keyboard focus increment — 20 November 2026

Actual QuickTableMatchRow reproduced two failures before the patch: Escape left the inline editor open; successful asynchronous Save unmounted the focused button and dropped focus to body. Cancel happened to retain focus through DOM reuse, but had no explicit restoration guarantee. Regression run before fix: 2 failed, 5 passed.

Small fix: Escape in the inline score action area cancels without committing, and closing the editor restores focus to its Edit trigger using a ref/effect. Failed saves retain their draft/editor. No scoring rules, names, visual layout or dialog architecture changed.

Verification: actual component tests **7 passed**, scoped ESLint clean. Headless Chromium rendered the actual component with real I18nProvider, BrowserRouter and stylesheet, mock match/no-op save, at **390 and 1280 px in light/dark**. All four cases passed: Enter opens with first score focused; Tab moves to second score; Escape cancels/restores trigger; successful Save restores trigger. Structured results in the adjacent JSON. The temporary local fixture/server were removed/stopped after testing.

Scope limit: match-row inline editor only; this does not certify every QuickTable dialog, referee page, full-tab sequence or screen reader. No production records, score commits or analytics events were manufactured. No screenshots were needed for these focus assertions; no broad layout/accessibility score is claimed.

## Review follow-up: score names and pending-save safety

Additional tests reproduced three failures: both languages lacked programmatic score names; Escape during a deferred save closed the editor and a later rejection discarded its draft. Added names using existing localized inputInlineScore plus actual formatted player and side1/2, not invented translation keys. A synchronous pending-save guard now ignores Escape/Cancel and duplicate submit until settlement; fields are read-only and actions expose aria-disabled while pending. This does not cancel an in-flight request. Rejected commits retain draft and focused Save; later retry remains available.

Updated focused suite:10passed; ESLint clean. Browser AX snapshots in quicktable-score-labels JSON verify distinct named spinbuttons in EN/VI at390/1280 light/dark (8cases), actual component/providers/styles, mock data only. Temporary local fixture/server removed after verification.

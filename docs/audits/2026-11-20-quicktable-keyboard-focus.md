# QuickTable keyboard focus increment — 20 November 2026

Actual QuickTableMatchRow reproduced two failures before the patch: Escape left the inline editor open; successful asynchronous Save unmounted the focused button and dropped focus to body. Cancel happened to retain focus through DOM reuse, but had no explicit restoration guarantee. Regression run before fix: 2 failed, 5 passed.

Small fix: Escape in the inline score action area cancels without committing, and closing the editor restores focus to its Edit trigger using a ref/effect. Failed saves retain their draft/editor. No scoring rules, names, visual layout or dialog architecture changed.

Verification: actual component tests **7 passed**, scoped ESLint clean. Headless Chromium rendered the actual component with real I18nProvider, BrowserRouter and stylesheet, mock match/no-op save, at **390 and 1280 px in light/dark**. All four cases passed: Enter opens with first score focused; Tab moves to second score; Escape cancels/restores trigger; successful Save restores trigger. Structured results in the adjacent JSON. The temporary local fixture/server were removed/stopped after testing.

Scope limit: match-row inline editor only; this does not certify every QuickTable dialog, referee page, full-tab sequence or screen reader. No production records, score commits or analytics events were manufactured. No screenshots were needed for these focus assertions; no broad layout/accessibility score is claimed.

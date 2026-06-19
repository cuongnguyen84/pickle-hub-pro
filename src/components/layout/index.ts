// MainLayout + MatchFAB retired 2026-06-19: the default-theme chrome is dead.
// Every user-facing page is on TheLineLayout; AppHeader survives only in the
// App-level ErrorBoundary fallback. See docs/theline-migration-plan.md.
export { default as AppHeader } from "./AppHeader";
export { default as BottomNav } from "./BottomNav";
export { TheLineLayout } from "./TheLineLayout";

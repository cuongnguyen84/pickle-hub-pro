// ============================================================================
// PageStates — canonical Loading / Error / Offline surfaces (DS-04).
// ----------------------------------------------------------------------------
// One place for the states every page needs, so screens stop hand-rolling
// spinners and swallowing query errors. See docs/state-patterns.md for the
// full convention (Empty and Permission states are documented there too —
// they already have canonical homes: `.tl-empty` / EntityNotFound and
// RequireAuth respectively).
//
//   <LoadingState />            — page-level centered spinner (inside a layout)
//   <LoadingState fullScreen /> — route/auth boot spinner (no chrome yet)
//   <ErrorState onRetry={refetch} /> — query failed; wraps in the page layout
//   <OfflineBanner />           — global banner, mounted once in App.tsx
//
// All three carry the a11y semantics (role/aria-live/sr-only label) that the
// scattered raw <Loader2> spinners were missing.
// ============================================================================

import { useSyncExternalStore } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export function LoadingState({ fullScreen }: { fullScreen?: boolean }) {
  const { t } = useI18n();
  return (
    <div
      className={
        fullScreen
          ? "min-h-screen flex items-center justify-center bg-background"
          : "tl-shell"
      }
      style={fullScreen ? undefined : { padding: "60px 16px" }}
      role="status"
      aria-live="polite"
    >
      {fullScreen ? (
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      ) : (
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      )}
      <span className="sr-only">{t.common.loading}</span>
    </div>
  );
}

// Query failed after retries. Pages wrap this in their own layout
// (TheLineLayout etc.) so nav/footer stay usable while the body errors.
export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="tl-empty" role="alert">
      <h3>{t.errors.networkError}</h3>
      <p>{t.errors.networkErrorDesc}</p>
      {onRetry && (
        // 44px, stated in px rather than left to `h-11` (2.75rem). The board's
        // global criterion is a physical target size; a rem-based height is
        // only 44px while the root stays at 16px, and the browser gate
        // measured this button at 41. `size="sm"` (h-9) was worse still — an
        // error retry is the one control on the screen, not a dense one.
        <Button
          variant="outline"
          className="mt-3 min-h-[44px] min-w-[44px] px-4"
          onClick={onRetry}
        >
          {t.common.retry}
        </Button>
      )}
    </div>
  );
}

const onlineStore = {
  subscribe(cb: () => void) {
    window.addEventListener("online", cb);
    window.addEventListener("offline", cb);
    return () => {
      window.removeEventListener("online", cb);
      window.removeEventListener("offline", cb);
    };
  },
  getSnapshot() {
    return navigator.onLine;
  },
};

// Mounted once in App.tsx. navigator.onLine is a coarse signal (true only
// guarantees an interface is up, not real connectivity) — good enough to
// explain why nothing is loading; queries still fail loudly via ErrorState.
//
// Bottom placement: `bottom-0` put the banner UNDERNEATH the mobile BottomNav
// (fixed, bottom-0, z-9999) — the one sentence explaining why nothing works was
// invisible on a phone — and it landed in the same strip as the Shop buy bar.
// So on mobile it sits ABOVE the nav; from `md` up the nav is `md:hidden` and
// bottom-0 is correct again, which keeps every non-mobile surface unchanged.
//
// 72px is the same constant `--shop-bottomnav` states in shop.css (the tallest
// case: 56 web / 68 iOS / 72 Android shell — 16px of slack beats hiding text).
// It is written out rather than read from the variable because that variable is
// declared on `.tl-shop`, and this banner is a sibling of the router in
// App.tsx: `var(--shop-bottomnav)` here would only ever resolve to its fallback.
//
// z-61, not 60: `.tl-shop-buybar` is also 60 and won the tie by DOM order, so
// the banner lost to it. Still below the shop modal overlay (70) on purpose —
// a modal is a focused surface and should stay on top. The `tl-offline-banner`
// hook exists so shop.css can lift the banner clear of that buy bar on the two
// screens that have one, instead of painting over the button.
export function OfflineBanner() {
  const online = useSyncExternalStore(
    onlineStore.subscribe,
    onlineStore.getSnapshot,
    () => true,
  );
  const { t } = useI18n();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="tl-offline-banner fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] md:bottom-0 z-[61] flex items-center justify-center gap-2 bg-foreground text-background text-sm py-2 px-4"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      {t.errors.offline}
    </div>
  );
}

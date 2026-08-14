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
      className="fixed bottom-0 inset-x-0 z-[60] flex items-center justify-center gap-2 bg-foreground text-background text-sm py-2 px-4"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      {t.errors.offline}
    </div>
  );
}

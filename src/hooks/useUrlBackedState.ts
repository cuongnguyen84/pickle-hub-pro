import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * URL-backed component state — the canonical pattern for list/tab/filter
 * state that must survive back navigation, refresh, and deep-links (UX-08).
 * Generalized from useFeedTab (see its doc comment for the full rationale
 * on why this is NOT pure URL-derived state):
 *
 *   1. Resolve the initial value ONCE on mount from `?<param>=` — deep-links
 *      are honoured, but a stale param can't silently override later
 *      product-default changes on re-renders.
 *   2. Mirror the resolved value into the URL with `replace` so refresh and
 *      back-button are consistent without adding a history entry.
 *   3. Writes on user interaction use `replace` too — filter clicks should
 *      not pile up history entries (same call as ?tab=/?fmt= in
 *      Tournaments.tsx: "replace:true keeps back-button sane").
 */
export function useUrlBackedState<T extends string>(args: {
  param: string;
  /** Return the parsed value, or null when the raw param is absent/invalid. */
  parse: (raw: string | null) => T | null;
  fallback: T;
}): [T, (next: T) => void] {
  const { param } = args;
  const [searchParams, setSearchParams] = useSearchParams();

  // Resolved once on mount — subsequent renders trust component state.
  const initial = useRef<T>(args.parse(searchParams.get(param)) ?? args.fallback);
  const [value, setValue] = useState<T>(initial.current);

  // Mirror initial resolution into the URL (functional updater so multiple
  // instances mounting together don't clobber each other's params).
  useEffect(() => {
    if (searchParams.get(param) !== initial.current) {
      setSearchParams(
        (prev) => {
          prev.set(param, initial.current);
          return prev;
        },
        { replace: true },
      );
    }
    // Empty deps — only sync on mount. setSearchParams is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      setSearchParams(
        (prev) => {
          prev.set(param, next);
          return prev;
        },
        { replace: true },
      );
    },
    [param, setSearchParams],
  );

  return [value, set];
}

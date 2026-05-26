import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  type FeedTab,
  parseTabParam,
  resolveDefaultTab,
} from "@/lib/social/feed-tab-logic";

/**
 * Feed tab state. The initial value is resolved ONCE on mount from the
 * `?tab=` deep-link (so `/feed?tab=following` still works) — after that,
 * the tab is component state and writes back to the URL on user
 * interaction.
 *
 * Why not pure URL-derived: the previous implementation re-read
 * searchParams on every render, which meant a stale `?tab=following` in
 * the address bar (from a prior visit, a bookmark, or React Router
 * preserving query string across navigations) would silently override
 * the "trending is the cold-start default" product call. Cuong reported
 * users landing on Following despite the resolver returning Trending —
 * that's the URL-stickiness explanation.
 *
 * Now: cold visit to `/feed` → trending. Explicit `/feed?tab=following`
 * → following (deep-link still honoured). Click Following tab → URL
 * updates. Refresh → URL is the source of truth so user stays where
 * they left off.
 */

interface UseFeedTabArgs {
  isAuthenticated: boolean;
  followingCount: number | null | undefined;
}

export function useFeedTab(args: UseFeedTabArgs): {
  tab: FeedTab;
  setTab: (next: FeedTab) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();

  // Resolved once on mount — subsequent renders trust component state.
  const initial = useRef<FeedTab>(
    resolveDefaultTab({
      isAuthenticated: args.isAuthenticated,
      followingCount: args.followingCount,
      urlOverride: parseTabParam(searchParams.get("tab")),
    }),
  );
  const [tab, setTabState] = useState<FeedTab>(initial.current);

  // Mirror initial resolution into the URL so refresh + back-button are
  // consistent. We do this with `replace` to avoid creating a history
  // entry distinct from the user's arrival.
  useEffect(() => {
    const current = searchParams.get("tab");
    if (current !== initial.current) {
      const params = new URLSearchParams(searchParams);
      params.set("tab", initial.current);
      setSearchParams(params, { replace: true });
    }
    // Empty deps — only sync on mount. setSearchParams is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTab = useCallback(
    (next: FeedTab) => {
      setTabState(next);
      const params = new URLSearchParams(searchParams);
      params.set("tab", next);
      setSearchParams(params, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  return { tab, setTab };
}

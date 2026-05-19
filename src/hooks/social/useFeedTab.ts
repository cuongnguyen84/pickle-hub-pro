import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  type FeedTab,
  parseTabParam,
  resolveDefaultTab,
} from "@/lib/social/feed-tab-logic";

/**
 * URL-controlled feed tab state. Tabs sync to ?tab=following / ?tab=trending
 * so deep-linking and browser back-button work the way users expect.
 *
 * The default tab is resolved by feed-tab-logic — anonymous → trending,
 * logged-in with 0 follows → trending, logged-in with >0 follows → following.
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
  const urlOverride = parseTabParam(searchParams.get("tab"));

  const tab = useMemo(
    () =>
      resolveDefaultTab({
        isAuthenticated: args.isAuthenticated,
        followingCount: args.followingCount,
        urlOverride,
      }),
    [args.isAuthenticated, args.followingCount, urlOverride],
  );

  const setTab = useCallback(
    (next: FeedTab) => {
      const params = new URLSearchParams(searchParams);
      params.set("tab", next);
      setSearchParams(params, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  return { tab, setTab };
}

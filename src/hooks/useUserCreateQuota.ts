import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * W3.2 — TOTAL tournament-create quota across all 4 tools.
 *
 * Reads `profiles.tournament_create_quota` (default 3, admin override =
 * higher integer) for the cap, and `count_user_tournaments(user)` for the
 * SUM of the caller's tournaments across Quick + Flex + Doubles + TeamMatch.
 *
 * Used by the Flex / Doubles Elimination / Team Match list pages to render
 * a "TOTAL_USED / QUOTA" stats-row alongside the page's own per-tool count.
 * Quick Tables list page reads the same numbers via getUserQuotaInfo() in
 * useQuickTable (the underlying get_user_quota_info RPC is now TOTAL-aware
 * via the same helper).
 *
 * `refetch` is exposed for callers that mutate quota-affecting state
 * (e.g. MyTournaments delete) and need fresh numbers without remount.
 */
export function useUserCreateQuota(): {
  quota: number;
  used: number;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const { user } = useAuth();
  const [quota, setQuota] = useState<number>(3);
  const [used, setUsed] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [{ data: quotaRow, error: quotaErr }, { data: countData, error: countErr }] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('tournament_create_quota')
            .eq('id', user.id)
            .maybeSingle(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.rpc as any)('count_user_tournaments', { _user_id: user.id }),
        ]);

      if (quotaErr) console.error('[useUserCreateQuota] quota:', quotaErr);
      if (countErr) console.error('[useUserCreateQuota] count:', countErr);

      const quotaValue = (quotaRow as { tournament_create_quota?: number | null } | null)
        ?.tournament_create_quota;
      setQuota(typeof quotaValue === 'number' && quotaValue > 0 ? quotaValue : 3);

      const countValue = typeof countData === 'number' ? countData : 0;
      setUsed(countValue);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return { quota, used, loading, refetch: load };
}

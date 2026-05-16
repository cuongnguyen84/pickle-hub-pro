import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * W3.2 — Fetch the caller's per-account tournament-create quota.
 *
 * Reads `profiles.tournament_create_quota` (default 3, admin override =
 * higher integer). Used by the Flex / Doubles Elimination / Team Match
 * list pages to render a "X / Y" stats-row alongside their own count.
 *
 * Quick Tables already has a dedicated RPC (`get_user_quota_info`) that
 * also returns the table count; for the other three tools the list page
 * already knows its own count from React Query, so we only need the cap.
 */
export function useUserCreateQuota(): { quota: number; loading: boolean } {
  const { user } = useAuth();
  const [quota, setQuota] = useState<number>(3);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('tournament_create_quota')
          .eq('id', user.id)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          console.error('[useUserCreateQuota] fetch:', error);
          setQuota(3);
          return;
        }
        const value = (data as { tournament_create_quota?: number | null } | null)
          ?.tournament_create_quota;
        setQuota(typeof value === 'number' && value > 0 ? value : 3);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { quota, loading };
}

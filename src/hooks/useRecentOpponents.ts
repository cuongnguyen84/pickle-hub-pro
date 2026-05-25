// ============================================================================
// useRecentOpponents — last N opponents the viewer has played against
// ----------------------------------------------------------------------------
// Speeds up the /match/new opponent picker. Reads match_participants rows
// for matches the caller participated in, joins to profiles, dedupes, and
// returns the 20 most recent unique opponents (excluding self).
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RecentOpponent {
  player_id: string;
  display_name: string | null;
  email: string;
  username: string | null;
  last_played_at: string;
}

export function useRecentOpponents(viewerId: string | null | undefined) {
  return useQuery({
    queryKey: ["recent-opponents", viewerId],
    enabled: !!viewerId,
    staleTime: 60_000,
    queryFn: async (): Promise<RecentOpponent[]> => {
      if (!viewerId) return [];
      // Matches the viewer was in, last 60 days
      const since = new Date(
        Date.now() - 60 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data: myMatches, error: myErr } = await supabase
        .from("match_participants")
        .select("match_id, team")
        .eq("player_id", viewerId)
        .limit(200);
      if (myErr || !myMatches?.length) return [];
      const matchIds = myMatches.map((m) => m.match_id);

      const { data: rows, error } = await supabase
        .from("match_participants")
        .select(
          "match_id, player_id, team, matches!inner(played_at), profiles!inner(display_name, email, username)",
        )
        .in("match_id", matchIds)
        .neq("player_id", viewerId)
        .gte("matches.played_at", since)
        .order("matches.played_at", { ascending: false })
        .limit(60);
      if (error) throw error;

      const seen = new Set<string>();
      const out: RecentOpponent[] = [];
      for (const r of rows ?? []) {
        const p = (r as { profiles?: { display_name: string | null; email: string; username: string | null } }).profiles;
        const playedAt =
          (r as { matches?: { played_at: string } }).matches?.played_at ?? new Date().toISOString();
        const pid = (r as { player_id: string }).player_id;
        if (!p || seen.has(pid)) continue;
        seen.add(pid);
        out.push({
          player_id: pid,
          display_name: p.display_name,
          email: p.email,
          username: p.username,
          last_played_at: playedAt,
        });
        if (out.length >= 20) break;
      }
      return out;
    },
  });
}

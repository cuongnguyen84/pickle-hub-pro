// ============================================================================
// useRecentOpponents — last N opponents the viewer has played against
// ----------------------------------------------------------------------------
// Speeds up the /match/new opponent picker. Reads match_participants rows
// for matches the caller participated in, joins to profiles, dedupes, and
// returns the 20 most recent unique opponents (excluding self + teammates).
//
// Codex P2 fixes (2026-05-25):
//   - First query: filter by recency BEFORE applying limit, so high-volume
//     players don't lose recent matches to the 200-row cap.
//   - Second query: track viewer's team per match and only return
//     participants on the OPPOSITE team, so the picker doesn't surface
//     former partners as "opponents".
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

      // ─── 1. Viewer's recent matches — filter by played_at FIRST then cap
      // Codex P2 fix: ORDER BY recency on the inner join + apply the
      // 60-day filter here so the 200 cap never strips fresh matches in
      // favour of older ones for high-volume players.
      const { data: myMatches, error: myErr } = await supabase
        .from("match_participants")
        .select("match_id, team, matches!inner(played_at)")
        .eq("player_id", viewerId)
        .gte("matches.played_at", since)
        .order("played_at", { foreignTable: "matches", ascending: false })
        .limit(200);
      if (myErr || !myMatches?.length) return [];

      // Build a map of viewer's team per match for opposite-team filtering.
      const myTeamByMatch = new Map<string, string>();
      for (const m of myMatches) {
        const matchId = (m as { match_id: string }).match_id;
        const team = (m as { team: string }).team;
        if (matchId && team) myTeamByMatch.set(matchId, team);
      }
      const matchIds = Array.from(myTeamByMatch.keys());

      // ─── 2. Other-team participants only ────────────────────────────────
      // Codex P2 fix: select team alongside player_id so we can drop
      // rows where the row's team == viewer's team for that match
      // (former teammates) before populating the opponents picker.
      const { data: rows, error } = await supabase
        .from("match_participants")
        .select(
          "match_id, player_id, team, matches!inner(played_at), profiles!inner(display_name, email, username)",
        )
        .in("match_id", matchIds)
        .neq("player_id", viewerId)
        .gte("matches.played_at", since)
        .order("matches.played_at", { ascending: false })
        .limit(120);
      if (error) throw error;

      const seen = new Set<string>();
      const out: RecentOpponent[] = [];
      for (const r of rows ?? []) {
        const matchId = (r as { match_id: string }).match_id;
        const rowTeam = (r as { team: string }).team;
        const viewerTeam = myTeamByMatch.get(matchId);
        // Drop teammates: participant must be on the opposite team
        if (viewerTeam && rowTeam && rowTeam === viewerTeam) continue;

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

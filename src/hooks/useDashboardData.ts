import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DashboardType = "quick-table" | "team-match" | "doubles-elimination";

export interface CourtMatch {
  id: string;
  teamA: string;
  teamB: string;
  scoreA: number | null;
  scoreB: number | null;
  status: string;
  startTime: string | null;
  displayOrder: number;
}

export interface CourtData {
  courtNumber: number;
  liveMatch: CourtMatch | null;
  nextMatch: CourtMatch | null;
}

export interface DashboardTournament {
  id: string;
  name: string;
  type: DashboardType;
  shareId?: string;
}

// Fetch active tournaments across all 3 types
export const useActiveTournaments = () => {
  return useQuery({
    queryKey: ["dashboard-active-tournaments"],
    queryFn: async (): Promise<DashboardTournament[]> => {
      const results: DashboardTournament[] = [];

      // Quick Tables (group_stage or playoff)
      const { data: qt } = await supabase
        .from("quick_tables")
        .select("id, name, share_id, status")
        .in("status", ["group_stage", "playoff"]);
      if (qt) {
        results.push(
          ...qt.map((t) => ({
            id: t.id,
            name: t.name,
            type: "quick-table" as DashboardType,
            shareId: t.share_id,
          }))
        );
      }

      // Team Match (ongoing)
      const { data: tm } = await supabase
        .from("team_match_tournaments")
        .select("id, name, share_id, status")
        .eq("status", "ongoing");
      if (tm) {
        results.push(
          ...tm.map((t) => ({
            id: t.id,
            name: t.name,
            type: "team-match" as DashboardType,
            shareId: t.share_id,
          }))
        );
      }

      // Doubles Elimination (active)
      const { data: de } = await supabase
        .from("doubles_elimination_tournaments")
        .select("id, name, share_id, status")
        .in("status", ["active", "ongoing"]);
      if (de) {
        results.push(
          ...de.map((t) => ({
            id: t.id,
            name: t.name,
            type: "doubles-elimination" as DashboardType,
            shareId: t.share_id,
          }))
        );
      }

      return results;
    },
    refetchInterval: 30000,
  });
};

// Fetch tournament info
const useTournamentInfo = (type: DashboardType, id: string) => {
  return useQuery({
    queryKey: ["dashboard-tournament-info", type, id],
    queryFn: async () => {
      if (type === "quick-table") {
        const { data } = await supabase
          .from("quick_tables")
          .select("id, name, share_id, status")
          .eq("share_id", id)
          .single();
        return data;
      }
      if (type === "doubles-elimination") {
        const { data } = await supabase
          .from("doubles_elimination_tournaments")
          .select("id, name, share_id, status, court_count")
          .eq("share_id", id)
          .single();
        return data;
      }
      // team-match uses id directly
      const { data } = await supabase
        .from("team_match_tournaments")
        .select("id, name, share_id, status")
        .eq("id", id)
        .single();
      return data;
    },
    enabled: !!id,
  });
};

// Main dashboard data hook
export const useDashboardData = (type: DashboardType, id: string) => {
  const queryClient = useQueryClient();
  const tournamentInfo = useTournamentInfo(type, id);
  const tournamentId = tournamentInfo.data?.id;

  const matchesQuery = useQuery({
    queryKey: ["dashboard-matches", type, tournamentId],
    queryFn: async () => {
      if (!tournamentId) return [];

      if (type === "quick-table") {
        const { data } = await supabase
          .from("quick_table_matches")
          .select("id, court_id, start_at, status, score1, score2, display_order, player1_id, player2_id, quick_table_players!quick_table_matches_player1_id_fkey(name), p2:quick_table_players!quick_table_matches_player2_id_fkey(name)")
          .eq("table_id", tournamentId)
          .neq("status", "completed")
          .order("display_order");
        return (data || []).map((m: any) => ({
          id: m.id,
          courtNumber: m.court_id || 0,
          startTime: m.start_at,
          status: m.status,
          scoreA: m.score1,
          scoreB: m.score2,
          teamA: m.quick_table_players?.name || "TBD",
          teamB: m.p2?.name || "TBD",
          displayOrder: m.display_order,
        }));
      }

      if (type === "doubles-elimination") {
        const { data } = await supabase
          .from("doubles_elimination_matches")
          .select("id, court_number, start_time, status, score_a, score_b, display_order, team_a:doubles_elimination_teams!doubles_elimination_matches_team_a_id_fkey(team_name), team_b:doubles_elimination_teams!doubles_elimination_matches_team_b_id_fkey(team_name)")
          .eq("tournament_id", tournamentId)
          .neq("status", "completed")
          .order("display_order");
        return (data || []).map((m: any) => ({
          id: m.id,
          courtNumber: m.court_number || 0,
          startTime: m.start_time,
          status: m.status,
          scoreA: m.score_a,
          scoreB: m.score_b,
          teamA: m.team_a?.team_name || "TBD",
          teamB: m.team_b?.team_name || "TBD",
          displayOrder: m.display_order,
        }));
      }

      // Team Match - no court info
      const { data } = await supabase
        .from("team_match_matches")
        .select("id, status, games_won_a, games_won_b, total_points_a, total_points_b, display_order, team_a:team_match_teams!team_match_matches_team_a_id_fkey(team_name), team_b:team_match_teams!team_match_matches_team_b_id_fkey(team_name)")
        .eq("tournament_id", tournamentId)
        .in("status", ["in_progress", "pending", "lineup"])
        .order("display_order");
      return (data || []).map((m: any) => ({
        id: m.id,
        courtNumber: 0,
        startTime: null,
        status: m.status === "in_progress" ? "live" : m.status,
        scoreA: m.games_won_a,
        scoreB: m.games_won_b,
        teamA: m.team_a?.team_name || "TBD",
        teamB: m.team_b?.team_name || "TBD",
        displayOrder: m.display_order || 0,
      }));
    },
    enabled: !!tournamentId,
    refetchInterval: 10000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!tournamentId) return;

    let table: string;
    let filterCol: string;

    if (type === "quick-table") {
      table = "quick_table_matches";
      filterCol = "table_id";
    } else if (type === "doubles-elimination") {
      table = "doubles_elimination_matches";
      filterCol = "tournament_id";
    } else {
      table = "team_match_matches";
      filterCol = "tournament_id";
    }

    const channel = supabase
      .channel(`dashboard-${type}-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `${filterCol}=eq.${tournamentId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["dashboard-matches", type, tournamentId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [type, tournamentId, queryClient]);

  // Group matches into courts
  const courts = useMemo((): CourtData[] => {
    const matches = matchesQuery.data || [];

    if (type === "team-match") {
      // No court grouping for team match
      return [];
    }

    // Group by court number
    const courtMap = new Map<number, typeof matches>();
    matches.forEach((m) => {
      const court = m.courtNumber || 0;
      if (!courtMap.has(court)) courtMap.set(court, []);
      courtMap.get(court)!.push(m);
    });

    // Get court count from tournament info
    const courtCount = (tournamentInfo.data as any)?.court_count || courtMap.size || 1;

    const result: CourtData[] = [];
    for (let i = 1; i <= Math.max(courtCount, ...Array.from(courtMap.keys())); i++) {
      const courtMatches = courtMap.get(i) || [];
      const live = courtMatches.find(
        (m) => m.status === "live" || m.status === "playing" || (m.status === "pending" && (m.scoreA || 0) > 0)
      );
      const next = courtMatches.find(
        (m) => m.status === "pending" && m.id !== live?.id
      );

      result.push({
        courtNumber: i,
        liveMatch: live
          ? { id: live.id, teamA: live.teamA, teamB: live.teamB, scoreA: live.scoreA, scoreB: live.scoreB, status: live.status, startTime: live.startTime, displayOrder: live.displayOrder }
          : null,
        nextMatch: next
          ? { id: next.id, teamA: next.teamA, teamB: next.teamB, scoreA: null, scoreB: null, status: next.status, startTime: next.startTime, displayOrder: next.displayOrder }
          : null,
      });
    }

    return result;
  }, [matchesQuery.data, type, tournamentInfo.data]);

  // Team match live/next lists
  const teamMatchData = useMemo(() => {
    if (type !== "team-match") return { liveMatches: [], nextMatches: [] };
    const matches = matchesQuery.data || [];
    const liveMatches = matches.filter((m) => m.status === "live" || m.status === "in_progress");
    const nextMatches = matches.filter((m) => m.status === "pending" || m.status === "lineup").slice(0, 5);
    return { liveMatches, nextMatches };
  }, [matchesQuery.data, type]);

  return {
    tournamentInfo,
    matchesQuery,
    courts,
    teamMatchData,
    isLoading: tournamentInfo.isLoading || matchesQuery.isLoading,
  };
};

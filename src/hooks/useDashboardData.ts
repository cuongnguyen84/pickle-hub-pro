import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildCourtData,
  type CourtData,
  type DashboardMatch,
  type DashboardPhase,
} from "@/lib/dashboard-courts";

export type DashboardType = "quick-table" | "team-match" | "doubles-elimination";
export type CourtMatch = DashboardMatch;
export type { CourtData, DashboardMatch };

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

      // Double Elimination (active)
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
          .select("id, name, share_id, status, courts")
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
          .select("id, court_id, court_name, start_at, status, score1, score2, display_order, player1_id, player2_id, group_id, is_playoff, playoff_round, playoff_match_number, large_playoff_round, rr_round_number, rr_match_index, live_referee_id, group:quick_table_groups(name), quick_table_players!quick_table_matches_player1_id_fkey(name), p2:quick_table_players!quick_table_matches_player2_id_fkey(name)")
          .eq("table_id", tournamentId)
          .neq("status", "completed")
          .order("display_order");
        return (data || []).map((m): DashboardMatch => {
          const status = m.status ?? "pending";
          const isPlayoff = m.is_playoff === true;

          return {
            id: m.id,
            courtNumber: m.court_id || 0,
            courtName: m.court_name,
            startTime: m.start_at,
            status: m.live_referee_id && status !== "completed" ? "live" : status,
            scoreA: m.score1,
            scoreB: m.score2,
            teamA: m.quick_table_players?.name || "TBD",
            teamB: m.p2?.name || "TBD",
            displayOrder: m.display_order,
            groupName: (m.group as { name?: string } | null)?.name ?? null,
            roundNumber: isPlayoff
              ? (m.large_playoff_round ?? m.playoff_round)
              : m.rr_round_number,
            phase: isPlayoff ? "playoff" : "group",
            matchNumber: isPlayoff
              ? m.playoff_match_number
              : (m.rr_match_index == null ? null : m.rr_match_index + 1),
          };
        });
      }

      if (type === "doubles-elimination") {
        const { data } = await supabase
          .from("doubles_elimination_matches")
          .select("id, court_number, start_time, status, score_a, score_b, display_order, match_number, round_number, round_type, bracket_type, live_referee_id, team_a:doubles_elimination_teams!doubles_elimination_matches_team_a_id_fkey(team_name), team_b:doubles_elimination_teams!doubles_elimination_matches_team_b_id_fkey(team_name)")
          .eq("tournament_id", tournamentId)
          .neq("status", "completed")
          .order("display_order");
        return (data || []).map((m): DashboardMatch => {
          const phaseValue = `${m.round_type} ${m.bracket_type}`.toLowerCase();
          let phase: DashboardPhase = "playoff";
          if (phaseValue.includes("final")) phase = "final";
          else if (phaseValue.includes("loser")) phase = "losers";
          else if (phaseValue.includes("winner")) phase = "winners";

          return {
            id: m.id,
            courtNumber: m.court_number || 0,
            courtName: null,
            startTime: m.start_time,
            status: m.live_referee_id && m.status !== "completed"
              ? "live"
              : (m.status ?? "pending"),
            scoreA: m.score_a,
            scoreB: m.score_b,
            teamA: m.team_a?.team_name || "TBD",
            teamB: m.team_b?.team_name || "TBD",
            displayOrder: m.display_order,
            groupName: null,
            roundNumber: m.round_number,
            phase,
            matchNumber: m.match_number,
          };
        });
      }

      // Team Match - no court info
      const { data } = await supabase
        .from("team_match_matches")
        .select("id, status, games_won_a, games_won_b, total_points_a, total_points_b, display_order, is_playoff, playoff_round, round_number, group:team_match_groups(name), team_a:team_match_teams!team_match_matches_team_a_id_fkey(team_name), team_b:team_match_teams!team_match_matches_team_b_id_fkey(team_name)")
        .eq("tournament_id", tournamentId)
        .in("status", ["in_progress", "pending", "lineup"])
        .order("display_order");
      return (data || []).map((m): DashboardMatch => ({
        id: m.id,
        courtNumber: 0,
        courtName: null,
        startTime: null as string | null,
        status: (m.status === "in_progress" ? "live" : m.status) ?? "pending",
        scoreA: m.games_won_a,
        scoreB: m.games_won_b,
        teamA: m.team_a?.team_name || "TBD",
        teamB: m.team_b?.team_name || "TBD",
        displayOrder: m.display_order || 0,
        groupName: (m.group as { name?: string } | null)?.name ?? null,
        roundNumber: m.is_playoff ? m.playoff_round : m.round_number,
        phase: m.is_playoff ? "playoff" : "group",
        matchNumber: null,
      }));
    },
    enabled: !!tournamentId,
    refetchInterval: 10000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!tournamentId) return undefined;

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

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`dashboard-${type}-${tournamentId}:${Date.now()}_${Math.random().toString(36).slice(2,7)}`)
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
    } catch (err) {
      console.warn("[Dashboard] Realtime setup failed:", err);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [type, tournamentId, queryClient]);

  // Group matches into courts
  const courts = useMemo((): CourtData[] => {
    if (type === "team-match") {
      // No court grouping for team match
      return [];
    }

    const info = tournamentInfo.data as {
      court_count?: number | null;
      courts?: string[] | null;
    } | null | undefined;
    const configuredCourts = (info?.courts ?? [])
      .map((court) => Number.parseInt(court, 10))
      .filter((court) => Number.isInteger(court) && court > 0);

    return buildCourtData(matchesQuery.data || [], {
      type,
      configuredCourts,
      courtCount: info?.court_count ?? undefined,
    });
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

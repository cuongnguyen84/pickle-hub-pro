import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLikesCount(targetType: "video" | "livestream", targetId: string) {
  return useQuery({
    queryKey: ["likes-count", targetType, targetId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("target_type", targetType)
        .eq("target_id", targetId);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!targetId,
  });
}

export function useUserLiked(targetType: "video" | "livestream", targetId: string, userId?: string) {
  return useQuery({
    queryKey: ["user-liked", targetType, targetId, userId],
    queryFn: async () => {
      if (!userId) return false;
      
      const { data, error } = await supabase
        .from("likes")
        .select("id")
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!targetId && !!userId,
  });
}

export function useComments(targetType: "video" | "livestream", targetId: string) {
  return useQuery({
    queryKey: ["comments", targetType, targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!targetId,
  });
}

export function useViewCount(targetType: "video" | "livestream", targetId: string) {
  return useQuery({
    queryKey: ["view-count", targetType, targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_counts")
        .select("count")
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .maybeSingle();

      if (error) throw error;
      return data?.count ?? 0;
    },
    enabled: !!targetId,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useApprovedRegistrations(tableId: string) {
  return useQuery({
    queryKey: ["approved-registrations", tableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_table_registrations")
        .select("id, display_name, team, rating_system, skill_level, skill_system_name, skill_description")
        .eq("table_id", tableId)
        .eq("status", "approved")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!tableId,
  });
}

interface JoinedQuickTable {
  id: string;
  name: string;
  share_id: string;
  status: string;
  format: string;
  player_count: number;
  is_doubles: boolean;
  created_at: string;
  creator_user_id?: string;
}

type UserTournamentEntry = JoinedQuickTable & {
  registrationId: string;
  registrationStatus: string;
  teamStatus?: string;
  creator_display_name?: string;
};

export function useUserRegisteredTournaments(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-registered-tournaments", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data: singlesData, error: singlesError } = await supabase
        .from("quick_table_registrations")
        .select(`
          id, status, table_id,
          quick_tables:table_id (id, name, share_id, status, format, player_count, is_doubles, created_at, creator_user_id)
        `)
        .eq("user_id", userId)
        .in("status", ["pending", "approved"]);

      if (singlesError) throw singlesError;
      
      const { data: doublesData, error: doublesError } = await supabase
        .from("quick_table_teams")
        .select(`
          id, team_status, btc_approved, table_id,
          quick_tables:table_id (id, name, share_id, status, format, player_count, is_doubles, created_at, creator_user_id)
        `)
        .or(`player1_user_id.eq.${userId},player2_user_id.eq.${userId}`)
        .not("team_status", "in", "(rejected,removed)");

      if (doublesError) throw doublesError;
      
      const creatorIds = new Set<string>();
      singlesData.forEach(reg => {
        const table = reg.quick_tables as JoinedQuickTable | null;
        if (table?.creator_user_id) creatorIds.add(table.creator_user_id);
      });
      doublesData.forEach(team => {
        const table = team.quick_tables as JoinedQuickTable | null;
        if (table?.creator_user_id) creatorIds.add(table.creator_user_id);
      });
      
      let profilesMap = new Map<string, { display_name: string | null }>();
      if (creatorIds.size > 0) {
        const { data: profilesData } = await supabase
          .from("public_profiles")
          .select("id, display_name")
          .in("id", Array.from(creatorIds));
        
        if (profilesData) {
          profilesData.forEach(p => profilesMap.set(p.id, { display_name: p.display_name }));
        }
      }
      
      const tableMap = new Map<string, UserTournamentEntry>();
      
      singlesData
        .filter(reg => reg.quick_tables && (reg.quick_tables as JoinedQuickTable).status !== 'completed')
        .forEach(reg => {
          const table = reg.quick_tables as JoinedQuickTable;
          const profile = table.creator_user_id ? profilesMap.get(table.creator_user_id) : null;
          if (!tableMap.has(table.id)) {
            tableMap.set(table.id, {
              registrationId: reg.id,
              registrationStatus: reg.status,
              creator_display_name: profile?.display_name ?? undefined,
              ...table,
            });
          }
        });
      
      doublesData
        .filter(team => team.quick_tables && (team.quick_tables as JoinedQuickTable).status !== 'completed')
        .forEach(team => {
          const table = team.quick_tables as JoinedQuickTable;
          const profile = table.creator_user_id ? profilesMap.get(table.creator_user_id) : null;
          if (!tableMap.has(table.id)) {
            tableMap.set(table.id, {
              registrationId: team.id,
              registrationStatus: team.btc_approved ? 'approved' : 'pending',
              teamStatus: team.team_status,
              creator_display_name: profile?.display_name ?? undefined,
              ...table,
            });
          }
        });
      
      return Array.from(tableMap.values());
    },
    enabled: !!userId,
  });
}

export function useUserCompletedTournaments(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-completed-tournaments", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data: singlesData, error: singlesError } = await supabase
        .from("quick_table_registrations")
        .select(`
          id, status, table_id,
          quick_tables:table_id (id, name, share_id, status, format, player_count, is_doubles, created_at)
        `)
        .eq("user_id", userId)
        .eq("status", "approved");

      if (singlesError) throw singlesError;
      
      const { data: doublesData, error: doublesError } = await supabase
        .from("quick_table_teams")
        .select(`
          id, team_status, btc_approved, table_id,
          quick_tables:table_id (id, name, share_id, status, format, player_count, is_doubles, created_at)
        `)
        .or(`player1_user_id.eq.${userId},player2_user_id.eq.${userId}`)
        .eq("btc_approved", true);

      if (doublesError) throw doublesError;
      
      const tableMap = new Map<string, UserTournamentEntry>();
      
      singlesData
        .filter(reg => reg.quick_tables && (reg.quick_tables as JoinedQuickTable).status === 'completed')
        .forEach(reg => {
          const table = reg.quick_tables as JoinedQuickTable;
          if (!tableMap.has(table.id)) {
            tableMap.set(table.id, {
              registrationId: reg.id,
              registrationStatus: reg.status,
              ...table,
            });
          }
        });
      
      doublesData
        .filter(team => team.quick_tables && (team.quick_tables as JoinedQuickTable).status === 'completed')
        .forEach(team => {
          const table = team.quick_tables as JoinedQuickTable;
          if (!tableMap.has(table.id)) {
            tableMap.set(table.id, {
              registrationId: team.id,
              registrationStatus: 'approved',
              teamStatus: team.team_status,
              ...table,
            });
          }
        });
      
      return Array.from(tableMap.values());
    },
    enabled: !!userId,
  });
}

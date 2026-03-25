import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Livestream } from "./useLivestreamData";
import type { Video } from "./useVideoData";

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });
}

export function useTournaments() {
  return useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .order("start_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useTournamentBySlug(slug: string) {
  return useQuery({
    queryKey: ["tournament", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });
}

export function useTournamentContent(tournamentId: string) {
  return useQuery({
    queryKey: ["tournament-content", tournamentId],
    queryFn: async () => {
      const [livestreamsResult, videosResult] = await Promise.all([
        supabase
          .from("public_livestreams")
          .select(`*, organization:organizations(*)`)
          .eq("tournament_id", tournamentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("videos")
          .select(`*, organization:organizations(*)`)
          .eq("tournament_id", tournamentId)
          .eq("status", "published")
          .order("published_at", { ascending: false }),
      ]);

      if (livestreamsResult.error) throw livestreamsResult.error;
      if (videosResult.error) throw videosResult.error;

      return {
        livestreams: livestreamsResult.data as Livestream[],
        videos: videosResult.data as Video[],
      };
    },
    enabled: !!tournamentId,
  });
}

export type QuickTablePublic = {
  id: string;
  name: string;
  share_id: string;
  status: string;
  format: string;
  player_count: number;
  requires_registration: boolean;
  is_doubles: boolean;
  created_at: string;
  creator_user_id?: string;
  creator_display_name?: string;
};

export function useOpenRegistrationTables(options?: { limit?: number }) {
  return useQuery({
    queryKey: ["open-registration-tables", options],
    queryFn: async () => {
      let query = supabase
        .from("quick_tables")
        .select("id, name, share_id, status, format, player_count, requires_registration, is_doubles, created_at, creator_user_id")
        .eq("is_public", true)
        .eq("requires_registration", true)
        .eq("status", "setup")
        .order("created_at", { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data: tables, error } = await query;
      if (error) throw error;
      if (!tables || tables.length === 0) return [];
      
      const creatorIds = [...new Set(tables.map(t => t.creator_user_id).filter(Boolean))] as string[];
      
      if (creatorIds.length === 0) {
        return tables as QuickTablePublic[];
      }
      
      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in("id", creatorIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return tables.map((t) => {
        const profile = t.creator_user_id ? profileMap.get(t.creator_user_id) : null;
        return {
          ...t,
          creator_display_name: profile?.display_name,
        };
      }) as QuickTablePublic[];
    },
  });
}

export type TeamMatchTournamentPublic = {
  id: string;
  name: string;
  share_id: string;
  status: string;
  format: string;
  team_count: number;
  team_roster_size: number;
  created_at: string;
  created_by?: string;
  creator_display_name?: string;
};

export function useOpenTeamMatchTournaments(options?: { limit?: number }) {
  return useQuery({
    queryKey: ["open-team-match-tournaments", options],
    queryFn: async () => {
      let query = supabase
        .from("team_match_tournaments")
        .select("id, name, share_id, status, format, team_count, team_roster_size, created_at, created_by")
        .in("status", ["registration", "ongoing"])
        .order("created_at", { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data: tournaments, error } = await query;
      if (error) throw error;
      if (!tournaments || tournaments.length === 0) return [];

      const creatorIds = [...new Set(tournaments.map(t => t.created_by).filter(Boolean))] as string[];

      if (creatorIds.length === 0) {
        return tournaments as TeamMatchTournamentPublic[];
      }

      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in("id", creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return tournaments.map((t) => {
        const profile = t.created_by ? profileMap.get(t.created_by) : null;
        return {
          ...t,
          creator_display_name: profile?.display_name,
        };
      }) as TeamMatchTournamentPublic[];
    },
  });
}

export function useCompletedPublicQuickTables(options?: { limit?: number }) {
  return useQuery({
    queryKey: ["completed-public-quick-tables", options],
    queryFn: async () => {
      let query = supabase
        .from("quick_tables")
        .select("id, name, share_id, status, format, player_count, requires_registration, is_doubles, created_at, creator_user_id")
        .eq("is_public", true)
        .eq("status", "completed")
        .order("updated_at", { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data: tables, error } = await query;
      if (error) throw error;
      if (!tables || tables.length === 0) return [];

      const creatorIds = [...new Set(tables.map(t => t.creator_user_id).filter(Boolean))] as string[];
      if (creatorIds.length === 0) return tables as QuickTablePublic[];

      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in("id", creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return tables.map((t) => ({
        ...t,
        creator_display_name: t.creator_user_id ? profileMap.get(t.creator_user_id)?.display_name : undefined,
      })) as QuickTablePublic[];
    },
  });
}

export function useCompletedTeamMatchTournaments(options?: { limit?: number }) {
  return useQuery({
    queryKey: ["completed-team-match-tournaments", options],
    queryFn: async () => {
      let query = supabase
        .from("team_match_tournaments")
        .select("id, name, share_id, status, format, team_count, team_roster_size, created_at, created_by")
        .eq("status", "completed")
        .order("updated_at", { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data: tournaments, error } = await query;
      if (error) throw error;
      if (!tournaments || tournaments.length === 0) return [];

      const creatorIds = [...new Set(tournaments.map(t => t.created_by).filter(Boolean))] as string[];
      if (creatorIds.length === 0) return tournaments as TeamMatchTournamentPublic[];

      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in("id", creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return tournaments.map((t) => ({
        ...t,
        creator_display_name: t.created_by ? profileMap.get(t.created_by)?.display_name : undefined,
      })) as TeamMatchTournamentPublic[];
    },
  });
}

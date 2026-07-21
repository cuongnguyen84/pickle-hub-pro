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
        .select("*, organization:organizations(id, name, slug, logo_url)")
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
  /** Live count of APPROVED registrations — singles from quick_table_registrations,
   *  doubles from quick_table_teams. Undefined when the count query degraded (never
   *  block the list). Used for the social-proof badge; approved-only on purpose
   *  (pending is self-serve + never auto-resolves → would inflate). */
  registered_count?: number;
};

/**
 * One batched count query per registration table (singles vs doubles), NOT a
 * per-card fan-out. Returns each table with `registered_count`. A count-query
 * error degrades to `undefined` (no badge) rather than throwing — the list must
 * render even if counts fail.
 */
export async function attachQuickTableApprovedCounts<T extends { id: string; is_doubles?: boolean }>(
  tables: T[],
): Promise<(T & { registered_count?: number })[]> {
  const singlesIds = tables.filter((t) => !t.is_doubles).map((t) => t.id);
  const doublesIds = tables.filter((t) => t.is_doubles).map((t) => t.id);
  const empty = { data: [] as { table_id: string }[] };
  const [singles, doubles] = await Promise.all([
    singlesIds.length
      ? supabase.from("quick_table_registrations").select("table_id").in("table_id", singlesIds).eq("status", "approved")
      : Promise.resolve(empty),
    doublesIds.length
      ? supabase.from("quick_table_teams").select("table_id").in("table_id", doublesIds).eq("team_status", "approved")
      : Promise.resolve(empty),
  ]);
  const counts = new Map<string, number>();
  for (const r of singles.data ?? []) counts.set(r.table_id, (counts.get(r.table_id) ?? 0) + 1);
  for (const r of doubles.data ?? []) counts.set(r.table_id, (counts.get(r.table_id) ?? 0) + 1);
  return tables.map((t) => ({ ...t, registered_count: counts.get(t.id) }));
}

export function useOpenRegistrationTables(options?: { limit?: number }) {
  return useQuery({
    queryKey: ["open-registration-tables", options],
    staleTime: 30_000,
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

      const withCounts = await attachQuickTableApprovedCounts(tables);

      const creatorIds = [...new Set(tables.map(t => t.creator_user_id).filter(Boolean))] as string[];
      if (creatorIds.length === 0) {
        return withCounts as QuickTablePublic[];
      }

      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in("id", creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return withCounts.map((t) => {
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
  /** Live count of APPROVED teams (team_match_teams.status='approved'). Undefined
   *  when the count query degraded. Social-proof badge, approved-only. */
  registered_count?: number;
};

/** One batched count of approved teams keyed by tournament_id. Degrades to
 *  undefined on error (no badge), never throws. */
export async function attachTeamMatchApprovedCounts<T extends { id: string }>(
  rows: T[],
): Promise<(T & { registered_count?: number })[]> {
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return rows.map((r) => ({ ...r }));
  const { data } = await supabase
    .from("team_match_teams")
    .select("tournament_id")
    .in("tournament_id", ids)
    .eq("status", "approved");
  const counts = new Map<string, number>();
  for (const r of data ?? []) counts.set(r.tournament_id, (counts.get(r.tournament_id) ?? 0) + 1);
  return rows.map((r) => ({ ...r, registered_count: counts.get(r.id) }));
}

export function useOpenTeamMatchTournaments(options?: { limit?: number }) {
  return useQuery({
    queryKey: ["open-team-match-tournaments", options],
    staleTime: 30_000,
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

      const withCounts = await attachTeamMatchApprovedCounts(tournaments);

      const creatorIds = [...new Set(tournaments.map(t => t.created_by).filter(Boolean))] as string[];
      if (creatorIds.length === 0) {
        return withCounts as TeamMatchTournamentPublic[];
      }

      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in("id", creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return withCounts.map((t) => {
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

export function useActivePublicQuickTables(options?: { limit?: number }) {
  return useQuery({
    queryKey: ["active-public-quick-tables", options],
    queryFn: async () => {
      let query = supabase
        .from("quick_tables")
        .select("id, name, share_id, status, format, player_count, requires_registration, is_doubles, created_at, creator_user_id")
        .eq("is_public", true)
        .in("status", ["setup", "group_stage", "playoff"])
        .order("created_at", { ascending: false });

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

export type DoublesEliminationPublic = {
  id: string;
  name: string;
  share_id: string;
  status: string;
  team_count: number;
  created_at: string;
  creator_user_id?: string;
  creator_display_name?: string;
};

export function useActiveDoublesElimination(options?: { limit?: number }) {
  return useQuery({
    queryKey: ["active-doubles-elimination", options],
    queryFn: async () => {
      let query = supabase
        .from("doubles_elimination_tournaments")
        .select("id, name, share_id, status, team_count, created_at, creator_user_id")
        .in("status", ["active", "ongoing", "setup"])
        .order("created_at", { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data: tournaments, error } = await query;
      if (error) throw error;
      if (!tournaments || tournaments.length === 0) return [];

      const creatorIds = [...new Set(tournaments.map(t => t.creator_user_id).filter(Boolean))] as string[];
      if (creatorIds.length === 0) return tournaments as DoublesEliminationPublic[];

      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in("id", creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return tournaments.map((t) => ({
        ...t,
        creator_display_name: t.creator_user_id ? profileMap.get(t.creator_user_id)?.display_name : undefined,
      })) as DoublesEliminationPublic[];
    },
  });
}

export function useCompletedDoublesElimination(options?: { limit?: number }) {
  return useQuery({
    queryKey: ["completed-doubles-elimination", options],
    queryFn: async () => {
      let query = supabase
        .from("doubles_elimination_tournaments")
        .select("id, name, share_id, status, team_count, created_at, creator_user_id")
        .eq("status", "completed")
        .order("updated_at", { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data: tournaments, error } = await query;
      if (error) throw error;
      if (!tournaments || tournaments.length === 0) return [];

      const creatorIds = [...new Set(tournaments.map(t => t.creator_user_id).filter(Boolean))] as string[];
      if (creatorIds.length === 0) return tournaments as DoublesEliminationPublic[];

      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in("id", creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return tournaments.map((t) => ({
        ...t,
        creator_display_name: t.creator_user_id ? profileMap.get(t.creator_user_id)?.display_name : undefined,
      })) as DoublesEliminationPublic[];
    },
  });
}

export type FlexTournamentPublic = {
  id: string;
  name: string;
  share_id: string;
  status: string;
  is_public: boolean;
  created_at: string;
  creator_user_id: string;
  creator_display_name?: string;
};

export function useActiveFlexTournaments(options?: { limit?: number }) {
  return useQuery({
    queryKey: ["active-flex-tournaments", options],
    queryFn: async () => {
      let query = supabase
        .from("flex_tournaments")
        .select("id, name, share_id, status, is_public, created_at, creator_user_id")
        .eq("is_public", true)
        .in("status", ["active", "ongoing", "setup"])
        .order("created_at", { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data: tournaments, error } = await query;
      if (error) throw error;
      if (!tournaments || tournaments.length === 0) return [];

      const creatorIds = [...new Set(tournaments.map(t => t.creator_user_id).filter(Boolean))] as string[];
      if (creatorIds.length === 0) return tournaments as FlexTournamentPublic[];

      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in("id", creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return tournaments.map((t) => ({
        ...t,
        creator_display_name: t.creator_user_id ? profileMap.get(t.creator_user_id)?.display_name : undefined,
      })) as FlexTournamentPublic[];
    },
  });
}

export function useCompletedFlexTournaments(options?: { limit?: number }) {
  return useQuery({
    queryKey: ["completed-flex-tournaments", options],
    queryFn: async () => {
      let query = supabase
        .from("flex_tournaments")
        .select("id, name, share_id, status, is_public, created_at, creator_user_id")
        .eq("is_public", true)
        .eq("status", "completed")
        .order("updated_at", { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data: tournaments, error } = await query;
      if (error) throw error;
      if (!tournaments || tournaments.length === 0) return [];

      const creatorIds = [...new Set(tournaments.map(t => t.creator_user_id).filter(Boolean))] as string[];
      if (creatorIds.length === 0) return tournaments as FlexTournamentPublic[];

      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in("id", creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return tournaments.map((t) => ({
        ...t,
        creator_display_name: t.creator_user_id ? profileMap.get(t.creator_user_id)?.display_name : undefined,
      })) as FlexTournamentPublic[];
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

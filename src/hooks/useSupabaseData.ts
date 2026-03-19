import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fetchOrgDisplayLogos, attachOrgLogos } from "@/lib/fetch-org-logos";

// Types
type OrganizationWithLogo = Tables<"organizations"> & {
  display_logo?: string | null;
};

export type Video = Tables<"videos"> & {
  organization?: OrganizationWithLogo | null;
};

// Use public_livestreams view for public access (excludes mux_stream_key)
export type Livestream = Tables<"public_livestreams"> & {
  organization?: OrganizationWithLogo | null;
};

// Fetch published videos
export function useVideos(options?: { limit?: number; type?: "short" | "long" }) {
  return useQuery({
    queryKey: ["videos", options],
    queryFn: async () => {
      let query = supabase
        .from("videos")
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (options?.type) {
        query = query.eq("type", options.type);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Video[];
    },
  });
}

// Fetch single video by ID
export function useVideo(id: string) {
  return useQuery({
    queryKey: ["video", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      const video = data as Video;
      
      // Fetch display logo for organization
      if (video.organization && video.organization_id) {
        const { data: logo } = await supabase.rpc("get_organization_display_logo", { 
          org_id: video.organization_id 
        });
        video.organization.display_logo = logo as string | null;
      }
      
      return video;
    },
    enabled: !!id,
  });
}

export type LivestreamWithLogo = Tables<"public_livestreams"> & {
  organization?: OrganizationWithLogo | null;
};

// Fetch livestreams by status (uses public_livestreams view for security)
export function useLivestreams(status?: "live" | "scheduled" | "ended") {
  return useQuery({
    queryKey: ["livestreams", status],
    queryFn: async () => {
      let query = supabase
        .from("public_livestreams")
        .select(`
          *,
          organization:organizations(*)
        `)
        .order("scheduled_start_at", { ascending: true });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch display logos for each organization
      const livestreams = data as LivestreamWithLogo[];
      const orgIds = [...new Set(livestreams.map(l => l.organization_id).filter(Boolean))] as string[];
      
      if (orgIds.length > 0) {
        // Get display logos (org logo or creator avatar)
        const logoPromises = orgIds.map(async (orgId) => {
          const { data: logo } = await supabase.rpc("get_organization_display_logo", { org_id: orgId });
          return { orgId, logo: logo as string | null };
        });
        
        const logos = await Promise.all(logoPromises);
        const logoMap = Object.fromEntries(logos.map(l => [l.orgId, l.logo]));
        
        // Attach logos to organizations
        livestreams.forEach(l => {
          if (l.organization && l.organization_id) {
            l.organization.display_logo = logoMap[l.organization_id] || l.organization.logo_url;
          }
        });
      }
      
      return livestreams;
    },
  });
}

// Fetch single livestream by ID (uses public_livestreams view for security)
export function useLivestream(id: string) {
  return useQuery({
    queryKey: ["livestream", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_livestreams")
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      const livestream = data as LivestreamWithLogo;
      
      // Fetch display logo for organization
      if (livestream.organization && livestream.organization_id) {
        const { data: logo } = await supabase.rpc("get_organization_display_logo", { 
          org_id: livestream.organization_id 
        });
        livestream.organization.display_logo = logo as string | null;
      }
      
      return livestream;
    },
    enabled: !!id,
  });
}

// Fetch organizations
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

// Fetch tournaments
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

// Fetch single tournament by slug
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

// Fetch tournament content (livestreams and videos)
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

// Fetch ended livestreams with playback (replays) - supports both Mux and Ant Media
export function useReplays(options?: { limit?: number }) {
  return useQuery({
    queryKey: ["replays", options],
    queryFn: async () => {
      let query = supabase
        .from("public_livestreams")
        .select(`*, organization:organizations(*)`)
        .eq("status", "ended")
        .or("mux_playback_id.not.is.null,vod_url.not.is.null")
        .order("ended_at", { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      const replays = data as Livestream[];

      // Fetch display logos for organizations
      const orgIds = [...new Set(replays.map(r => r.organization_id).filter(Boolean))] as string[];
      if (orgIds.length > 0) {
        const logoPromises = orgIds.map(async (orgId) => {
          const { data: logo } = await supabase.rpc("get_organization_display_logo", { org_id: orgId });
          return { orgId, logo: logo as string | null };
        });
        const logos = await Promise.all(logoPromises);
        const logoMap: Record<string, string | null> = {};
        logos.forEach(({ orgId, logo }) => { logoMap[orgId] = logo; });
        replays.forEach(r => {
          if (r.organization && r.organization_id) {
            r.organization.display_logo = logoMap[r.organization_id] || r.organization.logo_url;
          }
        });
      }

      return replays;
    },
  });
}

// Fetch likes count for a target
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

// Check if user has liked a target
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

// Fetch comments for a target
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

// Fetch view count for a target (optimized: uses aggregate table instead of COUNT(*))
export function useViewCount(targetType: "video" | "livestream", targetId: string) {
  return useQuery({
    queryKey: ["view-count", targetType, targetId],
    queryFn: async () => {
      // Use the aggregate view_counts table for O(1) lookup instead of COUNT(*)
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
    // Optimize for high-traffic: cache for 30 seconds, refetch every 30s
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

// Fetch public quick tables with open registration
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
      
      // Get unique creator IDs
      const creatorIds = [...new Set(tables.map(t => t.creator_user_id).filter(Boolean))] as string[];
      
      if (creatorIds.length === 0) {
        return tables as QuickTablePublic[];
      }
      
      // Fetch profiles for all creators (use public_profiles view to avoid exposing emails)
      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in("id", creatorIds);
      
      // Map profiles to tables
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

// Public Team Match type
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

// Fetch open team match tournaments (registration or ongoing)
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

      // Get unique creator IDs
      const creatorIds = [...new Set(tournaments.map(t => t.created_by).filter(Boolean))] as string[];

      if (creatorIds.length === 0) {
        return tournaments as TeamMatchTournamentPublic[];
      }

      // Fetch profiles for all creators (use public_profiles view to avoid exposing emails)
      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in("id", creatorIds);

      // Map profiles to tournaments
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

// Fetch completed public quick tables
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

// Fetch completed team match tournaments
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

// Fetch approved registrations for a table (public view)
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

// Fetch tournaments user is registered for (active - not completed)
// Supports both singles (quick_table_registrations) and doubles (quick_table_teams)
export function useUserRegisteredTournaments(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-registered-tournaments", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // Get singles registrations
      const { data: singlesData, error: singlesError } = await supabase
        .from("quick_table_registrations")
        .select(`
          id,
          status,
          table_id,
          quick_tables:table_id (
            id,
            name,
            share_id,
            status,
            format,
            player_count,
            is_doubles,
            created_at,
            creator_user_id
          )
        `)
        .eq("user_id", userId)
        .in("status", ["pending", "approved"]);

      if (singlesError) throw singlesError;
      
      // Get doubles registrations (as player1 or player2)
      const { data: doublesData, error: doublesError } = await supabase
        .from("quick_table_teams")
        .select(`
          id,
          team_status,
          btc_approved,
          table_id,
          quick_tables:table_id (
            id,
            name,
            share_id,
            status,
            format,
            player_count,
            is_doubles,
            created_at,
            creator_user_id
          )
        `)
        .or(`player1_user_id.eq.${userId},player2_user_id.eq.${userId}`)
        .not("team_status", "in", "(rejected,removed)");

      if (doublesError) throw doublesError;
      
      // Collect all unique creator_user_ids
      const creatorIds = new Set<string>();
      singlesData.forEach(reg => {
        const table = reg.quick_tables as any;
        if (table?.creator_user_id) creatorIds.add(table.creator_user_id);
      });
      doublesData.forEach(team => {
        const table = team.quick_tables as any;
        if (table?.creator_user_id) creatorIds.add(table.creator_user_id);
      });
      
      // Fetch creator profiles (use public_profiles view to avoid exposing emails)
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
      
      // Combine and deduplicate by table_id
      const tableMap = new Map<string, any>();
      
      // Add singles registrations
      singlesData
        .filter(reg => reg.quick_tables && (reg.quick_tables as any).status !== 'completed')
        .forEach(reg => {
          const table = reg.quick_tables as any;
          const profile = profilesMap.get(table.creator_user_id);
          if (!tableMap.has(table.id)) {
            tableMap.set(table.id, {
              registrationId: reg.id,
              registrationStatus: reg.status,
              creator_display_name: profile?.display_name,
              ...table,
            });
          }
        });
      
      // Add doubles registrations
      doublesData
        .filter(team => team.quick_tables && (team.quick_tables as any).status !== 'completed')
        .forEach(team => {
          const table = team.quick_tables as any;
          const profile = profilesMap.get(table.creator_user_id);
          if (!tableMap.has(table.id)) {
            tableMap.set(table.id, {
              registrationId: team.id,
              registrationStatus: team.btc_approved ? 'approved' : 'pending',
              teamStatus: team.team_status,
              creator_display_name: profile?.display_name,
              ...table,
            });
          }
        });
      
      return Array.from(tableMap.values());
    },
    enabled: !!userId,
  });
}

// Fetch tournaments user has participated in (completed)
// Supports both singles and doubles
export function useUserCompletedTournaments(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-completed-tournaments", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // Get singles registrations
      const { data: singlesData, error: singlesError } = await supabase
        .from("quick_table_registrations")
        .select(`
          id,
          status,
          table_id,
          quick_tables:table_id (
            id,
            name,
            share_id,
            status,
            format,
            player_count,
            is_doubles,
            created_at
          )
        `)
        .eq("user_id", userId)
        .eq("status", "approved");

      if (singlesError) throw singlesError;
      
      // Get doubles registrations (as player1 or player2)
      const { data: doublesData, error: doublesError } = await supabase
        .from("quick_table_teams")
        .select(`
          id,
          team_status,
          btc_approved,
          table_id,
          quick_tables:table_id (
            id,
            name,
            share_id,
            status,
            format,
            player_count,
            is_doubles,
            created_at
          )
        `)
        .or(`player1_user_id.eq.${userId},player2_user_id.eq.${userId}`)
        .eq("btc_approved", true);

      if (doublesError) throw doublesError;
      
      // Combine and deduplicate by table_id
      const tableMap = new Map<string, any>();
      
      // Add singles registrations (completed tournaments only)
      singlesData
        .filter(reg => reg.quick_tables && (reg.quick_tables as any).status === 'completed')
        .forEach(reg => {
          const table = reg.quick_tables as any;
          if (!tableMap.has(table.id)) {
            tableMap.set(table.id, {
              registrationId: reg.id,
              registrationStatus: reg.status,
              ...table,
            });
          }
        });
      
      // Add doubles registrations (completed tournaments only)
      doublesData
        .filter(team => team.quick_tables && (team.quick_tables as any).status === 'completed')
        .forEach(team => {
          const table = team.quick_tables as any;
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

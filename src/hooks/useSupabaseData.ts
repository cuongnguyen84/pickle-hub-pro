import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

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

// Fetch ended livestreams with playback (replays)
export function useReplays(options?: { limit?: number }) {
  return useQuery({
    queryKey: ["replays", options],
    queryFn: async () => {
      let query = supabase
        .from("public_livestreams")
        .select(`*, organization:organizations(*)`)
        .eq("status", "ended")
        .not("mux_playback_id", "is", null)
        .order("ended_at", { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Livestream[];
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

// Fetch view count for a target
export function useViewCount(targetType: "video" | "livestream", targetId: string) {
  return useQuery({
    queryKey: ["view-count", targetType, targetId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("view_events")
        .select("*", { count: "exact", head: true })
        .eq("target_type", targetType)
        .eq("target_id", targetId);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!targetId,
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
};

export function useOpenRegistrationTables(options?: { limit?: number }) {
  return useQuery({
    queryKey: ["open-registration-tables", options],
    queryFn: async () => {
      let query = supabase
        .from("quick_tables")
        .select("id, name, share_id, status, format, player_count, requires_registration, is_doubles, created_at")
        .eq("is_public", true)
        .eq("requires_registration", true)
        .eq("status", "setup")
        .order("created_at", { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as QuickTablePublic[];
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
            created_at
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
            created_at
          )
        `)
        .or(`player1_user_id.eq.${userId},player2_user_id.eq.${userId}`)
        .not("team_status", "in", "(rejected,removed)");

      if (doublesError) throw doublesError;
      
      // Combine and deduplicate by table_id
      const tableMap = new Map<string, any>();
      
      // Add singles registrations
      singlesData
        .filter(reg => reg.quick_tables && (reg.quick_tables as any).status !== 'completed')
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
      
      // Add doubles registrations
      doublesData
        .filter(team => team.quick_tables && (team.quick_tables as any).status !== 'completed')
        .forEach(team => {
          const table = team.quick_tables as any;
          if (!tableMap.has(table.id)) {
            tableMap.set(table.id, {
              registrationId: team.id,
              registrationStatus: team.btc_approved ? 'approved' : 'pending',
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

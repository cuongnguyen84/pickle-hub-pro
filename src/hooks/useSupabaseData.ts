import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// Types
export type Video = Tables<"videos"> & {
  organization?: Tables<"organizations"> | null;
};

// Use public_livestreams view for public access (excludes mux_stream_key)
export type Livestream = Tables<"public_livestreams"> & {
  organization?: Tables<"organizations"> | null;
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
      return data as Video;
    },
    enabled: !!id,
  });
}

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
        .order("started_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Livestream[];
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
      return data as Livestream;
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

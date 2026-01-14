import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// Stats for creator overview
export function useCreatorStats(organizationId: string | null) {
  return useQuery({
    queryKey: ["creator-stats", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      const [videosPublished, videosDraft, scheduledStreams, liveStreams, weeklyViews] = await Promise.all([
        supabase
          .from("videos")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("status", "published"),
        supabase
          .from("videos")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("status", "draft"),
        supabase
          .from("livestreams")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("status", "scheduled"),
        supabase
          .from("livestreams")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("status", "live"),
        supabase
          .from("view_events")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      return {
        videosPublished: videosPublished.count ?? 0,
        videosDraft: videosDraft.count ?? 0,
        scheduledStreams: scheduledStreams.count ?? 0,
        liveStreams: liveStreams.count ?? 0,
        weeklyViews: weeklyViews.count ?? 0,
      };
    },
    enabled: !!organizationId,
  });
}

// Recent videos for creator
export function useCreatorRecentVideos(organizationId: string | null) {
  return useQuery({
    queryKey: ["creator-recent-videos", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
}

// Recent livestreams for creator
export function useCreatorRecentLivestreams(organizationId: string | null) {
  return useQuery({
    queryKey: ["creator-recent-livestreams", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("livestreams")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
}

// Videos list with filters
export function useCreatorVideos(
  organizationId: string | null,
  filters: { type?: string; status?: string; search?: string }
) {
  return useQuery({
    queryKey: ["creator-videos", organizationId, filters],
    queryFn: async () => {
      if (!organizationId) return [];
      
      let query = supabase
        .from("videos")
        .select("*, tournaments(name)")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (filters.type && filters.type !== "all") {
        query = query.eq("type", filters.type as "short" | "long");
      }
      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status as "draft" | "published" | "hidden");
      }
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,tags.cs.{${filters.search}}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
}

// Single video for edit
export function useCreatorVideo(videoId: string | undefined, organizationId: string | null) {
  return useQuery({
    queryKey: ["creator-video", videoId],
    queryFn: async () => {
      if (!videoId || !organizationId) return null;
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("id", videoId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!videoId && !!organizationId,
  });
}

// Video mutations
export function useVideoMutations(organizationId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createVideo = useMutation({
    mutationFn: async (video: Omit<TablesInsert<"videos">, "organization_id">) => {
      if (!organizationId) throw new Error("No organization");
      const { data, error } = await supabase
        .from("videos")
        .insert({ ...video, organization_id: organizationId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-videos"] });
      queryClient.invalidateQueries({ queryKey: ["creator-recent-videos"] });
      queryClient.invalidateQueries({ queryKey: ["creator-stats"] });
      toast({ title: "Video created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error creating video", description: error.message, variant: "destructive" });
    },
  });

  const updateVideo = useMutation({
    mutationFn: async ({ id, ...video }: TablesUpdate<"videos"> & { id: string }) => {
      if (!organizationId) throw new Error("No organization");
      const { data, error } = await supabase
        .from("videos")
        .update(video)
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-videos"] });
      queryClient.invalidateQueries({ queryKey: ["creator-video"] });
      queryClient.invalidateQueries({ queryKey: ["creator-recent-videos"] });
      queryClient.invalidateQueries({ queryKey: ["creator-stats"] });
      toast({ title: "Video updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error updating video", description: error.message, variant: "destructive" });
    },
  });

  const deleteVideo = useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) throw new Error("No organization");
      const { error } = await supabase
        .from("videos")
        .delete()
        .eq("id", id)
        .eq("organization_id", organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-videos"] });
      queryClient.invalidateQueries({ queryKey: ["creator-recent-videos"] });
      queryClient.invalidateQueries({ queryKey: ["creator-stats"] });
      toast({ title: "Video deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error deleting video", description: error.message, variant: "destructive" });
    },
  });

  return { createVideo, updateVideo, deleteVideo };
}

// Livestreams list with filters
export function useCreatorLivestreams(
  organizationId: string | null,
  filters: { status?: string }
) {
  return useQuery({
    queryKey: ["creator-livestreams", organizationId, filters],
    queryFn: async () => {
      if (!organizationId) return [];
      
      let query = supabase
        .from("livestreams")
        .select("*, tournaments(name)")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status as "scheduled" | "live" | "ended");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
}

// Single livestream for edit (includes stream key for creators)
export function useCreatorLivestream(livestreamId: string | undefined, organizationId: string | null) {
  return useQuery({
    queryKey: ["creator-livestream", livestreamId],
    queryFn: async () => {
      if (!livestreamId || !organizationId) return null;
      const { data, error } = await supabase
        .from("livestreams")
        .select("*")
        .eq("id", livestreamId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!livestreamId && !!organizationId,
  });
}

// Livestream mutations
export function useLivestreamMutations(organizationId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createLivestream = useMutation({
    mutationFn: async (livestream: Omit<TablesInsert<"livestreams">, "organization_id">) => {
      if (!organizationId) throw new Error("No organization");
      const { data, error } = await supabase
        .from("livestreams")
        .insert({ ...livestream, organization_id: organizationId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-livestreams"] });
      queryClient.invalidateQueries({ queryKey: ["creator-recent-livestreams"] });
      queryClient.invalidateQueries({ queryKey: ["creator-stats"] });
      toast({ title: "Livestream created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error creating livestream", description: error.message, variant: "destructive" });
    },
  });

  const updateLivestream = useMutation({
    mutationFn: async ({ id, ...livestream }: TablesUpdate<"livestreams"> & { id: string }) => {
      if (!organizationId) throw new Error("No organization");
      const { data, error } = await supabase
        .from("livestreams")
        .update(livestream)
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-livestreams"] });
      queryClient.invalidateQueries({ queryKey: ["creator-livestream"] });
      queryClient.invalidateQueries({ queryKey: ["creator-recent-livestreams"] });
      queryClient.invalidateQueries({ queryKey: ["creator-stats"] });
      toast({ title: "Livestream updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error updating livestream", description: error.message, variant: "destructive" });
    },
  });

  const deleteLivestream = useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) throw new Error("No organization");
      const { error } = await supabase
        .from("livestreams")
        .delete()
        .eq("id", id)
        .eq("organization_id", organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-livestreams"] });
      queryClient.invalidateQueries({ queryKey: ["creator-recent-livestreams"] });
      queryClient.invalidateQueries({ queryKey: ["creator-stats"] });
      toast({ title: "Livestream deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error deleting livestream", description: error.message, variant: "destructive" });
    },
  });

  return { createLivestream, updateLivestream, deleteLivestream };
}

// Organization for settings
export function useCreatorOrganization(organizationId: string | null) {
  return useQuery({
    queryKey: ["creator-organization", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", organizationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
}

// Tournaments for dropdown
export function useCreatorTournaments() {
  return useQuery({
    queryKey: ["creator-tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fetchOrgDisplayLogos, attachOrgLogos } from "@/lib/fetch-org-logos";

type OrganizationWithLogo = Tables<"organizations"> & {
  display_logo?: string | null;
};

export type Video = Tables<"videos"> & {
  organization?: OrganizationWithLogo | null;
};

export function useVideos(options?: { limit?: number; type?: "short" | "long" }) {
  return useQuery({
    queryKey: ["videos", options],
    queryFn: async () => {
      let query = supabase
        .from("videos")
        .select(`*, organization:organizations(*)`)
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

export function useVideo(id: string) {
  return useQuery({
    queryKey: ["video", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select(`*, organization:organizations(*)`)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      const video = data as Video;
      
      if (video.organization && video.organization_id) {
        const logoMap = await fetchOrgDisplayLogos([video.organization_id]);
        attachOrgLogos([video], logoMap);
      }
      
      return video;
    },
    enabled: !!id,
  });
}

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

      const replays = data as (Tables<"public_livestreams"> & { organization?: OrganizationWithLogo | null })[];
      const orgIds = [...new Set(replays.map(r => r.organization_id).filter(Boolean))] as string[];
      if (orgIds.length > 0) {
        const logoMap = await fetchOrgDisplayLogos(orgIds);
        attachOrgLogos(replays, logoMap);
      }

      return replays;
    },
  });
}

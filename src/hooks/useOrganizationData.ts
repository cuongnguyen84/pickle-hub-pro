import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Livestream, Video } from "./useSupabaseData";

export type Organization = Tables<"organizations"> & {
  display_logo?: string | null;
};

// Fetch single organization by slug
export function useOrganizationBySlug(slug: string) {
  return useQuery({
    queryKey: ["organization", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) throw error;

      // Get display logo (org logo or creator avatar fallback)
      const { data: displayLogo } = await supabase.rpc(
        "get_organization_display_logo",
        { org_id: data.id }
      );

      return {
        ...data,
        display_logo: displayLogo,
      } as Organization;
    },
    enabled: !!slug,
  });
}

// Fetch organization content (livestreams and videos)
export function useOrganizationContent(organizationId: string) {
  return useQuery({
    queryKey: ["organization-content", organizationId],
    queryFn: async () => {
      const [livestreamsResult, videosResult] = await Promise.all([
        supabase
          .from("public_livestreams")
          .select(`*, organization:organizations(*)`)
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false }),
        supabase
          .from("videos")
          .select(`*, organization:organizations(*)`)
          .eq("organization_id", organizationId)
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
    enabled: !!organizationId,
  });
}

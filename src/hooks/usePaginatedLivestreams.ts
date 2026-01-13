import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type OrganizationWithLogo = Tables<"organizations"> & {
  display_logo?: string | null;
};

export type LivestreamWithLogo = Tables<"public_livestreams"> & {
  organization?: OrganizationWithLogo | null;
};

const PAGE_SIZE = 20;

interface UsePaginatedLivestreamsOptions {
  status?: "live" | "scheduled" | "ended";
}

export function usePaginatedLivestreams(options?: UsePaginatedLivestreamsOptions) {
  return useInfiniteQuery({
    queryKey: ["livestreams-paginated", options],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from("public_livestreams")
        .select(`
          *,
          organization:organizations(*)
        `)
        .order("scheduled_start_at", { ascending: true })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (options?.status) {
        query = query.eq("status", options.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Batch fetch display logos for organizations
      const livestreams = data as LivestreamWithLogo[];
      const orgIds = [...new Set(livestreams.map(l => l.organization_id).filter(Boolean))] as string[];
      
      if (orgIds.length > 0) {
        const logoPromises = orgIds.map(async (orgId) => {
          const { data: logo } = await supabase.rpc("get_organization_display_logo", { org_id: orgId });
          return { orgId, logo: logo as string | null };
        });
        
        const logos = await Promise.all(logoPromises);
        const logoMap = Object.fromEntries(logos.map(l => [l.orgId, l.logo]));
        
        livestreams.forEach(l => {
          if (l.organization && l.organization_id) {
            l.organization.display_logo = logoMap[l.organization_id] || l.organization.logo_url;
          }
        });
      }
      
      return {
        items: livestreams,
        nextPage: data.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Replays (ended livestreams with playback)
export function usePaginatedReplays() {
  return useInfiniteQuery({
    queryKey: ["replays-paginated"],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase
        .from("public_livestreams")
        .select(`*, organization:organizations(*)`)
        .eq("status", "ended")
        .not("mux_playback_id", "is", null)
        .order("ended_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      
      return {
        items: data as LivestreamWithLogo[],
        nextPage: data.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 30 * 1000,
  });
}

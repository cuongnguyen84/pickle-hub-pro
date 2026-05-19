import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fetchOrgDisplayLogos, attachOrgLogos } from "@/lib/fetch-org-logos";

type OrganizationWithLogo = Tables<"organizations"> & {
  display_logo?: string | null;
};

export type Video = Tables<"videos"> & {
  organization?: OrganizationWithLogo | null;
};

const PAGE_SIZE = 20;

interface UsePaginatedVideosOptions {
  type?: "short" | "long";
}

export function usePaginatedVideos(options?: UsePaginatedVideosOptions) {
  return useInfiniteQuery({
    queryKey: ["videos-paginated", options],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from("videos")
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (options?.type) {
        query = query.eq("type", options.type);
      }

      const { data, error } = await query;
      if (error) throw error;

      const videos = data as Video[];

      const orgIds = [...new Set(videos.map(v => v.organization_id).filter(Boolean))] as string[];
      if (orgIds.length > 0) {
        const logoMap = await fetchOrgDisplayLogos(orgIds);
        attachOrgLogos(videos, logoMap);
      }

      return {
        items: videos,
        nextPage: data.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 30 * 1000,
  });
}

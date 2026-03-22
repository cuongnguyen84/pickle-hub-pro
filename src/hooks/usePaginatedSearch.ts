import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type OrganizationWithLogo = Tables<"organizations"> & {
  display_logo?: string | null;
};

export type SearchVideo = Tables<"videos"> & {
  organization?: OrganizationWithLogo | null;
};

export type SearchLivestream = Tables<"public_livestreams"> & {
  organization?: OrganizationWithLogo | null;
};

export type SearchTournament = Pick<
  Tables<"tournaments">,
  "id" | "name" | "slug" | "description" | "status" | "start_date" | "end_date"
>;

const PAGE_SIZE = 20;

export function usePaginatedSearchVideos(query: string) {
  return useInfiniteQuery({
    queryKey: ["search-videos", query],
    queryFn: async ({ pageParam = 0 }) => {
      let q = supabase
        .from("videos")
        .select("*, organization:organizations(*)")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (query) {
        q = q.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      }

      const { data, error } = await q;
      if (error) throw error;

      return {
        items: data as SearchVideo[],
        nextPage: data.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: query.length > 0,
    staleTime: 30_000,
  });
}

export function usePaginatedSearchLivestreams(query: string) {
  return useInfiniteQuery({
    queryKey: ["search-livestreams", query],
    queryFn: async ({ pageParam = 0 }) => {
      let q = supabase
        .from("public_livestreams")
        .select("*, organization:organizations(*)")
        .order("created_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (query) {
        q = q.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      }

      const { data, error } = await q;
      if (error) throw error;

      return {
        items: data as SearchLivestream[],
        nextPage: data.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: query.length > 0,
    staleTime: 30_000,
  });
}

export function usePaginatedSearchTournaments(query: string) {
  return useInfiniteQuery({
    queryKey: ["search-tournaments", query],
    queryFn: async ({ pageParam = 0 }) => {
      let q = supabase
        .from("tournaments")
        .select("id, name, slug, description, status, start_date, end_date")
        .order("start_date", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (query) {
        q = q.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
      }

      const { data, error } = await q;
      if (error) throw error;

      return {
        items: data as SearchTournament[],
        nextPage: data.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: query.length > 0,
    staleTime: 5 * 60_000,
  });
}

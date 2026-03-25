import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fetchOrgDisplayLogos, attachOrgLogos } from "@/lib/fetch-org-logos";

type OrganizationWithLogo = Tables<"organizations"> & {
  display_logo?: string | null;
};

export type Livestream = Tables<"public_livestreams"> & {
  organization?: OrganizationWithLogo | null;
};

export type LivestreamWithLogo = Tables<"public_livestreams"> & {
  organization?: OrganizationWithLogo | null;
};

export function useLivestreams(status?: "live" | "scheduled" | "ended") {
  return useQuery({
    queryKey: ["livestreams", status],
    queryFn: async () => {
      let query = supabase
        .from("public_livestreams")
        .select(`*, organization:organizations(*)`)
        .order("scheduled_start_at", { ascending: true });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const livestreams = data as LivestreamWithLogo[];
      const orgIds = [...new Set(livestreams.map(l => l.organization_id).filter(Boolean))] as string[];
      
      if (orgIds.length > 0) {
        const logoMap = await fetchOrgDisplayLogos(orgIds);
        attachOrgLogos(livestreams, logoMap);
      }
      
      return livestreams;
    },
  });
}

export function useLivestream(id: string) {
  return useQuery({
    queryKey: ["livestream", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_livestreams")
        .select(`*, organization:organizations(*)`)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      const livestream = data as LivestreamWithLogo;
      
      if (livestream.organization && livestream.organization_id) {
        const logoMap = await fetchOrgDisplayLogos([livestream.organization_id]);
        attachOrgLogos([livestream], logoMap);
      }
      
      return livestream;
    },
    enabled: !!id,
  });
}

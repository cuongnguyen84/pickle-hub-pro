import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Types
export interface AnalyticsSummary {
  total_views: number;
  total_livestreams: number;
  total_videos: number;
  followers_count: number;
  live_now: number;
}

export interface ViewsOverTime {
  date: string;
  views: number;
}

export interface TopContent {
  id: string;
  title: string;
  thumbnail_url: string | null;
  content_type: "video" | "livestream";
  view_count: number;
}

export interface ViewsByType {
  video: number;
  livestream: number;
}

// Hook for analytics summary (KPIs)
export function useAnalyticsSummary(organizationId: string | null, days: number = 30) {
  return useQuery({
    queryKey: ["analytics-summary", organizationId, days],
    queryFn: async () => {
      if (!organizationId) return null;

      const { data, error } = await supabase.rpc("get_org_analytics_summary", {
        _org_id: organizationId,
        _days: days,
      });

      if (error) throw error;
      return data as unknown as AnalyticsSummary;
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook for views over time chart
export function useViewsOverTime(organizationId: string | null, days: number = 7) {
  return useQuery({
    queryKey: ["analytics-views-over-time", organizationId, days],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase.rpc("get_org_views_over_time", {
        _org_id: organizationId,
        _days: days,
      });

      if (error) throw error;
      return (data as unknown as ViewsOverTime[]) || [];
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
  });
}

// Hook for top performing content
export function useTopContent(organizationId: string | null, days: number = 30, limit: number = 5) {
  return useQuery({
    queryKey: ["analytics-top-content", organizationId, days, limit],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase.rpc("get_org_top_content", {
        _org_id: organizationId,
        _days: days,
        _limit: limit,
      });

      if (error) throw error;
      return (data as unknown as TopContent[]) || [];
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
  });
}

// Hook for views by content type
export function useViewsByType(organizationId: string | null, days: number = 30) {
  return useQuery({
    queryKey: ["analytics-views-by-type", organizationId, days],
    queryFn: async () => {
      if (!organizationId) return { video: 0, livestream: 0 };

      const { data, error } = await supabase.rpc("get_org_views_by_type", {
        _org_id: organizationId,
        _days: days,
      });

      if (error) throw error;
      return data as unknown as ViewsByType;
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
  });
}

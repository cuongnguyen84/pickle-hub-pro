import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";

export interface SystemSettings {
  require_login_livestream: boolean;
  livestream_preview_seconds: number;
  livestream_gate_applies_to: "all" | "live" | "replay";
  geo_block_enabled: boolean;
  blocked_countries: string[];
  require_login_tournament_detail: boolean;
  shop_sepay_gateway_enabled: boolean;
}

const DEFAULT_SETTINGS: SystemSettings = {
  require_login_livestream: true,
  livestream_preview_seconds: 30,
  livestream_gate_applies_to: "all",
  geo_block_enabled: true,
  blocked_countries: ["US"],
  require_login_tournament_detail: false,
  shop_sepay_gateway_enabled: false,
};

async function fetchSystemSettings(): Promise<SystemSettings> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("key, value");

  if (error) {
    console.error("[useSystemSettings] Error fetching:", error);
    return DEFAULT_SETTINGS;
  }

  const settings = { ...DEFAULT_SETTINGS };
  for (const row of data || []) {
    const key = row.key as keyof SystemSettings;
    if (key in settings) {
      (settings as Record<string, Json>)[key] = row.value;
    }
  }
  return settings;
}

export function useSystemSettings() {
  return useQuery({
    queryKey: ["system-settings"],
    queryFn: fetchSystemSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateSystemSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Json }) => {
      const { error } = await supabase
        .from("system_settings")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("key", key);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    },
    onError: (error) => {
      console.error("[useSystemSettings] Update failed:", error);
      toast({
        title: "Lưu cài đặt thất bại",
        description: error?.message ?? "Không thể lưu. Vui lòng thử lại.",
        variant: "destructive",
      });
      // Roll back the optimistic switch flip by refetching the true state.
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    },
  });
}

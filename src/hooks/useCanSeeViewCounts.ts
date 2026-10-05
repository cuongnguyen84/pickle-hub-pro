import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lượt xem (blog + livestream) chỉ hiện cho creator/admin — người xem thường
 * không thấy. Chỉ ẩn ở UI; số liệu vẫn đếm bình thường.
 */
export function useCanSeeViewCounts(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["can-see-view-counts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .in("role", ["creator", "admin"]);
      if (error) return false;
      return data.length > 0;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
  return !!user && !!data;
}

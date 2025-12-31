import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUpdateUserQuota() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, quota }: { userId: string; quota: number }) => {
      const { data, error } = await supabase.rpc('set_user_quota', {
        _user_id: userId,
        _new_quota: quota
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

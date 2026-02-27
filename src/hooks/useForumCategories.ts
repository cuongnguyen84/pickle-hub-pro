import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
}

export const useForumCategories = () => {
  return useQuery({
    queryKey: ["forum-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forum_categories")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as ForumCategory[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

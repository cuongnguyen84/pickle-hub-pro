import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Search profiles for the @-mention dropdown in CommentInput. Looks up
 * username and display_name (case-insensitive ILIKE prefix match) and
 * returns up to 8 suggestions ordered by username ascending.
 *
 * The query is enabled only when the trigger string is non-empty so the
 * dropdown doesn't fire on every keystroke before the user has typed
 * anything after `@`. When the consumer dismisses the dropdown they
 * simply pass `null` / `""` to disable.
 */

export interface MentionSuggestion {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

const LIMIT = 8;

export function useMentionAutocomplete(query: string | null) {
  const trimmed = (query ?? "").trim();
  return useQuery({
    queryKey: ["mention-autocomplete", trimmed.toLowerCase()] as const,
    enabled: trimmed.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<MentionSuggestion[]> => {
      // Postgres ILIKE escape — `%` and `_` would otherwise expand. The
      // trigger string is user input typed inside an `@…` mention so an
      // attacker can't inject a wildcard, but we still belt the % so
      // `@%` doesn't match the entire user table.
      const escaped = trimmed.replace(/[\\%_]/g, (m) => `\\${m}`);
      const pattern = `${escaped}%`;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_ghost")
        .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
        .eq("is_ghost", false)
        .not("username", "is", null)
        .order("username", { ascending: true })
        .limit(LIMIT);
      if (error) throw error;
      return (data ?? [])
        .filter((row): row is typeof row & { username: string } =>
          typeof row.username === "string" && row.username.length > 0,
        )
        .map((row) => ({
          id: row.id,
          username: row.username,
          display_name: row.display_name,
          avatar_url: row.avatar_url,
        }));
    },
  });
}

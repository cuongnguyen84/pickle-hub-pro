
-- Create RPC function for chat leaderboard (server-side aggregation)
CREATE OR REPLACE FUNCTION public.get_chat_leaderboard(_livestream_id uuid, _limit int DEFAULT 10)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, message_count bigint, rank bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cm.user_id,
    cm.display_name,
    cm.avatar_url,
    COUNT(*) AS message_count,
    ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) AS rank
  FROM chat_messages cm
  WHERE cm.livestream_id = _livestream_id
  GROUP BY cm.user_id, cm.display_name, cm.avatar_url
  ORDER BY message_count DESC
  LIMIT _limit;
$$;

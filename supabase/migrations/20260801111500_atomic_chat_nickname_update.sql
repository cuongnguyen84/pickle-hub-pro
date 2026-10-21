-- Native chat nickname update. Keep validation and the seven-day cooldown on
-- the server so every client observes the same rule and no profiles column
-- privilege can make a legitimate self-update fail.
CREATE OR REPLACE FUNCTION public.update_chat_nickname(p_display_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_name TEXT := btrim(p_display_name);
  v_last_updated TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_name) < 2 OR char_length(v_name) > 30 THEN
    RAISE EXCEPTION 'nickname must contain 2 to 30 characters'
      USING ERRCODE = '22023';
  END IF;

  SELECT display_name_updated_at
    INTO v_last_updated
    FROM public.profiles
   WHERE id = v_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_last_updated IS NOT NULL
     AND v_last_updated > now() - INTERVAL '7 days' THEN
    RAISE EXCEPTION 'nickname can only be changed once every 7 days'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
     SET display_name = v_name,
         display_name_updated_at = now()
   WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_chat_nickname(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_chat_nickname(TEXT) TO authenticated;

COMMENT ON FUNCTION public.update_chat_nickname(TEXT) IS
  'Atomically updates the authenticated user chat nickname with a seven-day cooldown.';


DROP FUNCTION IF EXISTS public.lookup_user_by_email(text);

CREATE OR REPLACE FUNCTION public.lookup_user_by_email(lookup_email text)
RETURNS TABLE(id uuid, email text, display_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.display_name
  FROM profiles p
  WHERE p.email = lower(trim(lookup_email))
  LIMIT 1;
END;
$$;

-- ==============================================
-- Security Fix: Email Exposure Vulnerability
-- Drop policies that expose all user emails
-- Create secure SECURITY DEFINER functions for referee lookup
-- ==============================================

-- Drop the dangerous policies that expose all emails
DROP POLICY IF EXISTS "Table creators can lookup profiles by email" ON public.profiles;
DROP POLICY IF EXISTS "Doubles elimination creators can lookup profiles by email" ON public.profiles;
DROP POLICY IF EXISTS "Team match creators can lookup profiles by email" ON public.profiles;

-- Create a SECURITY DEFINER function for safe referee/user lookup by email
-- This function only returns user_id and display_name, NOT the email
CREATE OR REPLACE FUNCTION public.lookup_user_by_email(lookup_email TEXT)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow authenticated users to lookup
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Return only non-sensitive info
  RETURN QUERY
  SELECT 
    p.id AS user_id,
    p.display_name,
    p.avatar_url
  FROM public.profiles p
  WHERE p.email = lookup_email
  LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.lookup_user_by_email(TEXT) TO authenticated;

-- Add comment length constraint to prevent storage abuse
ALTER TABLE public.comments 
ADD CONSTRAINT comments_content_length 
CHECK (length(content) <= 2000);

-- Add display_name length constraint
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_display_name_length
CHECK (display_name IS NULL OR length(display_name) <= 100);

-- Add constraint for video titles
ALTER TABLE public.videos
ADD CONSTRAINT videos_title_length
CHECK (length(title) <= 200);

-- Add constraint for video descriptions
ALTER TABLE public.videos
ADD CONSTRAINT videos_description_length
CHECK (description IS NULL OR length(description) <= 5000);
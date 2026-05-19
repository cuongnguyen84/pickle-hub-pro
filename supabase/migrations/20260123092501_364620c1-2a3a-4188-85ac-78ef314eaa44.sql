-- QA/QC Final Security Fixes v2
-- Fix remaining Critical & High issues before Play Store release

-- ================================================
-- FIX 1: Protect profiles email - Only show own email
-- ================================================

-- Drop existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

-- Create view for public profile data (without email)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  display_name,
  avatar_url,
  organization_id,
  created_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- RLS for profiles table: users can only see their own full profile
CREATE POLICY "Users can view own full profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow anon to view basic profile info via security definer function
CREATE OR REPLACE FUNCTION public.get_public_profile(profile_id uuid)
RETURNS TABLE(id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE p.id = profile_id;
$$;

-- Function to get multiple public profiles (for lists)
CREATE OR REPLACE FUNCTION public.get_public_profiles(profile_ids uuid[])
RETURNS TABLE(id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE p.id = ANY(profile_ids);
$$;

-- ================================================
-- FIX 2: Fix function search_path for existing functions
-- ================================================

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      SPLIT_PART(NEW.email, '@', 1)
    )
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  
  RETURN NEW;
END;
$$;

-- Fix increment_view_count function
CREATE OR REPLACE FUNCTION public.increment_view_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.view_counts (target_type, target_id, count, last_updated_at)
  VALUES (NEW.target_type, NEW.target_id, 1, now())
  ON CONFLICT (target_type, target_id)
  DO UPDATE SET 
    count = view_counts.count + 1,
    last_updated_at = now();
  RETURN NEW;
END;
$$;

-- ================================================
-- FIX 3: Fix RLS policies with USING(true) for write operations
-- ================================================

-- Check and fix view_events policies
DROP POLICY IF EXISTS "Anyone can insert view events" ON public.view_events;
DROP POLICY IF EXISTS "Public insert for view events" ON public.view_events;

-- View events should allow anyone to insert (for analytics)
-- But we validate the data structure
CREATE POLICY "Validated view event inserts"
  ON public.view_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    target_type IS NOT NULL 
    AND target_id IS NOT NULL
  );

-- ================================================
-- FIX 4: Secure public_livestreams view with correct column names
-- ================================================

-- Drop and recreate view without SECURITY DEFINER
DROP VIEW IF EXISTS public.public_livestreams;

CREATE VIEW public.public_livestreams AS
SELECT 
  id,
  title,
  description,
  status,
  scheduled_start_at,
  started_at,
  ended_at,
  thumbnail_url,
  mux_playback_id,
  mux_asset_id,
  mux_asset_playback_id,
  organization_id,
  tournament_id,
  created_at
FROM public.livestreams;

-- This view intentionally excludes mux_stream_key and mux_live_stream_id for security
GRANT SELECT ON public.public_livestreams TO anon, authenticated;

-- ================================================
-- FIX 5: Add comments explaining intentional public access
-- ================================================
COMMENT ON VIEW public.public_livestreams IS 'Public view of livestreams excluding sensitive mux_stream_key. Intentionally public for viewer access.';
COMMENT ON VIEW public.public_profiles IS 'Public view of profiles excluding email. For displaying user info without exposing private data.';
-- Fix: Remove overly permissive public SELECT policy on livestreams table
-- The mux_stream_key should NEVER be publicly accessible

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Public livestream info is viewable" ON public.livestreams;

-- Create new policy: Only creators/admins can SELECT from the full livestreams table
-- Public users should query the public_livestreams view instead (which excludes mux_stream_key)
CREATE POLICY "Creators and admins can view livestreams" 
ON public.livestreams 
FOR SELECT 
USING (
  (organization_id = get_user_organization_id(auth.uid()) AND (is_creator() OR is_admin()))
  OR is_admin()
);
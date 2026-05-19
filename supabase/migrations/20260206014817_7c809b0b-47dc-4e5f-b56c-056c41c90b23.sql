
-- Drop the overly permissive policy that exposes all profile data (including emails)
DROP POLICY IF EXISTS "Anyone can view public profile info" ON profiles;

-- Only allow users to see their own full profile, or admins
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (id = auth.uid() OR is_admin());

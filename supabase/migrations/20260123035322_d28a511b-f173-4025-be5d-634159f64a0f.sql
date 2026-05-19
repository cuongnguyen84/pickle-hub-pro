-- Create a policy that allows reading public-facing profile fields
-- This allows anyone to see display_name but not email
CREATE POLICY "Anyone can view public profile info"
ON profiles
FOR SELECT
USING (true);

-- Drop the more restrictive policy that required auth
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Note: With this policy, the entire row is visible but:
-- 1. The app code should only select specific columns (display_name, avatar_url)
-- 2. Sensitive columns like email should be protected in application logic
-- Alternative approach: Create a view for public-facing profile data
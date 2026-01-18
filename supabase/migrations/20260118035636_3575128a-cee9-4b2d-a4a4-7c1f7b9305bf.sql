-- Allow admins to update any user's profile (including organization_id)
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (is_admin())
WITH CHECK (is_admin());
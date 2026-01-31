-- Add admin delete policies for all tournament types

-- 1. Quick Tables - Admin can delete any table
DROP POLICY IF EXISTS "Admins can delete any table" ON public.quick_tables;
CREATE POLICY "Admins can delete any table"
ON public.quick_tables
FOR DELETE
TO authenticated
USING (public.is_admin());

-- 2. Doubles Elimination Tournaments - Admin can delete any tournament
DROP POLICY IF EXISTS "Admins can delete any tournament" ON public.doubles_elimination_tournaments;
CREATE POLICY "Admins can delete any tournament"
ON public.doubles_elimination_tournaments
FOR DELETE
TO authenticated
USING (public.is_admin());

-- 3. Flex Tournaments - Admin can delete any tournament
DROP POLICY IF EXISTS "Admins can delete any tournament" ON public.flex_tournaments;
CREATE POLICY "Admins can delete any tournament"
ON public.flex_tournaments
FOR DELETE
TO authenticated
USING (public.is_admin());
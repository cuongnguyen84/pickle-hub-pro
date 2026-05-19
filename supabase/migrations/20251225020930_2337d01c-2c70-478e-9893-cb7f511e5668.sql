-- Allow table creators to look up profiles by email (for adding referees)
CREATE POLICY "Table creators can lookup profiles by email"
ON public.profiles
FOR SELECT
USING (
  -- Allow if caller is a creator of any quick_table
  EXISTS (
    SELECT 1 FROM public.quick_tables
    WHERE creator_user_id = auth.uid()
  )
);
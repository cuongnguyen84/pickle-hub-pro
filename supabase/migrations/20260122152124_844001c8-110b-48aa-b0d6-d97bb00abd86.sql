-- Add policies for Creators to manage tournaments
CREATE POLICY "Creators can insert tournaments" 
ON public.tournaments 
FOR INSERT 
WITH CHECK (is_creator() OR is_admin());

CREATE POLICY "Creators can update tournaments" 
ON public.tournaments 
FOR UPDATE 
USING (is_creator() OR is_admin())
WITH CHECK (is_creator() OR is_admin());

CREATE POLICY "Creators can delete tournaments" 
ON public.tournaments 
FOR DELETE 
USING (is_creator() OR is_admin());
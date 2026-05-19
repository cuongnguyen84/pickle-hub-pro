-- Add a policy to allow public (anon) to SELECT livestreams
-- This enables the public_livestreams view to return data for unauthenticated users
CREATE POLICY "Public can view all livestreams" 
ON public.livestreams 
FOR SELECT 
TO anon
USING (true);

-- Also ensure authenticated users can view all livestreams (not just their org's)
CREATE POLICY "Authenticated users can view all livestreams" 
ON public.livestreams 
FOR SELECT 
TO authenticated
USING (true);
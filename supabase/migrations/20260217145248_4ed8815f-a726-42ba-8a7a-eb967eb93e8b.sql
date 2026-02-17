-- Remove overly permissive public SELECT policies that expose mux_stream_key and red5_stream_name
DROP POLICY IF EXISTS "Authenticated users can view all livestreams" ON public.livestreams;
DROP POLICY IF EXISTS "Public can view all livestreams" ON public.livestreams;

-- The remaining SELECT policy "Creators and admins can view livestreams" already restricts 
-- direct table access to org creators/admins only.
-- Public users access data through public_livestreams view (which excludes sensitive fields).
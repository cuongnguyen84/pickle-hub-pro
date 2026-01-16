
-- Enable RLS on api_keys table
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Admin can view all API keys
CREATE POLICY "Admins can view all api_keys"
ON public.api_keys
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can insert API keys
CREATE POLICY "Admins can insert api_keys"
ON public.api_keys
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin can update API keys (including permissions)
CREATE POLICY "Admins can update api_keys"
ON public.api_keys
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin can delete API keys
CREATE POLICY "Admins can delete api_keys"
ON public.api_keys
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

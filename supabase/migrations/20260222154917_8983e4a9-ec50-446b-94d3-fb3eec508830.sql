-- Allow admins to view all push tokens
CREATE POLICY "Admins can view all push tokens"
  ON public.push_tokens FOR SELECT
  USING (public.is_admin());

-- Allow admins to delete any push token
CREATE POLICY "Admins can delete any push token"
  ON public.push_tokens FOR DELETE
  USING (public.is_admin());
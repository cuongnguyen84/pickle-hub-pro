-- Create a function to get organization logo (falls back to creator avatar)
CREATE OR REPLACE FUNCTION public.get_organization_display_logo(org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    o.logo_url,
    (SELECT p.avatar_url FROM profiles p WHERE p.organization_id = org_id LIMIT 1)
  )
  FROM organizations o
  WHERE o.id = org_id
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_organization_display_logo(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_organization_display_logo(uuid) TO authenticated;
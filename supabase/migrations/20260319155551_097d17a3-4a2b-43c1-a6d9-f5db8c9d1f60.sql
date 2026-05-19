
CREATE OR REPLACE FUNCTION public.get_organization_display_logos(org_ids uuid[])
RETURNS TABLE(org_id uuid, display_logo text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.id AS org_id,
    COALESCE(
      o.logo_url,
      (SELECT p.avatar_url FROM profiles p WHERE p.organization_id = o.id LIMIT 1)
    ) AS display_logo
  FROM organizations o
  WHERE o.id = ANY(org_ids)
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_display_logos(uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_organization_display_logos(uuid[]) TO authenticated;

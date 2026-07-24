-- Allow an organizer to attach existing Quick Table events to a parent
-- tournament. Ownership is checked server-side for both parent and children;
-- the update is atomic so a stale selection cannot be partially attached.

CREATE OR REPLACE FUNCTION public.attach_quick_tables_to_parent(
  p_parent_id uuid,
  p_table_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_requested integer;
  v_attached integer;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'AUTH_REQUIRED';
  END IF;

  SELECT count(*)
  INTO v_requested
  FROM (
    SELECT DISTINCT table_id
    FROM unnest(COALESCE(p_table_ids, ARRAY[]::uuid[])) AS requested(table_id)
    WHERE table_id IS NOT NULL
  ) deduplicated;

  IF v_requested = 0 THEN
    RETURN 0;
  END IF;

  PERFORM 1
  FROM public.parent_tournaments
  WHERE id = p_parent_id
    AND creator_user_id = v_caller
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'PARENT_NOT_OWNED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT DISTINCT table_id
      FROM unnest(p_table_ids) AS requested(table_id)
      WHERE table_id IS NOT NULL
    ) requested
    LEFT JOIN public.quick_tables qt ON qt.id = requested.table_id
    WHERE qt.id IS NULL
      OR qt.creator_user_id IS DISTINCT FROM v_caller
      OR qt.parent_tournament_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'EVENT_NOT_ATTACHABLE';
  END IF;

  UPDATE public.quick_tables
  SET parent_tournament_id = p_parent_id
  WHERE id IN (
    SELECT DISTINCT table_id
    FROM unnest(p_table_ids) AS requested(table_id)
    WHERE table_id IS NOT NULL
  )
    AND creator_user_id = v_caller
    AND parent_tournament_id IS NULL;

  GET DIAGNOSTICS v_attached = ROW_COUNT;

  IF v_attached <> v_requested THEN
    RAISE EXCEPTION USING
      ERRCODE = '40001',
      MESSAGE = 'EVENT_ATTACH_CONFLICT';
  END IF;

  RETURN v_attached;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_quick_tables_to_parent(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attach_quick_tables_to_parent(uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.attach_quick_tables_to_parent(uuid, uuid[]) TO authenticated;

-- Drop and recreate btc_manage_team function with proper type casting
CREATE OR REPLACE FUNCTION public.btc_manage_team(_team_id uuid, _action text, _notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _team_record public.quick_table_teams;
  _table_record public.quick_tables;
BEGIN
  SELECT * INTO _team_record
  FROM public.quick_table_teams
  WHERE id = _team_id
  FOR UPDATE;
  
  IF _team_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'TEAM_NOT_FOUND');
  END IF;
  
  -- Check permission
  SELECT * INTO _table_record FROM public.quick_tables WHERE id = _team_record.table_id;
  IF _table_record.creator_user_id != auth.uid() AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'PERMISSION_DENIED');
  END IF;
  
  IF _action = 'approve' THEN
    UPDATE public.quick_table_teams
    SET 
      btc_approved = true,
      btc_approved_at = now(),
      btc_notes = _notes,
      team_status = 'approved'::team_status,
      updated_at = now()
    WHERE id = _team_id;
  ELSIF _action = 'reject' THEN
    UPDATE public.quick_table_teams
    SET 
      btc_approved = false,
      btc_notes = _notes,
      team_status = 'rejected'::team_status,
      updated_at = now()
    WHERE id = _team_id;
  ELSIF _action = 'remove' THEN
    UPDATE public.quick_table_teams
    SET 
      team_status = 'removed'::team_status,
      btc_notes = _notes,
      updated_at = now()
    WHERE id = _team_id;
    
    -- Cancel all pending invitations
    UPDATE public.quick_table_partner_invitations
    SET status = 'cancelled'::invitation_status
    WHERE team_id = _team_id AND status = 'pending';
  ELSE
    RETURN json_build_object('success', false, 'error', 'INVALID_ACTION');
  END IF;
  
  RETURN json_build_object('success', true);
END;
$function$;
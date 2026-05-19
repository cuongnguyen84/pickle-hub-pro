
-- Fix create_quick_table_with_quota function to use extensions.gen_random_bytes
CREATE OR REPLACE FUNCTION public.create_quick_table_with_quota(_name text, _player_count integer, _format quick_table_format, _group_count integer DEFAULT NULL::integer, _requires_registration boolean DEFAULT false, _requires_skill_level boolean DEFAULT false, _auto_approve_registrations boolean DEFAULT false, _registration_message text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _table_count integer;
  _new_table public.quick_tables;
  _share_id text;
BEGIN
  -- Get current user
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;
  
  -- Check quota
  SELECT COUNT(*) INTO _table_count
  FROM public.quick_tables
  WHERE creator_user_id = _user_id;
  
  IF _table_count >= 3 THEN
    RETURN json_build_object('success', false, 'error', 'LIMIT_REACHED', 'count', _table_count);
  END IF;
  
  -- Generate share_id using extensions schema
  _share_id := encode(extensions.gen_random_bytes(6), 'hex');
  
  -- Create the table
  INSERT INTO public.quick_tables (
    name,
    player_count,
    format,
    group_count,
    share_id,
    creator_user_id,
    requires_registration,
    requires_skill_level,
    auto_approve_registrations,
    registration_message,
    is_public
  ) VALUES (
    _name,
    _player_count,
    _format,
    _group_count,
    _share_id,
    _user_id,
    _requires_registration,
    _requires_skill_level,
    _auto_approve_registrations,
    _registration_message,
    true
  )
  RETURNING * INTO _new_table;
  
  RETURN json_build_object(
    'success', true, 
    'table', row_to_json(_new_table),
    'count', _table_count + 1
  );
END;
$function$;

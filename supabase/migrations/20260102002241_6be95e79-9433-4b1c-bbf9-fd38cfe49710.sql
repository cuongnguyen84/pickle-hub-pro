-- Update create_quick_table_with_quota to accept is_doubles parameter
CREATE OR REPLACE FUNCTION public.create_quick_table_with_quota(
  _name text, 
  _player_count integer, 
  _format quick_table_format, 
  _group_count integer DEFAULT NULL::integer, 
  _requires_registration boolean DEFAULT false, 
  _requires_skill_level boolean DEFAULT false, 
  _auto_approve_registrations boolean DEFAULT false, 
  _registration_message text DEFAULT NULL::text,
  _is_doubles boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _table_count integer;
  _user_quota integer;
  _new_table public.quick_tables;
  _share_id text;
BEGIN
  -- Get current user
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;
  
  -- Get user's current table count
  SELECT COUNT(*) INTO _table_count
  FROM public.quick_tables
  WHERE creator_user_id = _user_id;
  
  -- Get user's quota from profiles (default 3 if not set)
  SELECT COALESCE(tournament_create_quota, 3) INTO _user_quota
  FROM public.profiles
  WHERE id = _user_id;
  
  -- Default to 3 if no profile found
  IF _user_quota IS NULL THEN
    _user_quota := 3;
  END IF;
  
  -- Check against user-specific quota
  IF _table_count >= _user_quota THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'LIMIT_REACHED', 
      'count', _table_count,
      'quota', _user_quota
    );
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
    is_public,
    is_doubles
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
    true,
    _is_doubles
  )
  RETURNING * INTO _new_table;
  
  RETURN json_build_object(
    'success', true, 
    'table', row_to_json(_new_table),
    'count', _table_count + 1,
    'quota', _user_quota
  );
END;
$function$;
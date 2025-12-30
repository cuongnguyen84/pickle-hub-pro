-- Add tournament creation quota to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tournament_create_quota integer NOT NULL DEFAULT 3;

-- Create function to check if user can create table
CREATE OR REPLACE FUNCTION public.can_create_quick_table_with_quota(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _table_count integer;
  _quota integer;
BEGIN
  -- Get current table count
  SELECT COUNT(*) INTO _table_count
  FROM public.quick_tables
  WHERE creator_user_id = _user_id;
  
  -- Get user quota (default 3 if not set)
  SELECT COALESCE(tournament_create_quota, 3) INTO _quota
  FROM public.profiles
  WHERE id = _user_id;
  
  IF _quota IS NULL THEN
    _quota := 3;
  END IF;
  
  RETURN json_build_object(
    'can_create', _table_count < _quota,
    'current_count', _table_count,
    'quota', _quota
  );
END;
$$;

-- Create function to get user quota info
CREATE OR REPLACE FUNCTION public.get_user_quota_info(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _table_count integer;
  _quota integer;
BEGIN
  SELECT COUNT(*) INTO _table_count
  FROM public.quick_tables
  WHERE creator_user_id = _user_id;
  
  SELECT COALESCE(tournament_create_quota, 3) INTO _quota
  FROM public.profiles
  WHERE id = _user_id;
  
  RETURN json_build_object(
    'current_count', _table_count,
    'quota', COALESCE(_quota, 3)
  );
END;
$$;

-- Create function for admin to set user quota
CREATE OR REPLACE FUNCTION public.set_user_quota(_user_id uuid, _new_quota integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can set user quotas';
  END IF;
  
  UPDATE public.profiles
  SET tournament_create_quota = _new_quota
  WHERE id = _user_id;
  
  RETURN FOUND;
END;
$$;

-- Function to delete a quick table with all related data
CREATE OR REPLACE FUNCTION public.delete_quick_table(_table_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator_user_id uuid;
  _current_user_id uuid;
BEGIN
  _current_user_id := auth.uid();
  
  -- Get the creator
  SELECT creator_user_id INTO _creator_user_id
  FROM public.quick_tables
  WHERE id = _table_id;
  
  IF _creator_user_id IS NULL THEN
    RAISE EXCEPTION 'Table not found';
  END IF;
  
  -- Check permission: must be admin OR creator
  IF NOT (public.is_admin() OR _creator_user_id = _current_user_id) THEN
    RAISE EXCEPTION 'Permission denied: only admin or creator can delete this table';
  END IF;
  
  -- Delete all related data (order matters due to foreign keys)
  DELETE FROM public.quick_table_matches WHERE table_id = _table_id;
  DELETE FROM public.quick_table_players WHERE table_id = _table_id;
  DELETE FROM public.quick_table_groups WHERE table_id = _table_id;
  DELETE FROM public.quick_table_registrations WHERE table_id = _table_id;
  DELETE FROM public.quick_table_referees WHERE table_id = _table_id;
  
  -- Delete the table itself
  DELETE FROM public.quick_tables WHERE id = _table_id;
  
  RETURN TRUE;
END;
$$;
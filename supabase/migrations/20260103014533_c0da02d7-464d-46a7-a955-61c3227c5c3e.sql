-- Create pair_requests table for new simplified pairing flow
CREATE TABLE public.quick_table_pair_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id uuid NOT NULL REFERENCES public.quick_tables(id) ON DELETE CASCADE,
  from_team_id uuid NOT NULL REFERENCES public.quick_table_teams(id) ON DELETE CASCADE,
  to_team_id uuid NOT NULL REFERENCES public.quick_table_teams(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone,
  CONSTRAINT unique_pair_request UNIQUE (from_team_id, to_team_id)
);

-- Enable RLS
ALTER TABLE public.quick_table_pair_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view pair requests they're involved in"
ON public.quick_table_pair_requests
FOR SELECT
USING (
  from_user_id = auth.uid() 
  OR to_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM quick_tables 
    WHERE id = quick_table_pair_requests.table_id 
    AND creator_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create pair requests"
ON public.quick_table_pair_requests
FOR INSERT
WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "Target users can update pair requests"
ON public.quick_table_pair_requests
FOR UPDATE
USING (to_user_id = auth.uid() OR from_user_id = auth.uid());

-- Create function to send pair request
CREATE OR REPLACE FUNCTION public.create_pair_request(
  _table_id uuid,
  _to_team_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _from_team public.quick_table_teams;
  _to_team public.quick_table_teams;
  _table public.quick_tables;
  _existing_request public.quick_table_pair_requests;
  _new_request public.quick_table_pair_requests;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;
  
  -- Get table
  SELECT * INTO _table FROM quick_tables WHERE id = _table_id;
  IF _table IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'TABLE_NOT_FOUND');
  END IF;
  
  -- Check if table is locked (not in setup)
  IF _table.status != 'setup' THEN
    RETURN json_build_object('success', false, 'error', 'TABLE_LOCKED');
  END IF;
  
  -- Get from team (current user's team where they are player1)
  SELECT * INTO _from_team 
  FROM quick_table_teams 
  WHERE table_id = _table_id 
    AND player1_user_id = _user_id;
    
  IF _from_team IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'NO_TEAM');
  END IF;
  
  -- Check if from_team is rejected
  IF _from_team.team_status = 'rejected' OR _from_team.team_status = 'removed' THEN
    RETURN json_build_object('success', false, 'error', 'TEAM_REJECTED');
  END IF;
  
  -- Check if from_team already has partner
  IF _from_team.player2_user_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'ALREADY_HAS_PARTNER');
  END IF;
  
  -- Get to team
  SELECT * INTO _to_team FROM quick_table_teams WHERE id = _to_team_id;
  IF _to_team IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'TARGET_TEAM_NOT_FOUND');
  END IF;
  
  -- Check if to_team is rejected
  IF _to_team.team_status = 'rejected' OR _to_team.team_status = 'removed' THEN
    RETURN json_build_object('success', false, 'error', 'TARGET_TEAM_REJECTED');
  END IF;
  
  -- Check if to_team already has partner
  IF _to_team.player2_user_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'TARGET_HAS_PARTNER');
  END IF;
  
  -- Check if teams are the same
  IF _from_team.id = _to_team.id THEN
    RETURN json_build_object('success', false, 'error', 'SAME_TEAM');
  END IF;
  
  -- Check for existing pending request (either direction)
  SELECT * INTO _existing_request
  FROM quick_table_pair_requests
  WHERE status = 'pending'
    AND (
      (from_team_id = _from_team.id AND to_team_id = _to_team.id)
      OR (from_team_id = _to_team.id AND to_team_id = _from_team.id)
    );
  
  IF _existing_request IS NOT NULL THEN
    IF _existing_request.from_team_id = _from_team.id THEN
      RETURN json_build_object('success', false, 'error', 'REQUEST_ALREADY_SENT');
    ELSE
      RETURN json_build_object('success', false, 'error', 'REQUEST_PENDING_FROM_TARGET');
    END IF;
  END IF;
  
  -- Create the request
  INSERT INTO quick_table_pair_requests (
    table_id, from_team_id, to_team_id, from_user_id, to_user_id
  ) VALUES (
    _table_id, _from_team.id, _to_team.id, _user_id, _to_team.player1_user_id
  )
  RETURNING * INTO _new_request;
  
  RETURN json_build_object('success', true, 'request_id', _new_request.id);
END;
$$;

-- Create function to respond to pair request
CREATE OR REPLACE FUNCTION public.respond_pair_request(
  _request_id uuid,
  _accept boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _request public.quick_table_pair_requests;
  _from_team public.quick_table_teams;
  _to_team public.quick_table_teams;
  _table public.quick_tables;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;
  
  -- Get request with lock
  SELECT * INTO _request
  FROM quick_table_pair_requests
  WHERE id = _request_id
  FOR UPDATE;
  
  IF _request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'REQUEST_NOT_FOUND');
  END IF;
  
  -- Check if user is the target
  IF _request.to_user_id != _user_id THEN
    RETURN json_build_object('success', false, 'error', 'NOT_TARGET_USER');
  END IF;
  
  -- Check if request is still pending
  IF _request.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'REQUEST_NOT_PENDING');
  END IF;
  
  -- Get table
  SELECT * INTO _table FROM quick_tables WHERE id = _request.table_id;
  IF _table.status != 'setup' THEN
    RETURN json_build_object('success', false, 'error', 'TABLE_LOCKED');
  END IF;
  
  -- Get both teams
  SELECT * INTO _from_team FROM quick_table_teams WHERE id = _request.from_team_id;
  SELECT * INTO _to_team FROM quick_table_teams WHERE id = _request.to_team_id;
  
  IF _accept THEN
    -- Verify neither team now has a partner (race condition check)
    IF _from_team.player2_user_id IS NOT NULL THEN
      UPDATE quick_table_pair_requests SET status = 'cancelled', responded_at = now() WHERE id = _request_id;
      RETURN json_build_object('success', false, 'error', 'FROM_TEAM_ALREADY_PAIRED');
    END IF;
    
    IF _to_team.player2_user_id IS NOT NULL THEN
      UPDATE quick_table_pair_requests SET status = 'cancelled', responded_at = now() WHERE id = _request_id;
      RETURN json_build_object('success', false, 'error', 'TO_TEAM_ALREADY_PAIRED');
    END IF;
    
    -- Pair them: VDV2 (to_team owner) becomes partner of VDV1 (from_team)
    UPDATE quick_table_teams
    SET 
      player2_user_id = _to_team.player1_user_id,
      player2_display_name = _to_team.player1_display_name,
      player2_team = _to_team.player1_team,
      player2_skill_level = _to_team.player1_skill_level,
      player2_rating_system = _to_team.player1_rating_system,
      player2_profile_link = _to_team.player1_profile_link,
      team_status = CASE 
        WHEN btc_approved THEN 'approved'::team_status
        ELSE 'partner_confirmed'::team_status
      END,
      updated_at = now()
    WHERE id = _from_team.id;
    
    -- Mark to_team as removed (merged into from_team)
    UPDATE quick_table_teams
    SET team_status = 'removed'::team_status, updated_at = now()
    WHERE id = _to_team.id;
    
    -- Update request status
    UPDATE quick_table_pair_requests
    SET status = 'accepted', responded_at = now()
    WHERE id = _request_id;
    
    -- Cancel all other pending requests involving either team
    UPDATE quick_table_pair_requests
    SET status = 'cancelled', responded_at = now()
    WHERE status = 'pending'
      AND id != _request_id
      AND (
        from_team_id IN (_from_team.id, _to_team.id)
        OR to_team_id IN (_from_team.id, _to_team.id)
      );
    
    RETURN json_build_object('success', true, 'team_id', _from_team.id);
  ELSE
    -- Reject the request
    UPDATE quick_table_pair_requests
    SET status = 'rejected', responded_at = now()
    WHERE id = _request_id;
    
    RETURN json_build_object('success', true);
  END IF;
END;
$$;

-- Function to cancel own pair request
CREATE OR REPLACE FUNCTION public.cancel_pair_request(_request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _request public.quick_table_pair_requests;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;
  
  SELECT * INTO _request FROM quick_table_pair_requests WHERE id = _request_id;
  
  IF _request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'REQUEST_NOT_FOUND');
  END IF;
  
  IF _request.from_user_id != _user_id THEN
    RETURN json_build_object('success', false, 'error', 'NOT_REQUEST_OWNER');
  END IF;
  
  IF _request.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'REQUEST_NOT_PENDING');
  END IF;
  
  UPDATE quick_table_pair_requests
  SET status = 'cancelled', responded_at = now()
  WHERE id = _request_id;
  
  RETURN json_build_object('success', true);
END;
$$;

-- Index for performance
CREATE INDEX idx_pair_requests_table ON public.quick_table_pair_requests(table_id);
CREATE INDEX idx_pair_requests_to_user ON public.quick_table_pair_requests(to_user_id, status);
CREATE INDEX idx_pair_requests_from_user ON public.quick_table_pair_requests(from_user_id, status);
-- Add is_doubles field to quick_tables (default true when requires_registration)
ALTER TABLE public.quick_tables 
ADD COLUMN IF NOT EXISTS is_doubles boolean NOT NULL DEFAULT true;

-- Create team status enum
DO $$ BEGIN
  CREATE TYPE public.team_status AS ENUM (
    'draft',           -- VDV1 registered, no partner yet
    'pending_partner', -- Invitation sent, waiting for partner
    'partner_pending', -- Partner registered, waiting for accept/reject
    'partner_confirmed', -- Partner accepted
    'pending_approval',  -- Waiting for BTC approval
    'approved',          -- BTC approved
    'rejected',          -- BTC rejected
    'removed'            -- BTC removed from tournament
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create invitation status enum
DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM (
    'pending',   -- Sent, not used yet
    'accepted',  -- Partner accepted
    'rejected',  -- Partner rejected
    'expired',   -- 7 days passed
    'cancelled'  -- VDV1 cancelled or team completed
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create teams table for doubles
CREATE TABLE IF NOT EXISTS public.quick_table_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.quick_tables(id) ON DELETE CASCADE,
  player1_user_id uuid NOT NULL,
  player1_display_name text NOT NULL,
  player1_team text,
  player1_skill_level numeric,
  player1_rating_system skill_rating_system DEFAULT 'none',
  player1_profile_link text,
  player2_user_id uuid,
  player2_display_name text,
  player2_team text,
  player2_skill_level numeric,
  player2_rating_system skill_rating_system DEFAULT 'none',
  player2_profile_link text,
  team_status team_status NOT NULL DEFAULT 'draft',
  btc_approved boolean DEFAULT false,
  btc_approved_at timestamptz,
  btc_notes text,
  is_locked boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create partner invitations table
CREATE TABLE IF NOT EXISTS public.quick_table_partner_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.quick_table_teams(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.quick_tables(id) ON DELETE CASCADE,
  invite_code text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(8), 'hex'),
  invited_by_user_id uuid NOT NULL,
  invited_user_id uuid, -- Set when someone uses the invitation
  status invitation_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

-- Enable RLS
ALTER TABLE public.quick_table_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_table_partner_invitations ENABLE ROW LEVEL SECURITY;

-- RLS for quick_table_teams
CREATE POLICY "Teams viewable for public tables" ON public.quick_table_teams
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.quick_tables 
    WHERE quick_tables.id = quick_table_teams.table_id 
    AND (quick_tables.is_public = true OR quick_tables.creator_user_id = auth.uid())
  )
);

CREATE POLICY "Users can create teams" ON public.quick_table_teams
FOR INSERT WITH CHECK (player1_user_id = auth.uid());

CREATE POLICY "Team owners can update their teams" ON public.quick_table_teams
FOR UPDATE USING (
  player1_user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.quick_tables 
    WHERE quick_tables.id = quick_table_teams.table_id 
    AND quick_tables.creator_user_id = auth.uid()
  )
);

CREATE POLICY "Table creators can delete teams" ON public.quick_table_teams
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.quick_tables 
    WHERE quick_tables.id = quick_table_teams.table_id 
    AND quick_tables.creator_user_id = auth.uid()
  )
);

-- RLS for partner invitations
CREATE POLICY "Invitations viewable by related users" ON public.quick_table_partner_invitations
FOR SELECT USING (
  invited_by_user_id = auth.uid() OR
  invited_user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.quick_tables 
    WHERE quick_tables.id = quick_table_partner_invitations.table_id 
    AND quick_tables.creator_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create invitations for their teams" ON public.quick_table_partner_invitations
FOR INSERT WITH CHECK (
  invited_by_user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.quick_table_teams 
    WHERE quick_table_teams.id = quick_table_partner_invitations.team_id 
    AND quick_table_teams.player1_user_id = auth.uid()
  )
);

CREATE POLICY "Invitation owners can update" ON public.quick_table_partner_invitations
FOR UPDATE USING (
  invited_by_user_id = auth.uid() OR
  invited_user_id = auth.uid()
);

-- Function to check if table is locked (after bracket creation)
CREATE OR REPLACE FUNCTION public.is_table_locked(_table_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status != 'setup' FROM public.quick_tables WHERE id = _table_id),
    false
  )
$$;

-- Function to get active invitation count for a team
CREATE OR REPLACE FUNCTION public.get_active_invitation_count(_team_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.quick_table_partner_invitations
  WHERE team_id = _team_id 
    AND status = 'pending'
    AND expires_at > now()
$$;

-- Function to accept partner invitation atomically
CREATE OR REPLACE FUNCTION public.accept_partner_invitation(
  _invitation_code text,
  _user_id uuid,
  _display_name text,
  _team text DEFAULT NULL,
  _skill_level numeric DEFAULT NULL,
  _rating_system skill_rating_system DEFAULT 'none',
  _profile_link text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation public.quick_table_partner_invitations;
  _team_record public.quick_table_teams;
  _table_record public.quick_tables;
BEGIN
  -- Get invitation with lock
  SELECT * INTO _invitation
  FROM public.quick_table_partner_invitations
  WHERE invite_code = _invitation_code
  FOR UPDATE;
  
  IF _invitation IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'INVITATION_NOT_FOUND');
  END IF;
  
  IF _invitation.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'INVITATION_ALREADY_USED');
  END IF;
  
  IF _invitation.expires_at < now() THEN
    UPDATE public.quick_table_partner_invitations SET status = 'expired' WHERE id = _invitation.id;
    RETURN json_build_object('success', false, 'error', 'INVITATION_EXPIRED');
  END IF;
  
  -- Get team with lock
  SELECT * INTO _team_record
  FROM public.quick_table_teams
  WHERE id = _invitation.team_id
  FOR UPDATE;
  
  IF _team_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'TEAM_NOT_FOUND');
  END IF;
  
  IF _team_record.player2_user_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'TEAM_ALREADY_COMPLETE');
  END IF;
  
  IF _team_record.is_locked THEN
    RETURN json_build_object('success', false, 'error', 'TABLE_LOCKED');
  END IF;
  
  -- Check if table is locked
  SELECT * INTO _table_record FROM public.quick_tables WHERE id = _team_record.table_id;
  IF _table_record.status != 'setup' THEN
    RETURN json_build_object('success', false, 'error', 'TABLE_LOCKED');
  END IF;
  
  -- Can't join own team
  IF _team_record.player1_user_id = _user_id THEN
    RETURN json_build_object('success', false, 'error', 'CANNOT_JOIN_OWN_TEAM');
  END IF;
  
  -- Update team with partner info
  UPDATE public.quick_table_teams
  SET 
    player2_user_id = _user_id,
    player2_display_name = _display_name,
    player2_team = _team,
    player2_skill_level = _skill_level,
    player2_rating_system = _rating_system,
    player2_profile_link = _profile_link,
    team_status = CASE 
      WHEN btc_approved THEN 'approved'
      ELSE 'partner_confirmed'
    END,
    updated_at = now()
  WHERE id = _invitation.team_id;
  
  -- Mark this invitation as accepted
  UPDATE public.quick_table_partner_invitations
  SET status = 'accepted', invited_user_id = _user_id, used_at = now()
  WHERE id = _invitation.id;
  
  -- Cancel all other pending invitations for this team
  UPDATE public.quick_table_partner_invitations
  SET status = 'cancelled'
  WHERE team_id = _invitation.team_id 
    AND id != _invitation.id 
    AND status = 'pending';
  
  RETURN json_build_object('success', true, 'team_id', _invitation.team_id);
END;
$$;

-- Function to remove partner from team
CREATE OR REPLACE FUNCTION public.remove_partner_from_team(_team_id uuid, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Check permission: only player1 can remove partner
  IF _team_record.player1_user_id != _user_id THEN
    RETURN json_build_object('success', false, 'error', 'PERMISSION_DENIED');
  END IF;
  
  -- Check if table is locked
  SELECT * INTO _table_record FROM public.quick_tables WHERE id = _team_record.table_id;
  IF _table_record.status != 'setup' THEN
    RETURN json_build_object('success', false, 'error', 'TABLE_LOCKED');
  END IF;
  
  -- Remove partner
  UPDATE public.quick_table_teams
  SET 
    player2_user_id = NULL,
    player2_display_name = NULL,
    player2_team = NULL,
    player2_skill_level = NULL,
    player2_rating_system = 'none',
    player2_profile_link = NULL,
    team_status = CASE 
      WHEN btc_approved THEN 'approved'
      ELSE 'draft'
    END,
    updated_at = now()
  WHERE id = _team_id;
  
  -- Cancel all pending invitations
  UPDATE public.quick_table_partner_invitations
  SET status = 'cancelled'
  WHERE team_id = _team_id AND status = 'pending';
  
  RETURN json_build_object('success', true);
END;
$$;

-- Function for BTC to approve/reject/remove team
CREATE OR REPLACE FUNCTION public.btc_manage_team(
  _team_id uuid, 
  _action text, -- 'approve', 'reject', 'remove'
  _notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      team_status = CASE 
        WHEN player2_user_id IS NOT NULL THEN 'approved'
        ELSE 'approved' -- Can approve even without partner
      END,
      updated_at = now()
    WHERE id = _team_id;
  ELSIF _action = 'reject' THEN
    UPDATE public.quick_table_teams
    SET 
      btc_approved = false,
      btc_notes = _notes,
      team_status = 'rejected',
      updated_at = now()
    WHERE id = _team_id;
  ELSIF _action = 'remove' THEN
    UPDATE public.quick_table_teams
    SET 
      team_status = 'removed',
      btc_notes = _notes,
      updated_at = now()
    WHERE id = _team_id;
    
    -- Cancel all pending invitations
    UPDATE public.quick_table_partner_invitations
    SET status = 'cancelled'
    WHERE team_id = _team_id AND status = 'pending';
  ELSE
    RETURN json_build_object('success', false, 'error', 'INVALID_ACTION');
  END IF;
  
  RETURN json_build_object('success', true);
END;
$$;

-- Trigger to update updated_at
CREATE OR REPLACE TRIGGER update_quick_table_teams_updated_at
BEFORE UPDATE ON public.quick_table_teams
FOR EACH ROW
EXECUTE FUNCTION public.update_quick_table_timestamp();

-- Enable realtime for teams table
ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_table_teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_table_partner_invitations;
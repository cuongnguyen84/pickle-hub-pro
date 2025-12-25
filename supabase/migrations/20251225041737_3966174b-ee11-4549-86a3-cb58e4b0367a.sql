-- Add registration settings to quick_tables
ALTER TABLE public.quick_tables
ADD COLUMN IF NOT EXISTS requires_registration boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_skill_level boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS min_skill_level numeric(3,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_skill_level numeric(3,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS skill_rating_system text DEFAULT 'DUPR',
ADD COLUMN IF NOT EXISTS auto_approve_registrations boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS registration_message text DEFAULT NULL;

-- Create enum for registration status
CREATE TYPE public.registration_status AS ENUM ('pending', 'approved', 'rejected');

-- Create enum for skill rating systems
CREATE TYPE public.skill_rating_system AS ENUM ('DUPR', 'other', 'none');

-- Create tournament registrations table
CREATE TABLE public.quick_table_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.quick_tables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  team text DEFAULT NULL,
  rating_system public.skill_rating_system NOT NULL DEFAULT 'none',
  skill_level numeric(4,2) DEFAULT NULL,
  skill_description text DEFAULT NULL,
  profile_link text DEFAULT NULL,
  status public.registration_status NOT NULL DEFAULT 'pending',
  btc_override_skill numeric(4,2) DEFAULT NULL,
  btc_notes text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(table_id, user_id)
);

-- Enable RLS
ALTER TABLE public.quick_table_registrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for registrations

-- Anyone can view registrations for public tables
CREATE POLICY "Registrations viewable for public tables"
ON public.quick_table_registrations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quick_tables
    WHERE quick_tables.id = quick_table_registrations.table_id
    AND (quick_tables.is_public = true OR quick_tables.creator_user_id = auth.uid())
  )
);

-- Users can insert their own registration
CREATE POLICY "Users can register for tournaments"
ON public.quick_table_registrations
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own pending registration
CREATE POLICY "Users can update own pending registration"
ON public.quick_table_registrations
FOR UPDATE
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid());

-- Users can delete their own pending registration
CREATE POLICY "Users can delete own pending registration"
ON public.quick_table_registrations
FOR DELETE
USING (user_id = auth.uid() AND status = 'pending');

-- Table creator can manage all registrations
CREATE POLICY "Creator can manage registrations"
ON public.quick_table_registrations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.quick_tables
    WHERE quick_tables.id = quick_table_registrations.table_id
    AND quick_tables.creator_user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_registrations_updated_at
BEFORE UPDATE ON public.quick_table_registrations
FOR EACH ROW
EXECUTE FUNCTION public.update_quick_table_timestamp();

-- Enable realtime for registrations
ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_table_registrations;
-- Create table for quick table referees
CREATE TABLE public.quick_table_referees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id uuid NOT NULL REFERENCES public.quick_tables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(table_id, user_id)
);

-- Enable RLS
ALTER TABLE public.quick_table_referees ENABLE ROW LEVEL SECURITY;

-- Create function to check if user is referee for a table
CREATE OR REPLACE FUNCTION public.is_quick_table_referee(_table_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.quick_table_referees
    WHERE table_id = _table_id
      AND user_id = _user_id
  )
$$;

-- Create function to check if user is creator of a table
CREATE OR REPLACE FUNCTION public.is_quick_table_creator(_table_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.quick_tables
    WHERE id = _table_id
      AND creator_user_id = _user_id
  )
$$;

-- Create function to check if user can edit scores (creator or referee)
CREATE OR REPLACE FUNCTION public.can_edit_quick_table_scores(_table_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_quick_table_creator(_table_id, _user_id) 
      OR public.is_quick_table_referee(_table_id, _user_id)
$$;

-- RLS Policies for quick_table_referees

-- Only creator can add referees
CREATE POLICY "Creator can add referees"
ON public.quick_table_referees
FOR INSERT
WITH CHECK (
  public.is_quick_table_creator(table_id, auth.uid())
);

-- Only creator can remove referees
CREATE POLICY "Creator can remove referees"
ON public.quick_table_referees
FOR DELETE
USING (
  public.is_quick_table_creator(table_id, auth.uid())
);

-- Creator and referees can view referee list
CREATE POLICY "Creator and referees can view referees"
ON public.quick_table_referees
FOR SELECT
USING (
  public.is_quick_table_creator(table_id, auth.uid())
  OR user_id = auth.uid()
);

-- Update match policies to allow referees to update scores
DROP POLICY IF EXISTS "Matches can be updated by table owner" ON public.quick_table_matches;

CREATE POLICY "Matches can be updated by creator or referee"
ON public.quick_table_matches
FOR UPDATE
USING (
  public.can_edit_quick_table_scores(table_id, auth.uid())
);
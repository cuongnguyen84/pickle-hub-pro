-- Add parent_match_id to support nested matches (child matches inside team matches)
ALTER TABLE public.flex_matches 
ADD COLUMN parent_match_id UUID REFERENCES public.flex_matches(id) ON DELETE CASCADE;

-- Index for performance when querying child matches
CREATE INDEX idx_flex_matches_parent ON public.flex_matches(parent_match_id);
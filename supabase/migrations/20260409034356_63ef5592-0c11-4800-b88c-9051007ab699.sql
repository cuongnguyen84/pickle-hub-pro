ALTER TABLE public.parent_tournaments 
  ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false;
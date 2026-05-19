
ALTER TABLE public.forum_comments 
ADD COLUMN parent_id uuid REFERENCES public.forum_comments(id) ON DELETE SET NULL DEFAULT NULL;

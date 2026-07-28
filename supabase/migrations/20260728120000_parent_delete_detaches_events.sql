-- Deleting a parent tournament used to be blocked by ON DELETE RESTRICT, so an
-- organizer could never remove a multi-event tournament that had events in it.
-- SET NULL detaches the children instead: the Quick Tables survive as standalone
-- brackets and only the parent grouping goes away.
ALTER TABLE public.quick_tables
  DROP CONSTRAINT quick_tables_parent_tournament_id_fkey;

ALTER TABLE public.quick_tables
  ADD CONSTRAINT quick_tables_parent_tournament_id_fkey
  FOREIGN KEY (parent_tournament_id)
  REFERENCES public.parent_tournaments(id) ON DELETE SET NULL;

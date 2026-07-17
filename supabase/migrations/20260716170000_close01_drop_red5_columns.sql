-- CLOSE-01: drop residual Red5 columns (CLAUDE.md "Known Bugs" #1).
-- Red5 streaming was retired; both columns are nullable, never read, and the
-- last dead write (CreatorLivestreamForm initializing them to NULL) is
-- removed in the same PR. Verified no view/function/policy depends on them.
ALTER TABLE public.livestreams DROP COLUMN IF EXISTS red5_server_url;
ALTER TABLE public.livestreams DROP COLUMN IF EXISTS red5_stream_name;

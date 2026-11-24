-- Profile cover photo (Cuong-approved profile redesign, 2026-11-24).
-- profiles gains a cover_url column for the social-style profile hero.
-- After the PII column lockdown, a new column needs explicit grants:
-- public read for anon + authenticated (the public profile page and
-- the bot SSR renderer read with the anon key), and a column-level
-- UPDATE grant so owners can save their own cover through the
-- existing self-update RLS policy on profiles.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_url text;

GRANT SELECT (cover_url) ON public.profiles TO anon;
GRANT SELECT (cover_url) ON public.profiles TO authenticated;
GRANT UPDATE (cover_url) ON public.profiles TO authenticated;

COMMIT;

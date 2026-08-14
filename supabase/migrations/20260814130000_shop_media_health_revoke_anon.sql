-- ============================================================================
-- `shop_media_cleanup_health` is admin-only. Make that true for anon as well.
-- ----------------------------------------------------------------------------
-- Acceptance check 19 says an anonymous read of this view must be refused, and
-- treats 401/403 as the PASS. Run against staging it returns **200** with a row
-- of counters.
--
-- Nothing leaks today, and the reason is worth writing down because it is not
-- the reason the check assumed. The view is `security_invoker = true`, and the
-- only SELECT policy on `shop_media_cleanup_jobs` is admin-only, so an
-- anonymous caller aggregates over zero rows and gets zeros back — the same
-- answer an empty queue gives. The queue actually had a pending job at the time.
--
-- So the protection is RLS, one layer down, and the view answers 200 either
-- way. The day someone adds a permissive read policy to the jobs table, real
-- operational numbers become public and nothing raises. `profiles` in this same
-- database is revoked from `anon` and answers 42501 — this view was simply
-- missed.
--
-- Why a REVOKE is needed at all: Supabase's platform default privileges grant
-- `anon` and `authenticated` full DML on every table created in `public`. The
-- original migration's `GRANT SELECT … TO authenticated` therefore added
-- nothing and withheld nothing. Grants here are not a whitelist — they are a
-- thing you must take away.
-- ============================================================================

REVOKE ALL ON public.shop_media_cleanup_health FROM anon;

-- The table underneath, for exactly the same reason. Anonymous reads of it come
-- back `[]` today, and that is RLS talking, not a grant.
REVOKE ALL ON public.shop_media_cleanup_jobs FROM anon;

DO $verify$
BEGIN
  IF has_table_privilege('anon', 'public.shop_media_cleanup_health', 'SELECT') THEN
    RAISE EXCEPTION 'anon can still read shop_media_cleanup_health';
  END IF;
  IF has_table_privilege('anon', 'public.shop_media_cleanup_jobs', 'SELECT') THEN
    RAISE EXCEPTION 'anon can still read shop_media_cleanup_jobs';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.shop_media_cleanup_health', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated lost its read on shop_media_cleanup_health — the admin panel needs it';
  END IF;
END;
$verify$;

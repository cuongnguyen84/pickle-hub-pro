-- SEC-05 hardening — safe subset from the 2026-07-16 catalog audit.
--
-- 1. Three SECURITY DEFINER blog-view functions ran with an unpinned
--    search_path (privilege-escalation lint). Their bodies reference
--    unqualified public tables, so pin to 'public' (not ''), which blocks
--    schema-hijack without breaking name resolution.
-- 2. error_alert_dedup (internal Telegram alert dedup state) was the only
--    public table with RLS disabled, and anon/authenticated held SELECT.
--    Nothing client-side reads it: enable RLS with no policies (deny-all
--    for API roles) and revoke the grants. The errors-telegram-alert
--    function writes via service_role, which bypasses RLS.
-- 3. Defense-in-depth: internally-gated admin/PII RPCs (is_admin()/has_role
--    checks, or authenticated-only flows) lose anon EXECUTE. Every caller
--    in web/native runs authenticated; anon had no legitimate path.
--
-- Deliberately NOT changed (flagged for review instead):
-- - find_profile_by_phone keeps authenticated EXECUTE: CreateGhostProfileModal
--   needs the phone-uniqueness check. Logged-in phone→profile enumeration
--   remains possible by design; revisit if abuse telemetry appears.
-- - The five definer views (club_listing, club_stats, player_stats,
--   public_livestreams, public_profiles) are intentional public read
--   surfaces from the PII-lockdown design.

ALTER FUNCTION public.get_blog_post_view_count(public.blog_lang, text)
  SET search_path = 'public';
ALTER FUNCTION public.get_blog_post_view_counts_batch(jsonb)
  SET search_path = 'public';
ALTER FUNCTION public.get_top_blog_posts(integer, integer)
  SET search_path = 'public';

ALTER TABLE public.error_alert_dedup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.error_alert_dedup FROM anon, authenticated;

-- Function ACLs default to EXECUTE for PUBLIC, so revoking only `anon`
-- changes nothing — strip PUBLIC and re-grant the roles that actually call
-- these (authenticated app flows + service_role edge functions).
DO $$
DECLARE
  sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'public.admin_get_profile_emails(uuid[])',
    'public.admin_lookup_profiles_by_email(text[])',
    'public.admin_search_profiles(text, integer)',
    'public.set_user_quota(uuid, integer)',
    'public.get_content_stats(date, date)',
    'public.get_engagement_stats(date, date)',
    'public.get_new_users_daily(date, date)',
    'public.get_user_stats(date, date)',
    'public.get_table_registration_emails(uuid)',
    'public.find_profile_by_phone(text)',
    'public.lookup_user_by_email(text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', sig);
  END LOOP;
END $$;

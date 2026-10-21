-- ============================================================================
-- Fix: missing table grants — sweep #2 (10 tables missed by 20260501000000)
--
-- Symptom (2026-08-02): Moderator highlights a user in livestream chat →
-- toast "Lỗi highlight". Upsert into public.chat_highlighted_users fails
-- with 42501 at the GRANT layer (authenticated has SELECT only), before
-- any RLS policy runs. Menu still shows because the client moderator check
-- goes through the SECURITY DEFINER RPC can_moderate_chat(), which needs
-- no table grant.
--
-- Root cause: same platform ACL revocation (between 2026-03-29 and
-- 2026-05-01) documented in migration 20260501000000. That sweep fixed 5
-- chat tables but missed everything else. Catalog sweep on prod
-- (pg_policies write policies × has_table_privilege('authenticated', …))
-- found 10 more tables with client-side writes but no write grant:
--
--   table                    last successful client write
--   chat_highlighted_users   2026-03-29  (reported bug)
--   push_tokens              2026-04-07  (!! push registration silently
--                                         broken web + native ~4 months)
--   blocked_users            never (0 rows)
--   content_reports          admin resolve (UPDATE) broken
--   forum_categories         AdminForum CRUD broken
--   news_items               AdminNews moderation (UPDATE) broken
--   news_sources             AdminNews toggles (UPDATE) broken
--   profiles                 ghost-profile INSERT broken
--   system_settings          admin INSERT broken
--   user_roles               admin role management broken
--
-- RLS policies on every table below were re-read on prod before granting:
-- all writes are gated by owner scope (auth.uid()) or is_admin()/has_role.
-- GRANT only unlocks the door so Postgres can evaluate RLS at all.
--
-- NOT granted (no client-side writes; service_role only): api_keys,
-- blog_post_seed_views, pro_tour_ingestion_logs, view_counts.
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_highlighted_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_users          TO authenticated;
GRANT UPDATE                         ON public.content_reports        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_categories       TO authenticated;
GRANT UPDATE                         ON public.news_items             TO authenticated;
GRANT UPDATE                         ON public.news_sources           TO authenticated;
GRANT INSERT                         ON public.profiles               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens            TO authenticated;
GRANT INSERT                         ON public.system_settings        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles             TO authenticated;

NOTIFY pgrst, 'reload schema';

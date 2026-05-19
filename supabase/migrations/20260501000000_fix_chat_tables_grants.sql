-- ============================================================================
-- Fix: missing table grants on 5 chat tables
--
-- Symptom (2026-05-01): Authenticated user gets toast "Không thể gửi tin
-- nhắn" when sending a chat message in livestream. Insert into
-- public.chat_messages fails silently — error.message does NOT include
-- 'can_send_chat_message', so frontend falls back to generic sendError
-- toast. Last successful chat insert observed: 2026-03-29. ~5 weeks of
-- broken chat in production before user reported.
--
-- Root cause: 5 chat tables created Dec 2025 (migration 20251222092727
-- + 20260215190351 + 20260315150509) with full RLS policies but ZERO
-- GRANT statements. Postgres checks object-level GRANT BEFORE RLS, so
-- authenticated INSERT/UPDATE/DELETE from the frontend hits error 42501
-- ("permission denied for table chat_messages") before any RLS policy
-- runs. Probed via REST: anon INSERT returns 42501; authenticated would
-- hit the same gate.
--
-- Why did chat work in Feb-Mar 2026 then break: Supabase platform default
-- ACLs (set outside migrations) likely granted authenticated INSERT
-- implicitly. Some platform-level change between 2026-03-29 and 2026-05-01
-- revoked that. Adding explicit GRANTs aligns with the lessons-learned.md
-- rule #1 — "every new public.<table> migration MUST end with GRANT block."
--
-- Pattern recurring — same fix already shipped 3 times:
--   migration 20260414000000 — vi_blog_posts
--   migration 20260425000000 — blog_post_views
--   migration 20260428000002 — videos / tournaments / organizations / livestreams
--
-- Frontend hooks affected:
--   useChatMessages.ts → public.chat_messages (INSERT/DELETE)
--                        public.chat_room_settings (SELECT/UPDATE moderators)
--                        public.chat_mutes (SELECT)
--   useChatLikes (any) → public.chat_message_likes (INSERT/DELETE)
--   useChatPinned (any)→ public.chat_pinned_messages (INSERT/DELETE)
--
-- MANUAL APPLY: paste into Supabase Dashboard → SQL Editor → Run.
-- Per .claude/memory/lessons-learned.md, do NOT use `supabase db push`
-- (40+ stale migrations make push risky).
-- ============================================================================

-- ── 1. Schema USAGE (idempotent — likely already granted) ────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ── 2. Public read access (anon) — chat history is publicly viewable
--      for livestream replay scrubbing. Matches existing RLS SELECT
--      policies that USING (true). ─────────────────────────────────────────
GRANT SELECT ON public.chat_messages         TO anon;
GRANT SELECT ON public.chat_room_settings    TO anon;
GRANT SELECT ON public.chat_pinned_messages  TO anon;
GRANT SELECT ON public.chat_message_likes    TO anon;
-- chat_mutes intentionally NOT readable by anon (moderator-only via RLS;
-- still grant SELECT to authenticated since RLS gates which rows they see).

-- ── 3. Authenticated CRUD — RLS policies are the actual gate ──────────────
--      Existing policies: chat_messages INSERT requires
--      can_send_chat_message(); DELETE requires can_moderate_chat();
--      chat_room_settings ALL requires can_moderate_chat(); chat_mutes ALL
--      requires can_moderate_chat(). This GRANT just unlocks the door so
--      Postgres CAN run the RLS check at all.
GRANT SELECT, INSERT, DELETE             ON public.chat_messages         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE     ON public.chat_room_settings    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE     ON public.chat_mutes            TO authenticated;
GRANT SELECT, INSERT, DELETE             ON public.chat_pinned_messages  TO authenticated;
GRANT SELECT, INSERT, DELETE             ON public.chat_message_likes    TO authenticated;

-- ── 4. Reload PostgREST schema cache so changes apply immediately ─────────
NOTIFY pgrst, 'reload schema';

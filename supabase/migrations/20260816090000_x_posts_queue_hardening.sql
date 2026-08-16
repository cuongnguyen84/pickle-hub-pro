-- ============================================================================
-- X (Twitter) auto-posting queue — ledger the tables and harden them for the
-- social-poster Worker's /x/run drain.
-- ============================================================================
--
-- History: `x_posts` and `x_oauth_tokens` were created by hand in the SQL
-- Editor while the X app was being set up, so they exist in production but
-- have never been in the repo. This migration is written to be idempotent —
-- applying it to production converges the hand-made tables onto the shape the
-- Worker expects, and replaying it on a fresh project creates them outright.
--
-- What the Worker needs beyond the original hand-written DDL:
--   * status 'posting'         — the claim state. Without a distinct claimed
--                                state, two cron ticks reading the same
--                                'approved' row both publish it, and X ends up
--                                with a duplicate post that cannot be undone.
--   * attempt_count            — bounds retries of transient X failures (429 /
--                                5xx) so a permanently broken row stops
--                                re-entering the queue instead of burning the
--                                daily write budget forever.
--   * link_comment_*           — the link reply is a second API call that can
--                                fail on its own; it needs its own retry
--                                counter and error slot, exactly like
--                                fb_post_log.link_comment_status.
--
-- See workers/social-poster/src/x.ts for the state machine that owns these
-- columns, and workers/social-poster/README.md §X for operations.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- x_posts — the approval queue
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.x_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  body text NOT NULL,
  link_url text,
  source_table text,
  source_id uuid,
  status text NOT NULL DEFAULT 'draft',
  x_post_id text,
  x_comment_id text,
  error_message text,
  scheduled_for timestamptz,
  posted_at timestamptz,
  link_commented_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CREATE TABLE IF NOT EXISTS is a no-op on the hand-made production table, so
-- every column the Worker reads or writes is asserted individually below. A
-- column missing here would not fail the migration — it would 400 every
-- /x/run tick afterwards, because the Worker selects them by name.
ALTER TABLE public.x_posts
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS x_post_id text,
  ADD COLUMN IF NOT EXISTS x_comment_id text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS link_commented_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_comment_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_comment_error text;

-- The stale-`posting` quarantine compare-and-swaps on updated_at; a NULL there
-- would silently downgrade that to an unguarded write.
UPDATE public.x_posts SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;
ALTER TABLE public.x_posts ALTER COLUMN updated_at SET NOT NULL;

-- Recreate the CHECKs rather than ALTER them: the hand-made constraints have
-- unknown names on production and an unnamed constraint cannot be targeted.
DO $constraints$
DECLARE
  v_name text;
BEGIN
  FOR v_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.x_posts'::regclass AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.x_posts DROP CONSTRAINT %I', v_name);
  END LOOP;
END
$constraints$;

-- NOT VALID on all three: they are enforced on every INSERT/UPDATE from here
-- on, but existing rows are not scanned. The hand-written vocabulary on
-- production is not knowable from the repo, and one legacy row outside these
-- lists would abort the whole migration. Once production rows are confirmed
-- clean, promote with:
--   ALTER TABLE public.x_posts VALIDATE CONSTRAINT x_posts_status_check;  -- etc.
ALTER TABLE public.x_posts
  ADD CONSTRAINT x_posts_content_type_check
  CHECK (content_type IN ('result', 'prediction', 'stat', 'blog_teaser')) NOT VALID;

-- 'posting' is the claimed state; 'link_commented' is terminal for rows that
-- carry a link, 'posted' is terminal for rows that do not.
ALTER TABLE public.x_posts
  ADD CONSTRAINT x_posts_status_check
  CHECK (status IN ('draft', 'approved', 'posting', 'posted', 'link_commented', 'failed')) NOT VALID;

-- Drain query: approved rows ordered by scheduled_for (nulls first).
CREATE INDEX IF NOT EXISTS idx_x_posts_status ON public.x_posts(status);
CREATE INDEX IF NOT EXISTS idx_x_posts_scheduled_for ON public.x_posts(scheduled_for);
-- Link-reply query: posted rows with a link, oldest first.
CREATE INDEX IF NOT EXISTS idx_x_posts_link_pending
  ON public.x_posts(posted_at)
  WHERE status = 'posted' AND link_url IS NOT NULL;

-- Publishing to X is irreversible, so a row must never reach 'posted' without
-- the id X gave us — that id is the only handle we have for the link reply.
ALTER TABLE public.x_posts DROP CONSTRAINT IF EXISTS x_posts_posted_needs_id;
ALTER TABLE public.x_posts
  ADD CONSTRAINT x_posts_posted_needs_id
  CHECK (status NOT IN ('posted', 'link_commented') OR x_post_id IS NOT NULL) NOT VALID;

-- Money guard, not style. Since 2026-04-20 X bills a post whose text contains a
-- URL at $0.200 per request instead of $0.015 — 13x — and the surcharge applies
-- to a self-reply carrying the link just as much as to the original post. Only
-- "summoned" replies (a bot answering a mention) keep the $0.01 rate, which this
-- pipeline never produces. Posting the link as a reply therefore never saved
-- money; it cost $0.215 per item against $0.200 for a link in the body.
--
-- Cuong's call on 2026-08-16: no API-posted links at all. Bodies spell the
-- domain out instead ("thepicklehub dot net"), which X does not linkify, so
-- every post bills at $0.015. This CHECK is what makes that real — the Worker's
-- link-reply path stays in the code but is unreachable while it holds. Reversing
-- the policy is DROP CONSTRAINT x_posts_no_link_url and nothing else.
ALTER TABLE public.x_posts DROP CONSTRAINT IF EXISTS x_posts_no_link_url;
ALTER TABLE public.x_posts
  ADD CONSTRAINT x_posts_no_link_url
  CHECK (link_url IS NULL) NOT VALID;

ALTER TABLE public.x_posts ENABLE ROW LEVEL SECURITY;

-- Admin-only. The Worker reads and writes with the service_role key, which
-- bypasses RLS; no anon or authenticated path exists on purpose.
DROP POLICY IF EXISTS "Admin full access to x_posts" ON public.x_posts;
CREATE POLICY "Admin full access to x_posts" ON public.x_posts
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- x_oauth_tokens — one row, rotated in place by the Worker
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.x_oauth_tokens (
  id text PRIMARY KEY DEFAULT 'thepicklehub',
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.x_oauth_tokens
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- RLS on with zero policies = service_role only. X rotates the refresh token
-- on every use, so a leaked read of this table is a full account takeover of
-- the posting capability until Cuong revokes the app; admins do not need it.
ALTER TABLE public.x_oauth_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.x_oauth_tokens FROM anon, authenticated;

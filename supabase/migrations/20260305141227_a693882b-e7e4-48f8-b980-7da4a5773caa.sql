
-- Content reports table for Apple Guideline 1.2 compliance
CREATE TABLE public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('livestream', 'tournament', 'profile', 'forum_post')),
  content_id text NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_notes text,
  resolved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- Prevent spam: one report per user per content item
CREATE UNIQUE INDEX idx_content_reports_unique ON public.content_reports (reporter_user_id, content_type, content_id) WHERE status = 'pending';

-- Index for admin queries
CREATE INDEX idx_content_reports_status ON public.content_reports (status, created_at DESC);

-- Blocked users table
CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_user_id, blocked_user_id)
);

-- RLS for content_reports
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reports
CREATE POLICY "Users can create reports"
  ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());

-- Users can view their own reports
CREATE POLICY "Users can view own reports"
  ON public.content_reports FOR SELECT TO authenticated
  USING (reporter_user_id = auth.uid());

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
  ON public.content_reports FOR SELECT TO authenticated
  USING (public.is_admin());

-- Admins can update reports
CREATE POLICY "Admins can update reports"
  ON public.content_reports FOR UPDATE TO authenticated
  USING (public.is_admin());

-- RLS for blocked_users
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own blocks"
  ON public.blocked_users FOR ALL TO authenticated
  USING (blocker_user_id = auth.uid())
  WITH CHECK (blocker_user_id = auth.uid());

-- Users can check if they are blocked by someone
CREATE POLICY "Users can check if blocked"
  ON public.blocked_users FOR SELECT TO authenticated
  USING (blocked_user_id = auth.uid());

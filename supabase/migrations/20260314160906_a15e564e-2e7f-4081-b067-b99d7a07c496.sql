
-- Create highlight type enum
CREATE TYPE public.chat_highlight_type AS ENUM ('vip', 'sponsor', 'special_guest');

-- Create chat_highlighted_users table
CREATE TABLE public.chat_highlighted_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  livestream_id UUID NOT NULL REFERENCES public.livestreams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  highlight_type chat_highlight_type NOT NULL DEFAULT 'vip',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (livestream_id, user_id)
);

-- Enable RLS
ALTER TABLE public.chat_highlighted_users ENABLE ROW LEVEL SECURITY;

-- Anyone can view highlighted users
CREATE POLICY "Highlighted users are publicly viewable"
  ON public.chat_highlighted_users
  FOR SELECT
  TO public
  USING (true);

-- Moderators can manage highlights
CREATE POLICY "Moderators can manage highlights"
  ON public.chat_highlighted_users
  FOR ALL
  TO authenticated
  USING (can_moderate_chat(livestream_id, auth.uid()))
  WITH CHECK (can_moderate_chat(livestream_id, auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_highlighted_users;

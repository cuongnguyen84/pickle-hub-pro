
-- Table for chat message likes
CREATE TABLE public.chat_message_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Index for fast lookups
CREATE INDEX idx_chat_message_likes_message_id ON public.chat_message_likes(message_id);
CREATE INDEX idx_chat_message_likes_user_id ON public.chat_message_likes(user_id);

-- Enable RLS
ALTER TABLE public.chat_message_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can view likes
CREATE POLICY "Chat message likes are publicly viewable"
  ON public.chat_message_likes FOR SELECT
  TO public
  USING (true);

-- Authenticated users can like
CREATE POLICY "Authenticated users can like messages"
  ON public.chat_message_likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can unlike their own
CREATE POLICY "Users can unlike their own likes"
  ON public.chat_message_likes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Enable realtime for likes
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_likes;

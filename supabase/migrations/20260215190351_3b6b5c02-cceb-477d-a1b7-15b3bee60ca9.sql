
-- Create table for pinned chat messages
CREATE TABLE public.chat_pinned_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  livestream_id UUID NOT NULL REFERENCES public.livestreams(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL,
  pinned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(livestream_id)
);

-- Enable RLS
ALTER TABLE public.chat_pinned_messages ENABLE ROW LEVEL SECURITY;

-- Everyone can read pinned messages
CREATE POLICY "Anyone can view pinned messages"
ON public.chat_pinned_messages FOR SELECT
USING (true);

-- Only moderators can pin/unpin
CREATE POLICY "Moderators can pin messages"
ON public.chat_pinned_messages FOR INSERT
WITH CHECK (public.is_admin() OR public.is_creator());

CREATE POLICY "Moderators can unpin messages"
ON public.chat_pinned_messages FOR DELETE
USING (public.is_admin() OR public.is_creator());

-- Enable realtime for pinned messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_pinned_messages;

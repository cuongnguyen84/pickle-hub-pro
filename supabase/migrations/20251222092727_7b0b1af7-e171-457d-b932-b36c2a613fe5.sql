-- ================================================
-- CHAT TABLES FOR LIVE CHAT MVP
-- ================================================

-- 1) Create chat_messages table
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  livestream_id uuid NOT NULL REFERENCES public.livestreams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_chat_messages_livestream_created ON public.chat_messages(livestream_id, created_at DESC);
CREATE INDEX idx_chat_messages_user_created ON public.chat_messages(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 2) Create chat_room_settings table
CREATE TABLE public.chat_room_settings (
  livestream_id uuid PRIMARY KEY REFERENCES public.livestreams(id) ON DELETE CASCADE,
  is_chat_enabled boolean NOT NULL DEFAULT true,
  slow_mode_seconds integer NOT NULL DEFAULT 0 CHECK (slow_mode_seconds >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_room_settings ENABLE ROW LEVEL SECURITY;

-- 3) Create chat_mutes table
CREATE TABLE public.chat_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  livestream_id uuid NOT NULL REFERENCES public.livestreams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  muted_until timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(livestream_id, user_id)
);

-- Enable RLS
ALTER TABLE public.chat_mutes ENABLE ROW LEVEL SECURITY;

-- Enable realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- ================================================
-- HELPER FUNCTION: Check if user can moderate chat
-- ================================================
CREATE OR REPLACE FUNCTION public.can_moderate_chat(_livestream_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.livestreams l
    WHERE l.id = _livestream_id
      AND (
        -- User is admin
        public.is_admin()
        OR
        -- User is creator of the organization that owns this livestream
        (l.organization_id = public.get_user_organization_id(_user_id) AND public.is_creator())
      )
  )
$$;

-- ================================================
-- MAIN FUNCTION: Check if user can send chat message
-- ================================================
CREATE OR REPLACE FUNCTION public.can_send_chat_message(_livestream_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _settings RECORD;
  _mute_until timestamptz;
  _last_message_at timestamptz;
BEGIN
  -- Check chat settings
  SELECT is_chat_enabled, slow_mode_seconds INTO _settings
  FROM public.chat_room_settings
  WHERE livestream_id = _livestream_id;
  
  -- If no settings, assume chat is enabled with no slow mode
  IF NOT FOUND THEN
    _settings.is_chat_enabled := true;
    _settings.slow_mode_seconds := 0;
  END IF;
  
  -- Check if chat is enabled
  IF NOT _settings.is_chat_enabled THEN
    RETURN false;
  END IF;
  
  -- Check if user is muted
  SELECT muted_until INTO _mute_until
  FROM public.chat_mutes
  WHERE livestream_id = _livestream_id AND user_id = _user_id;
  
  IF FOUND AND _mute_until > now() THEN
    RETURN false;
  END IF;
  
  -- Check slow mode
  IF _settings.slow_mode_seconds > 0 THEN
    SELECT created_at INTO _last_message_at
    FROM public.chat_messages
    WHERE livestream_id = _livestream_id AND user_id = _user_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF FOUND AND (now() - _last_message_at) < (_settings.slow_mode_seconds * INTERVAL '1 second') THEN
      RETURN false;
    END IF;
  END IF;
  
  RETURN true;
END;
$$;

-- ================================================
-- RLS POLICIES FOR chat_messages
-- ================================================

-- Anyone can read chat messages
CREATE POLICY "Chat messages are publicly readable"
ON public.chat_messages
FOR SELECT
USING (true);

-- Only authenticated users who pass the check can insert
CREATE POLICY "Authenticated users can send chat messages"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.can_send_chat_message(livestream_id, auth.uid())
);

-- Only moderators can delete messages
CREATE POLICY "Moderators can delete chat messages"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (public.can_moderate_chat(livestream_id, auth.uid()));

-- ================================================
-- RLS POLICIES FOR chat_room_settings
-- ================================================

-- Anyone can read settings
CREATE POLICY "Chat settings are publicly readable"
ON public.chat_room_settings
FOR SELECT
USING (true);

-- Only moderators can insert/update
CREATE POLICY "Moderators can manage chat settings"
ON public.chat_room_settings
FOR ALL
TO authenticated
USING (public.can_moderate_chat(livestream_id, auth.uid()))
WITH CHECK (public.can_moderate_chat(livestream_id, auth.uid()));

-- ================================================
-- RLS POLICIES FOR chat_mutes
-- ================================================

-- Only moderators can view mutes
CREATE POLICY "Moderators can view chat mutes"
ON public.chat_mutes
FOR SELECT
TO authenticated
USING (public.can_moderate_chat(livestream_id, auth.uid()) OR user_id = auth.uid());

-- Only moderators can manage mutes
CREATE POLICY "Moderators can manage chat mutes"
ON public.chat_mutes
FOR ALL
TO authenticated
USING (public.can_moderate_chat(livestream_id, auth.uid()))
WITH CHECK (public.can_moderate_chat(livestream_id, auth.uid()));
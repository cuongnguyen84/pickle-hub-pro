
-- Create push_tokens table to store device push notification tokens
CREATE TABLE public.push_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Enable RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own tokens
CREATE POLICY "Users can view own push tokens"
  ON public.push_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY "Users can insert own push tokens"
  ON public.push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens
CREATE POLICY "Users can update own push tokens"
  ON public.push_tokens FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own tokens
CREATE POLICY "Users can delete own push tokens"
  ON public.push_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Service role needs to read all tokens for sending notifications
-- (handled via service_role key in edge functions)

-- Add trigger for updated_at
CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for push_tokens (optional, for token management UI)
ALTER PUBLICATION supabase_realtime ADD TABLE public.push_tokens;

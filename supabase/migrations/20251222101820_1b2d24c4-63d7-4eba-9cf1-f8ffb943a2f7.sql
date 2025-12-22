-- Add client_message_id column for broadcast/persist deduplication
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS client_message_id TEXT;

-- Create unique index for deduplication (nullable unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_client_message_id 
ON public.chat_messages(client_message_id) 
WHERE client_message_id IS NOT NULL;

-- Ensure we have the composite index for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_livestream_created 
ON public.chat_messages(livestream_id, created_at DESC);
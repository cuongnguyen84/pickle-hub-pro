-- QA/QC Security Fixes - CRITICAL ONLY (v4)
-- Focus on chat_messages RLS restriction

-- ================================================
-- FIX: Restrict chat_messages to authenticated users only
-- This addresses the critical issue of public chat exposure
-- ================================================

-- Drop existing policies for chat_messages SELECT
DROP POLICY IF EXISTS "Chat messages are publicly viewable" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can view chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Chat messages publicly viewable for livestream" ON public.chat_messages;

-- Create policy: only authenticated users can read chat messages
-- This prevents anonymous harvesting of user data from chat
CREATE POLICY "Authenticated users can view chat messages"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (true);
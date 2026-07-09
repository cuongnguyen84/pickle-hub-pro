-- Team Match: link nhóm chat (Zalo/Telegram/Messenger…) — người xem bấm mở thẳng.
ALTER TABLE public.team_match_tournaments
  ADD COLUMN IF NOT EXISTS chat_group_url TEXT;

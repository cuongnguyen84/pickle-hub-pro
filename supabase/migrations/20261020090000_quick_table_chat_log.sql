-- Nhật ký "tạo giải bằng chat AI" để agent theo dõi những yêu cầu app chưa
-- đáp ứng (scripts/ops/chat_requests_agent.py → Telegram mỗi tối).
-- Chỉ service_role đọc/ghi (edge function quick-table-chat ghi bằng service key).
-- Giữ 30 ngày.
CREATE TABLE IF NOT EXISTS public.quick_table_chat_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  lang text,
  pending text,
  user_text text NOT NULL,
  has_attachment boolean NOT NULL DEFAULT false,
  reply text,
  intent text,
  unmet text
);

CREATE INDEX IF NOT EXISTS quick_table_chat_log_created_at_idx ON public.quick_table_chat_log (created_at);

ALTER TABLE public.quick_table_chat_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quick_table_chat_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.quick_table_chat_log TO service_role;

SELECT cron.unschedule('purge-quick-table-chat-log')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-quick-table-chat-log');

SELECT cron.schedule(
  'purge-quick-table-chat-log',
  '23 3 * * *',
  $$DELETE FROM public.quick_table_chat_log WHERE created_at < now() - interval '30 days'$$
);

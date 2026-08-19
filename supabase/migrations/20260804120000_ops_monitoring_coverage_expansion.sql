-- Mở rộng phủ giám sát production (danh sách 1-5 duyệt 2026-08-04):
-- 1. auth email/OTP, 2. payment, 3. mux-webhook, 4. news pipeline, 5. push + sitemap/prerender.
-- Tái dùng nguyên pattern ops_edge_function_registry (probe 5'/lần, Telegram realtime)
-- và ops_cron_monitors (cron-health 10'/lần). Không cơ chế mới.

-- 1) Probe URL ngoài Supabase (Cloudflare Pages: sitemap, prerender).
--    probe_url NULL = probe OPTIONS /functions/v1/<slug> như cũ.
ALTER TABLE public.ops_edge_function_registry
  ADD COLUMN IF NOT EXISTS probe_url text;

-- 2) Cron run-health cho các pg_cron job đã tồn tại nhưng chưa ai theo dõi kết quả chạy.
--    monitoring_started_at mặc định now() → evaluator không bắn alert giả trước chu kỳ đầu.
ALTER TABLE public.ops_job_registry DROP CONSTRAINT IF EXISTS ops_job_registry_category_check;
ALTER TABLE public.ops_job_registry ADD CONSTRAINT ops_job_registry_category_check
  CHECK (category IN ('news','pro_tour','dupr','media','social','integration','matches','payments'));

INSERT INTO public.ops_cron_monitors (
  monitor_key, display_name, source, cron_job_name, expected_interval_seconds, grace_seconds
) VALUES
  ('news-translate', 'News EN→VI translation', 'pg_net', 'news-translate-every-30m', 1800, 900),
  ('match-expire', 'Match invitation expiry', 'pg_net', 'match-expire-daily', 86400, 7200),
  ('auto-cancel-unpaid-registrations', 'Auto-cancel unpaid registrations', 'pg_net', 'auto-cancel-unpaid-registrations', 3600, 1200)
ON CONFLICT (monitor_key) DO UPDATE SET
  display_name=EXCLUDED.display_name, source=EXCLUDED.source,
  cron_job_name=EXCLUDED.cron_job_name,
  expected_interval_seconds=EXCLUDED.expected_interval_seconds,
  grace_seconds=EXCLUDED.grace_seconds, monitoring_started_at=now(), enabled=true;

INSERT INTO public.ops_job_registry (
  job_key, display_name, category, executor, cron_job_name, existing_monitor_key,
  schedule_label, expected_interval_seconds, grace_seconds, details_path
) VALUES
  ('news-translate', 'News EN→VI translation', 'news', 'pg_net', 'news-translate-every-30m', 'news-translate', 'Mỗi 30 phút', 1800, 900, '/admin/news'),
  ('match-expire', 'Match invitation expiry', 'matches', 'pg_net', 'match-expire-daily', 'match-expire', 'Hằng ngày 04:00 ICT', 86400, 7200, '/admin'),
  ('auto-cancel-unpaid-registrations', 'Auto-cancel unpaid registrations', 'payments', 'pg_net', 'auto-cancel-unpaid-registrations', 'auto-cancel-unpaid-registrations', 'Mỗi giờ', 3600, 1200, '/admin')
ON CONFLICT (job_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  executor = EXCLUDED.executor,
  cron_job_name = EXCLUDED.cron_job_name,
  existing_monitor_key = EXCLUDED.existing_monitor_key,
  schedule_label = EXCLUDED.schedule_label,
  expected_interval_seconds = EXCLUDED.expected_interval_seconds,
  grace_seconds = EXCLUDED.grace_seconds,
  details_path = EXCLUDED.details_path,
  enabled = true;

-- 5) Edge Functions user-facing quan trọng chưa được probe availability.
--    Blob-loss từng giết send-auth-email 3 ngày (us-east-1, 07/2026) mà không ai biết.
INSERT INTO public.ops_edge_function_registry(function_slug,display_name,job_key) VALUES
  ('send-auth-email','Auth email delivery (Resend)',NULL),
  ('phone-otp-send','Phone/email OTP send',NULL),
  ('phone-otp-verify','Phone/email OTP verify',NULL),
  ('create-payment-order','Payment order creation',NULL),
  ('mark-payment-claimed','Payment claim confirmation',NULL),
  ('mux-webhook','Mux livestream webhook',NULL),
  ('send-push-notification','FCM push notification',NULL),
  ('news-ingest','News ingestion',NULL),
  ('news-translate','News EN→VI translation','news-translate'),
  ('news-check','News source check',NULL)
ON CONFLICT(function_slug) DO UPDATE SET
  display_name=EXCLUDED.display_name,job_key=EXCLUDED.job_key,enabled=true;

-- 6) Bề mặt Cloudflare Pages (không phải Supabase function) — probe qua URL công khai
--    với Googlebot UA để đi đúng nhánh prerender middleware.
INSERT INTO public.ops_edge_function_registry(function_slug,display_name,job_key,probe_url) VALUES
  ('pages-sitemap','Sitemap index (Cloudflare Pages)',NULL,'https://www.thepicklehub.net/sitemap.xml'),
  ('pages-prerender','SEO prerender middleware (Cloudflare Pages)',NULL,'https://www.thepicklehub.net/')
ON CONFLICT(function_slug) DO UPDATE SET
  display_name=EXCLUDED.display_name,job_key=EXCLUDED.job_key,
  probe_url=EXCLUDED.probe_url,enabled=true;


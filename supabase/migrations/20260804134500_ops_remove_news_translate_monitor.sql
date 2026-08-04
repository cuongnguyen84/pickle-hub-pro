-- news-translate không còn cron trên prod: editorial pipeline (#511, 31/07)
-- đã thay bằng news-rewrite-every-30m và unschedule cron cũ. Monitor thêm ở
-- 20260804120000 dựa trên migration cổ → báo "Cron job is missing" giả vĩnh viễn.
-- Gỡ monitor + job registry; giữ availability probe của function (FK tự SET NULL).
DELETE FROM public.ops_cron_monitors WHERE monitor_key = 'news-translate';
DELETE FROM public.ops_job_registry WHERE job_key = 'news-translate';

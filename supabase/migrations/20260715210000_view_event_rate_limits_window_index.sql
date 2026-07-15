-- Index view_event_rate_limits(window_start) for the inline GC (roadmap mục E).
--
-- consume_view_event_rate_limit() runs on every view event and each call does
--   DELETE FROM view_event_rate_limits WHERE window_start < now() - interval '2 days';
-- The primary key is (identity_hash, window_start), whose leading column is
-- identity_hash, so a window_start-only predicate cannot use it — the delete
-- degrades to a sequential scan as the table grows. The table is tiny today,
-- but this runs on the rate-limiter hot path, exactly where a scan hurts under
-- load. A dedicated btree on window_start keeps the GC an index range scan.

CREATE INDEX IF NOT EXISTS view_event_rate_limits_window_start_idx
  ON public.view_event_rate_limits (window_start);

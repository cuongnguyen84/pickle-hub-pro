-- Thêm nguồn Pickleball.com (Cuong yêu cầu 05/08). Site có RSS chính chủ tại
-- /api/feed (advertised qua <link rel=alternate> trên /news/), 12 item, cập nhật
-- trong ngày. Lưu ý: <link> trong feed KHÔNG có scheme — worker đã chuẩn hoá
-- (prepend https://) từ cùng PR này.
INSERT INTO public.news_sources (
  id, name, base_url, feed_url, feed_type, language,
  trust_tier, auto_publish, active, notes
) VALUES (
  'pickleball-com',
  'Pickleball.com',
  'https://pickleball.com',
  'https://pickleball.com/api/feed',
  'rss',
  'en',
  1, true, true,
  'RSS 2.0 tại /api/feed (site rebuilt, không dùng đường /feed WordPress). Item link thiếu scheme — worker tự chuẩn hoá.'
)
ON CONFLICT (id) DO UPDATE SET
  feed_url = EXCLUDED.feed_url, feed_type = EXCLUDED.feed_type,
  active = true, last_error = NULL, notes = EXCLUDED.notes;

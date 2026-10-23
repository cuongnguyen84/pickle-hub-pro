-- Thêm 4 nguồn tin (Cường duyệt 22/10/2026 qua nghiên cứu của Bot nội dung)
-- + mở rộng pipeline lấy bài REVIEW SẢN PHẨM.
--
-- Đã probe feed thật ngày 22/10/2026 trước khi chốt:
--   1. Pickleball News Asia — RSS WordPress tại /feed/ còn sống, bài mới
--      cùng ngày; feed gồm MỌI category (kể cả "Equipment News" — mảng
--      review vợt/dụng cụ) nên review chảy qua cùng một feed.
--   2. Times Now (mục Pickleball) — KHÔNG có RSS (các endpoint /rssfeeds/*.cms
--      đều 404). Trang mục server-render sẵn link bài; trang bài có đủ
--      og:title + article:published_time → html_scrape đường og-meta với
--      HTML_SCRAPE_CONFIGS['times-now'] trong workers/news-fetcher.
--   3. Blog DUPR — KHÔNG có RSS. Listing đã chuyển về /blog (trang /post cũ
--      trả 404; /post/<slug> là tiền tố trang bài), card Webflow có sẵn
--      tiêu đề/ngày/tóm tắt → html_scrape đường listing-card với
--      HTML_SCRAPE_CONFIGS['dupr-blog']. Nguồn CHÍNH CHỦ (hệ thống rating)
--      nên trust_tier 1 + auto_publish như các nguồn chính chủ hiện có.
--   4. Dink Authority Magazine — Next.js, KHÔNG có RSS (/feed trả 404).
--      Sitemap.xml liệt kê bài kèm lastmod thật; trang bài có đủ og:title +
--      article:published_time → html_scrape đường og-meta qua sitemap với
--      HTML_SCRAPE_CONFIGS['dink-authority'].
--
-- THỨ TỰ TRIỂN KHAI QUAN TRỌNG: merge + deploy bản news-fetcher chứa 3 config
-- html_scrape mới TRƯỚC khi migration này được áp. fetchActiveSources chỉ
-- lấy nguồn html_scrape đã có config, nên áp migration trước vẫn an toàn
-- (3 nguồn html_scrape nằm chờ), nhưng chúng chỉ chạy sau khi worker deploy.
--
-- Nguồn phi chính chủ: trust_tier 2 + auto_publish=false (vào draft chờ
-- duyệt) như tiền lệ Pickle Asia (20260908090000).
INSERT INTO public.news_sources (
  id, name, base_url, feed_url, feed_type, language,
  trust_tier, auto_publish, active, notes
) VALUES
  (
    'pickleball-news-asia',
    'Pickleball News Asia',
    'https://pickleballnewsasia.com',
    'https://pickleballnewsasia.com/feed/',
    'rss', 'en', 2, false, true,
    'WordPress RSS toàn category (tin châu Á + Equipment News/review). Phi chính chủ — bài vào draft chờ duyệt.'
  ),
  (
    'times-now',
    'Times Now Pickleball',
    'https://www.timesnownews.com',
    'https://www.timesnownews.com/sports/pickleball',
    'html_scrape', 'en', 2, false, true,
    'Không có RSS (probe 22/10/2026: /rssfeeds/*.cms đều 404). Scrape trang mục + og-meta từng bài qua HTML_SCRAPE_CONFIGS[''times-now''] trong news-fetcher. Phi chính chủ — draft chờ duyệt.'
  ),
  (
    'dupr-blog',
    'DUPR Blog',
    'https://www.dupr.com',
    'https://www.dupr.com/blog',
    'html_scrape', 'en', 1, true, true,
    'Blog chính chủ của hệ thống rating DUPR (tier 1 như PPA/MLP). Webflow listing-card qua HTML_SCRAPE_CONFIGS[''dupr-blog'']; trang /post cũ đã 404, bài nằm dưới /post/<slug>.'
  ),
  (
    'dink-authority',
    'Dink Authority Magazine',
    'https://www.dinkauthoritymagazine.com',
    'https://www.dinkauthoritymagazine.com/sitemap.xml',
    'html_scrape', 'en', 2, false, true,
    'Không có RSS (/feed 404). Og-meta qua sitemap với HTML_SCRAPE_CONFIGS[''dink-authority''] trong news-fetcher; chỉ lấy path /news/, /players/, /tips/ (bản /es/, /pt/ bị loại theo prefix). Phi chính chủ — draft chờ duyệt.'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  base_url = EXCLUDED.base_url,
  feed_url = EXCLUDED.feed_url,
  feed_type = EXCLUDED.feed_type,
  language = EXCLUDED.language,
  trust_tier = EXCLUDED.trust_tier,
  auto_publish = EXCLUDED.auto_publish,
  active = true,
  last_error = NULL,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Mở rộng REVIEW cho nguồn hiện có: The Kitchen trước nay chỉ lấy feed
-- category "news" nên toàn bộ mục Gear (153 bài — expert review vợt, best
-- paddles…) bị bỏ ngoài pipeline. Đổi sang feed gốc toàn category
-- (news + gear + tips + community) để bài review vào cùng dòng chảy;
-- bài advertorial/sponsored bị bộ lọc advertorial mới trong news-fetcher
-- chặn ở khâu ingest. Các nguồn full-feed khác (The Dink, Pickleball
-- Union, Pickleball Rookie) vốn đã gồm bài review, không cần đổi.
UPDATE public.news_sources
SET feed_url = 'https://thekitchenpickle.com/feed/',
    last_error = NULL,
    notes = 'WordPress full-category RSS (đổi từ category/news ngày 22/10/2026 để lấy thêm mục Gear — review vợt/dụng cụ). Full article extraction falls back to a short brief when needed.',
    updated_at = now()
WHERE id = 'kitchen';

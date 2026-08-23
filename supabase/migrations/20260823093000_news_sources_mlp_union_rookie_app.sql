-- Thêm 3 nguồn tin (Cuong chọn 23/08) + hồi sinh nguồn APP.
--
-- Đã probe ~30 feed ứng viên trước khi chốt; các nguồn quen thuộc khác đều chết
-- hoặc chặn: pickleballmagazine (404), usapickleball (403), inpickleball (404),
-- pickleheads (404), selkirk (404), pickleballportal (404), thepicklr (bài mới
-- nhất 07/2025). Nguồn tiếng Việt để lại lần sau — feed pickleball riêng của
-- Thanh Niên đứng im từ 12/2025, feed thể thao chung cần lọc từ khoá.
--
-- Lưu ý: trust_tier hiện KHÔNG được code nào đọc; chỉ auto_publish quyết định
-- bài vào thẳng published hay nằm draft. Đặt tier 2 cho hai blog phi chính chủ
-- thuần để ghi chú mức tin cậy.
INSERT INTO public.news_sources (
  id, name, base_url, feed_url, feed_type, language,
  trust_tier, auto_publish, active, notes
) VALUES
  (
    'mlp',
    'Major League Pickleball',
    'https://majorleaguepickleball.co',
    'https://majorleaguepickleball.co/feed/',
    'rss', 'en', 1, true, true,
    'RSS WordPress chính chủ giải MLP. Domain .net 301 sang .co — dùng thẳng .co để khỏi tốn một hop redirect mỗi run.'
  ),
  (
    'pb-union',
    'Pickleball Union',
    'https://pickleballunion.com',
    'https://pickleballunion.com/feed/',
    'rss', 'en', 2, true, true,
    'Bài kỹ thuật / thể lực / chấn thương cho người chơi, không phải tin thời sự.'
  ),
  (
    'pb-rookie',
    'Pickleball Rookie',
    'https://pickleballrookie.com',
    'https://pickleballrookie.com/feed/',
    'rss', 'en', 2, true, true,
    'Hướng dẫn người mới + recap giải pro, giọng dễ đọc. Trùng một phần với The Dink.'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, base_url = EXCLUDED.base_url,
  feed_url = EXCLUDED.feed_url, feed_type = EXCLUDED.feed_type,
  active = true, last_error = NULL, notes = EXCLUDED.notes;

-- APP Pickleball: bật từ lần seed đầu nhưng CHƯA BAO GIỜ chạy — feed_url NULL
-- và worker cố tình lọc bỏ nguồn html_scrape chưa có cấu hình. Site là Webflow,
-- trang bài không có <meta article:published_time> nên worker đọc thẳng card
-- trên /news (tiêu đề + ngày + ảnh nằm sẵn trong card).
UPDATE public.news_sources
SET feed_url = 'https://www.theapp.global/news',
    last_error = NULL,
    notes = 'Webflow CMS. Parse trực tiếp card trên /news (HTML_SCRAPE_CONFIGS.app), không đi đường og:meta vì trang bài thiếu article:published_time.'
WHERE id = 'app';

-- Nối lại đoạn lịch sử bị đứt của nguồn 'ppa-tour'.
--
-- 20260805150000 tắt nguồn này vì RSS 404. Sau đó nguồn được sửa BẰNG TAY trên
-- production sang scrape trang /news/ và bật lại — không ai viết migration, nên
-- git và production nói hai chuyện khác nhau suốt 13 ngày: `db reset` dựng lại
-- một nguồn RSS đã chết, còn production thì đang chạy tốt (46 bài, lần fetch
-- thành công gần nhất 2026-08-18 14:00 UTC).
--
-- File này ghi lại đúng cái đang chạy. Sau nó, `db reset` cho ra state trùng
-- production, và cặp 20260805150000 + file này đọc như một câu chuyện liền:
-- tắt vì feed hỏng → đổi cách lấy tin → bật lại.
UPDATE public.news_sources
SET feed_url   = 'https://www.ppatour.com/news/',
    feed_type  = 'html_scrape',
    active     = true,
    last_error = NULL,
    notes      = 'Scrape trang /news/ (ppatour.com đã bỏ WordPress, không còn RSS — xem 20260805150000). Highest authority for US pro tour coverage.'
WHERE id = 'ppa-tour';

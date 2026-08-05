-- Q1 (Cuong duyệt 05/08): ppatour.com đã gỡ WordPress RSS — mọi biến thể /feed
-- đều 404 (verify 05/08). Tắt nguồn CÓ DẤU VẾT: last_error giữ việc-cần-làm và
-- được hiển thị ở /jobs + digest sáng ("Nguồn tin: x/y active · cần xử lý: ppa-tour")
-- cho tới khi có feed URL mới và bật lại. KHÔNG bao giờ tắt câm (pre-mortem #3).
UPDATE public.news_sources
SET active = false,
    last_error = 'RSS feed đã bị gỡ (ppatour.com bỏ WordPress — /feed, /news/feed, /blog/feed đều 404, verify 2026-08-05). Cần tìm URL feed mới rồi bật lại active=true.'
WHERE id = 'ppa-tour';

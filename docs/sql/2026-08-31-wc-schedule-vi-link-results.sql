-- Highest-ROI internal link of the World Cup week: the VI schedule article
-- carries ~36% of the site's clicks, and a reader who came for the schedule
-- wants the results next. Placed at the TOP of the body, not the bottom —
-- the click happens before the scroll.
--
-- Idempotent: the WHERE clause skips the update once the link is present.
UPDATE public.vi_blog_posts
SET content_html = $p$<p>👉 <strong>Kết quả cập nhật liên tục:</strong> <a href="/vi/blog/ket-qua-pickleball-world-cup-2026-da-nang">Kết quả Pickleball World Cup 2026 Đà Nẵng — từng trận, từng ngày</a></p>
$p$ || content_html,
    updated_at = now()
WHERE slug = 'lich-thi-dau-pickleball-world-cup-2026-da-nang'
  AND content_html NOT LIKE '%ket-qua-pickleball-world-cup-2026-da-nang%';

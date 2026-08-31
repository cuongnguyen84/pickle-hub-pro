-- VI results article, v4 — title and cover image follow the widened scope.
--
-- The title still said "trận của Việt Nam" after the scraper started keeping
-- every completed Pro match, and cover_image_url still pointed at the schedule
-- article's hero, so /vi served the wrong og:image while /blog served the new
-- one. Both are one-line fixes; the body is unchanged from v3.
--
-- Idempotent.
UPDATE public.vi_blog_posts SET
  title            = 'Kết quả Pickleball World Cup 2026 Đà Nẵng: mọi trận Pro, cập nhật từng phút',
  meta_description = 'Kết quả Pickleball World Cup 2026 Đà Nẵng: mọi trận Pro ở năm nội dung cá nhân, tỉ số từng ván, cập nhật liên tục.',
  cover_image_url  = '/images/blog/pickleball-world-cup-2026-da-nang-results-hero.webp',
  updated_at       = now()
WHERE slug = 'ket-qua-pickleball-world-cup-2026-da-nang';

-- ============================================================================
-- World Cup 2026 — làm mới bản VI trước ngày khai mạc 30/8
-- Sinh ngày 2026-08-26. Chạy trên Supabase project ajvlcamxemgbxduhiqrl.
-- CHỈ 2 UPDATE. Cả hai đều idempotent (dùng replace / kiểm tra tiền tố).
-- Cặp EN tương ứng đi kèm trong PR branch seo/world-cup-2026-geo-refresh.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. cam-nang-xem-... : bỏ đếm ngày tương đối.
--    "Cập nhật 24/8/2026 — còn 6 ngày, và lịch thi đấu đã có."
--    Viết ngày 24/8 thì đúng; hôm nay 26/8 đã sai; sáng 30/8 vẫn nói "còn 6
--    ngày" trong khi giải đang thi đấu. Thay bằng mốc tuyệt đối, không mục rữa.
-- ---------------------------------------------------------------------------
UPDATE vi_blog_posts
SET content_html = replace(
      content_html,
      'Cập nhật 24/8/2026 — còn 6 ngày, và lịch thi đấu đã có.',
      'Cập nhật 26/8/2026 — lịch thi đấu đã có đầy đủ, giải khởi tranh Chủ nhật 30/8.'
    ),
    updated_at = '2026-08-26T00:00:00Z'
WHERE slug = 'cam-nang-xem-pickleball-world-cup-2026-da-nang'
  AND content_html LIKE '%còn 6 ngày%';

-- ---------------------------------------------------------------------------
-- 2. world-cup-pickleball-2026-da-nang (bài evergreen, xuất bản 23/4):
--    thiếu dateline "Cập nhật" ở đoạn mở. CLAUDE.md yêu cầu bài dạng
--    lịch/danh sách/sống phải có dateline nhìn thấy được ở đoạn mở, và nó
--    nuôi schema dateModified. Thêm tiền tố vào <p> đầu tiên, đồng thời đổi
--    "sẽ diễn ra" -> "diễn ra" (giải còn 4 ngày, thì tương lai xa không còn đúng).
-- ---------------------------------------------------------------------------
UPDATE vi_blog_posts
SET content_html = replace(
      content_html,
      '<p>Heineken Pickleball World Cup 2026 (WCP 2026) sẽ diễn ra tại Đà Nẵng',
      '<p>Cập nhật 26/8/2026 — Heineken Pickleball World Cup 2026 (WCP 2026) diễn ra tại Đà Nẵng'
    ),
    updated_at = '2026-08-26T00:00:00Z'
WHERE slug = 'world-cup-pickleball-2026-da-nang'
  AND content_html NOT LIKE '%Cập nhật 26/8/2026%';

COMMIT;

-- ============================================================================
-- KIỂM TRA SAU KHI CHẠY (kỳ vọng: 2 dòng, cả hai ok = true)
-- ============================================================================
-- SELECT slug,
--        content_html NOT LIKE '%còn 6 ngày%' AS het_dem_ngay,
--        content_html LIKE '%Cập nhật 26/8/2026%' AS co_dateline,
--        updated_at
-- FROM vi_blog_posts
-- WHERE slug IN ('cam-nang-xem-pickleball-world-cup-2026-da-nang',
--                'world-cup-pickleball-2026-da-nang');

-- ============================================================================
-- SAU KHI CHẠY SQL: xả cache prerender (KV giữ HTML cũ tới hết TTL).
-- Giá trị phải đúng bằng "1", mọi giá trị khác đều bị bỏ qua.
--
--   curl -s -A "Googlebot" "https://www.thepicklehub.net/vi/blog/cam-nang-xem-pickleball-world-cup-2026-da-nang?nocache=1" -o /dev/null
--   curl -s -A "Googlebot" "https://www.thepicklehub.net/vi/blog/world-cup-pickleball-2026-da-nang?nocache=1" -o /dev/null
-- ============================================================================

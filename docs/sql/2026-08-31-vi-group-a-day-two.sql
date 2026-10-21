-- ============================================================================
-- World Cup 2026 — bài "bảng A" bản VI: dateline 31/8 + đính chính
-- "chưa có kết quả vòng bảng".
--
-- ĐÃ CHẠY 2026-08-31 03:55 UTC trên project ajvlcamxemgbxduhiqrl, qua
-- Management API /database/query. Hậu kiểm đã pass (xem cuối file).
-- Giữ lại làm hồ sơ; chạy lại là no-op nhờ guard ở WHERE.
--
-- BỐI CẢNH: bản EN (src/content/blog/posts/pickleball-world-cup-2026-group-a-
-- vietnam.ts) đã sửa trong commit 70aa6da. Bản VI nằm ở vi_blog_posts, KHÔNG
-- sinh ra từ file .ts đó, nên phải UPDATE riêng — đúng cái bẫy ghi trong
-- docs/milestones.md (WC-DANANG-SCHEDULE, 24/8).
--
-- VÌ SAO: bài rơi 13 -> 0 click tuần 22–28/8 đúng lúc traffic World Cup đỉnh.
-- Nó mang dateline 20/8 giữa lúc giải đang đấu, và không trả lời câu đang
-- được tra nhiều nhất: "Việt Nam đấu ngày nào". Đáp án là 3/9 — bảng A thuộc
-- giải ĐỒNG ĐỘI, tính tới 31/8 chưa đá trận nào (0/222). Chỉ giải Cá nhân
-- đang chạy (12/69 nội dung đã có nhà vô địch, đều Amateur).
--
-- GHI CHÚ SỬA PHƯƠNG ÁN: bản đầu của file này prepend một khối banner, vì
-- phiên soạn không có quyền đọc content_html nên không dám replace(). Sau khi
-- mở được egress tới Supabase, đã đọc được thân bài và thay bằng replace()
-- đúng đoạn mở — prepend sẽ để lại "Cập nhật 20/8/2026" ngay dưới banner
-- "Cập nhật 31/8/2026", hai dateline đá nhau trong đúng đoạn AI search trích.
-- ============================================================================

BEGIN;

-- 1. Đoạn mở + FAQ[0] + updated_at, trong một UPDATE.
--    faq_items dùng khoá 'question'/'answer' thuần (KHÔNG có tiền tố "Q: "/"A: "
--    như hàng bài overview) — đã SELECT jsonb_pretty kiểm trước khi ghi.
UPDATE vi_blog_posts
SET content_html = replace(
      content_html,
      '<p><em>Cập nhật 20/8/2026.</em> Đội tuyển Việt Nam nằm ở <strong>bảng A</strong> Heineken Pickleball World Cup 2026 (Đà Nẵng, <strong>30/8–6/9/2026</strong>) cùng <strong>Colombia</strong>, <strong>Chile</strong> và <strong>Cayman Islands</strong>.',
      '<p><em>Cập nhật 31/8/2026</em> — đội tuyển Việt Nam <strong>chưa đá trận bảng A nào</strong>, và phải tới <strong>thứ Năm 3/9</strong> mới ra quân. Việt Nam nằm ở <strong>bảng A</strong> giải Đồng đội Quốc gia tại Heineken Pickleball World Cup 2026 (Đà Nẵng) cùng <strong>Colombia</strong>, <strong>Chile</strong> và <strong>Cayman Islands</strong>, theo kết quả bốc thăm chính thức ngày 16/8/2026. Giải Cá nhân đã khởi tranh từ 30/8 và tới sáng 31/8 đã có nhà vô địch ở 12 trong 69 nội dung — đều thuộc nhóm Amateur — nhưng giải Đồng đội, nơi có bảng A, diễn ra <strong>3–6/9/2026</strong> và tính tới 31/8 chưa trận nào trong 222 trận được đá.'
    ),
    faq_items = jsonb_set(
      faq_items,
      '{0,answer}',
      to_jsonb('Đội tuyển Việt Nam nằm ở bảng A cùng Colombia, Chile và Cayman Islands, được xác nhận qua buổi bốc thăm chính thức ngày 16/8/2026. Bảng A thuộc giải Đồng đội Quốc gia, thi đấu 3–6/9/2026 — tức trận đầu tiên của Việt Nam ở bảng A là thứ Năm 3/9, không phải cuối tuần khai mạc 30/8. Riêng nội dung Open có 64 đội chia 16 bảng. Danh sách VĐV chính thức của ba đội còn lại trong bảng vẫn chưa được công bố tính tới 31/8/2026.'::text),
      false
    ),
    updated_at = '2026-08-31T00:00:00Z'
WHERE slug = 'bang-a-world-cup-pickleball-2026-doi-thu-viet-nam'
  AND content_html LIKE '%Cập nhật 20/8/2026%';

COMMIT;

-- ---------------------------------------------------------------------------
-- 2. HẬU KIỂM — bắt buộc. Management API trả [] cho UPDATE, và [] KHÔNG có
--    nghĩa là đã sửa được gì (bài học 29/8). Chỉ SELECT lại mới biết.
-- ---------------------------------------------------------------------------
SELECT updated_at,
       (content_html LIKE '%Cập nhật 31/8/2026%')      AS dateline_31,
       (content_html LIKE '%Cập nhật 20/8/2026%')      AS stale_20_left,
       (content_html LIKE '%chưa đá trận bảng A nào%') AS has_sep3_fact,
       (faq_items->0->>'answer' LIKE '%3/9%')          AS faq_fixed,
       (faq_items->0->>'answer' LIKE '%20/8/2026%')    AS faq_stale_left,
       jsonb_array_length(faq_items)                   AS faq_count,
       length(content_html)                            AS body_len
FROM vi_blog_posts
WHERE slug = 'bang-a-world-cup-pickleball-2026-doi-thu-viet-nam';

-- KẾT QUẢ THỰC TẾ 2026-08-31:
--   updated_at 2026-08-31 03:55:57+00 (trigger DB tự set now(), không phải
--     00:00:00Z như câu lệnh yêu cầu — vô hại, dateModified vẫn ra 31/8)
--   dateline_31 t · stale_20_left f · has_sep3_fact t
--   faq_fixed t · faq_stale_left f · faq_count 6 (mảng không hỏng)
--   body_len 11538 -> 11935
--
-- VERIFY PROD (curl -A Googlebot, ?nocache=1), cả hai HTTP 200:
--   /vi/blog/bang-a-world-cup-pickleball-2026-doi-thu-viet-nam
--     2.616 từ · dateModified 2026-08-31T03:55:57+00:00 · hreflang en/vi/x-default
--   /blog/pickleball-world-cup-2026-group-a-vietnam
--     2.275 từ · dateModified 2026-08-31 · hreflang en/vi/x-default
--   0 lần sót dateline cũ ở cả hai.
-- IndexNow: POST api.indexnow.org 200 cho cả 2 URL.
-- CÒN LẠI: request indexing trong GSC URL Inspection (không có API cho blog).

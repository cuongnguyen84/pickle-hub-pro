-- ============================================================================
-- World Cup 2026 — bài "bảng A" bản VI: dateline 31/8 + đính chính "chưa có
-- kết quả vòng bảng".
-- Sinh ngày 2026-08-31. Chạy trên Supabase project ajvlcamxemgbxduhiqrl.
--
-- BỐI CẢNH: bản EN (src/content/blog/posts/pickleball-world-cup-2026-group-a-
-- vietnam.ts) đã được cập nhật trong cùng commit. Bản VI nằm ở vi_blog_posts,
-- KHÔNG sinh ra từ file .ts đó, nên phải UPDATE riêng — đúng cái bẫy đã ghi
-- trong docs/milestones.md (WC-DANANG-SCHEDULE, 24/8).
--
-- VÌ SAO: bài này rơi 13 -> 0 click trong tuần 22–28/8 đúng lúc traffic World
-- Cup đạt đỉnh. Nó vẫn mang dateline 20/8 trong khi giải đã thi đấu, và nó
-- KHÔNG trả lời câu hỏi đang được tra nhiều nhất: "Việt Nam đấu ngày nào".
-- Câu trả lời là 3/9 — bảng A thuộc giải ĐỒNG ĐỘI, chưa đá trận nào tính tới
-- 31/8 (0/222). Chỉ giải Cá nhân đang chạy.
--
-- ⚠️ KHÔNG dùng replace() trên thân bài: phiên sinh file này không có
-- credential Supabase nên KHÔNG đọc được content_html hiện tại, và replace()
-- vào một chuỗi đoán mò sẽ im lặng không khớp. Thay vào đó CHÈN THÊM một khối
-- cập nhật lên đầu thân bài — không phụ thuộc nội dung cũ, và idempotent nhờ
-- guard NOT LIKE ở WHERE.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. ĐỌC TRƯỚC KHI CHẠY — xác nhận slug tồn tại và chưa có khối cập nhật.
--    Kỳ vọng: 1 hàng, has_banner = false.
-- ---------------------------------------------------------------------------
SELECT slug,
       updated_at,
       (content_html LIKE '%data-update="2026-08-31"%') AS has_banner,
       left(content_html, 200) AS body_head
FROM vi_blog_posts
WHERE slug = 'bang-a-world-cup-pickleball-2026-doi-thu-viet-nam';

-- ---------------------------------------------------------------------------
-- 1. Chèn khối cập nhật 31/8 lên đầu thân bài.
--    Đặt ĐẦU BÀI là có chủ ý: theo quy tắc GEO trong CLAUDE.md, đoạn mở là
--    đoạn AI search trích ra độc lập, nên dữ kiện "chưa đá, 3/9 mới ra quân"
--    phải nằm ở đó chứ không phải giữa bài.
-- ---------------------------------------------------------------------------
UPDATE vi_blog_posts
SET content_html = '<p data-update="2026-08-31"><strong>Cập nhật 31/8/2026:</strong> '
      || 'đội tuyển Việt Nam <strong>chưa đá trận bảng A nào</strong>, và phải tới '
      || '<strong>thứ Năm 3/9</strong> mới ra quân — gặp Colombia từ 08:00. '
      || 'Bảng A thuộc <strong>giải Đồng đội Quốc gia</strong>, thi đấu 3–6/9/2026; '
      || 'tính tới 31/8 chưa trận nào trong 222 trận của giải này được đá. '
      || 'Phần đang thi đấu từ 30/8 là <strong>giải Cá nhân</strong> — một giải khác, '
      || 'mở đăng ký theo điểm DUPR — và tới sáng 31/8 đã có nhà vô địch ở 12 trong '
      || '69 nội dung, đều thuộc nhóm Amateur. Vì vậy trang này chưa có kết quả vòng '
      || 'bảng: chưa có trận nào để có kết quả. '
      || '<a href="/vi/blog/lich-thi-dau-pickleball-world-cup-2026-da-nang">'
      || 'Xem lịch thi đấu đầy đủ theo từng ngày</a>.</p>'
      || content_html,
    updated_at = '2026-08-31T00:00:00Z'
WHERE slug = 'bang-a-world-cup-pickleball-2026-doi-thu-viet-nam'
  AND content_html NOT LIKE '%data-update="2026-08-31"%';

-- ---------------------------------------------------------------------------
-- 2. HẬU KIỂM — bắt buộc. Kỳ vọng: has_banner = true, updated_at = 31/8.
--    Bài học 29/8: Management API trả [] KHÔNG có nghĩa là đã sửa được gì —
--    phải SELECT lại mới biết.
-- ---------------------------------------------------------------------------
SELECT slug,
       updated_at,
       (content_html LIKE '%data-update="2026-08-31"%') AS has_banner,
       (content_html LIKE '%3/9%') AS mentions_sep3
FROM vi_blog_posts
WHERE slug = 'bang-a-world-cup-pickleball-2026-doi-thu-viet-nam';

COMMIT;

-- ============================================================================
-- 3. CÒN PHẢI LÀM BẰNG TAY (cố ý KHÔNG viết UPDATE mù ở đây)
--
-- a) faq_items của hàng này là jsonb viết tay, và các hàng World Cup KHÔNG
--    dùng chung một bộ khoá — hàng bài overview dùng tiền tố "Q: "/"A: " trong
--    khi hai hàng kia thì không (ghi nhận 29/8). Không đọc được row thì mọi
--    UPDATE jsonb ở đây đều là đoán. Hãy chạy:
--
--      SELECT jsonb_pretty(faq_items) FROM vi_blog_posts
--      WHERE slug = 'bang-a-world-cup-pickleball-2026-doi-thu-viet-nam';
--
--    rồi sửa câu "Việt Nam nằm ở bảng A..." để thêm: bảng A thuộc giải Đồng
--    đội, đấu 3–6/9, trận đầu 3/9 gặp Colombia.
--
-- b) Sau khi chạy xong: request indexing cho
--    https://www.thepicklehub.net/vi/blog/bang-a-world-cup-pickleball-2026-doi-thu-viet-nam
--    (GSC URL Inspection) + IndexNow, và verify bằng
--    curl -A "Googlebot" '<url>?nocache=1' — phải thấy chuỗi "3/9" và
--    dateModified 2026-08-31.
-- ============================================================================

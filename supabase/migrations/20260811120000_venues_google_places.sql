-- Sprint 2 (Content Effort venue) — Google Places enrichment, hướng A+B.
-- Cuong chốt 2026-08-11: dùng Places để (A) điền NAP/hours/phone đang NULL bằng
-- data của mình, và (B) hiện badge rating "★x · N đánh giá trên Google" link-out.
--
-- TOS Google Places:
--   * place_id  — cache vĩnh viễn (được phép).
--   * rating / review_count — chỉ cache ngắn hạn; script enrich refresh <= 25 ngày
--     (dưới trần 30 ngày) + luôn hiển thị kèm attribution "trên Google" và link tới
--     listing Google. KHÔNG lưu review text, KHÔNG lưu ảnh (chỉ link-out).
--   * NAP (phone/website/address) — script chỉ ghi vào cột khi cột đang NULL, không
--     ghi đè dữ liệu cộng đồng đã nhập.
--
-- Không thêm cột giá: Places KHÔNG cung cấp giá thuê sân/giờ — nguồn giá tách riêng.

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS google_rating numeric(2, 1),
  ADD COLUMN IF NOT EXISTS google_review_count integer,
  ADD COLUMN IF NOT EXISTS google_synced_at timestamptz;

COMMENT ON COLUMN public.venues.google_place_id IS
  'Google Places place_id (cache vĩnh viễn theo TOS). Khoá để refresh rating.';
COMMENT ON COLUMN public.venues.google_rating IS
  'Rating 0-5 từ Places; cache ngắn hạn, refresh <=25 ngày, hiển thị kèm attribution + link-out.';
COMMENT ON COLUMN public.venues.google_review_count IS
  'user_ratings_total từ Places; cùng ràng buộc cache như google_rating.';
COMMENT ON COLUMN public.venues.google_synced_at IS
  'Lần cuối script enrich-venues-google-places.mjs đồng bộ venue này (dùng để chọn venue cần refresh).';

-- Chọn nhanh venue chưa map / cần refresh cho script backfill.
CREATE INDEX IF NOT EXISTS idx_venues_google_synced_at
  ON public.venues (google_synced_at NULLS FIRST);

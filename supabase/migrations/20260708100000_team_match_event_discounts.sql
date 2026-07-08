-- Team Match: ngày tổ chức + địa điểm + bậc giảm giá slot đăng ký sớm.
-- discount_tiers: JSONB mảng [{"slots": 10, "percent": 20}, {"slots": 5, "percent": 15}]
-- — slot đội tính theo thứ tự đăng ký (created_at), cộng dồn từ bậc đầu.
ALTER TABLE public.team_match_tournaments
  ADD COLUMN IF NOT EXISTS event_date     DATE,
  ADD COLUMN IF NOT EXISTS location       TEXT,
  ADD COLUMN IF NOT EXISTS discount_tiers JSONB;

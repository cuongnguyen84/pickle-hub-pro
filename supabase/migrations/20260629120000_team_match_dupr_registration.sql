-- Team Match (MLP): tuỳ chọn dùng DUPR khi yêu cầu đăng ký + điểm DUPR tối đa theo giới tính.
-- Native wizard bước 1: bật "Sử dụng DUPR" → nhập DUPR tối đa cho Nam & Nữ.
ALTER TABLE public.team_match_tournaments
  ADD COLUMN IF NOT EXISTS require_dupr boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dupr_max_male numeric,
  ADD COLUMN IF NOT EXISTS dupr_max_female numeric;

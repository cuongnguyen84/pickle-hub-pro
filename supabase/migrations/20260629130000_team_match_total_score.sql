-- Team Match (MLP): chế độ tính theo TỔNG điểm.
-- Trận = 1 game liên tục tới t = (số game) × (points_per_game); tới t là thắng (không deuce).
-- t suy ra runtime từ số game × points_per_game (không lưu cứng).
ALTER TABLE public.team_match_tournaments
  ADD COLUMN IF NOT EXISTS total_score_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS points_per_game integer;

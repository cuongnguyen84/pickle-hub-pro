-- MLP "Tái sinh" (repechage) — nhánh phụ cho đội hạng 3,4 mỗi bảng, chạy song
-- song với playoff (lấy hạng 1,2). Cùng logic phân nhánh/xếp cặp như playoff.
-- Additive: web bỏ qua 2 cột này, native (feat/mlp-captain-registration) dùng.

ALTER TABLE public.team_match_tournaments
  ADD COLUMN IF NOT EXISTS has_repechage BOOLEAN DEFAULT false;

-- Đánh dấu trận thuộc nhánh tái sinh. is_playoff vẫn = true (trận loại trực tiếp)
-- nên advancement theo next_match_id dùng chung; is_repechage tách để hiển thị
-- riêng và loại khỏi BXH/playoff chính.
ALTER TABLE public.team_match_matches
  ADD COLUMN IF NOT EXISTS is_repechage BOOLEAN DEFAULT false;

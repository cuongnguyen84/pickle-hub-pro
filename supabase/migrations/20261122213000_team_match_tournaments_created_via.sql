-- 'chat' đánh dấu giải đồng đội tạo từ chat AI; mặc định 'manual' cho các trường hợp khác.
-- Chỉ dùng để hiển thị dòng ghi nguồn trên trang giải đồng đội tạo từ chat.
ALTER TABLE public.team_match_tournaments ADD COLUMN IF NOT EXISTS created_via text NOT NULL DEFAULT 'manual';

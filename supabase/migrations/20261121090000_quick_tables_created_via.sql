-- 'chat' đánh dấu giải tạo từ chat AI; mặc định 'manual' cho các trường hợp khác.
-- Chỉ dùng để hiển thị dòng ghi nguồn trên bảng đấu tạo từ chat.
ALTER TABLE public.quick_tables ADD COLUMN IF NOT EXISTS created_via text NOT NULL DEFAULT 'manual';

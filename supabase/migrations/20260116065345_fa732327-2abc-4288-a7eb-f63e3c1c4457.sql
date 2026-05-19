-- Tạo enum cho status
CREATE TYPE public.news_status AS ENUM ('draft', 'scheduled', 'published');

-- Tạo bảng news_items
CREATE TABLE public.news_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  status public.news_status DEFAULT 'draft' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tạo index cho truy vấn hiệu quả
CREATE INDEX idx_news_items_status_published_at 
  ON public.news_items(status, published_at DESC);

-- Bật RLS
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;

-- Policy: Cho phép đọc tin đã published (không cần đăng nhập)
CREATE POLICY "Published news are publicly readable"
ON public.news_items
FOR SELECT
USING (status = 'published');

-- Không tạo policy cho INSERT/UPDATE/DELETE
-- Chỉ service_role mới có thể ghi dữ liệu (bypass RLS)
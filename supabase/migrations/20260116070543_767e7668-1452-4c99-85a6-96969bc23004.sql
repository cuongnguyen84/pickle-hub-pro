-- Add show_on_home field for admin control
ALTER TABLE public.news_items 
ADD COLUMN show_on_home BOOLEAN DEFAULT false NOT NULL;

-- Create index for efficient home page query
CREATE INDEX idx_news_items_home_featured 
  ON public.news_items(show_on_home, status, published_at DESC) 
  WHERE show_on_home = true AND status = 'published';
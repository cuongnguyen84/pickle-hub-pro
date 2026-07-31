-- Rewritten articles must not all display the site-wide OG card as if it were
-- an article photograph. Until an original per-article image pipeline exists,
-- render the text article without a hero image.
UPDATE public.news_items
SET image_url = NULL
WHERE origin_id IS NOT NULL
  AND image_url = '/og-image.png';

CREATE OR REPLACE FUNCTION public.normalize_editorial_news_public_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.source_url IS NOT NULL THEN
    RAISE EXCEPTION 'source_url belongs in news_origins'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.origin_id IS NOT NULL THEN
    SELECT o.source_image_url INTO NEW.image_url
    FROM public.news_origins o
    WHERE o.id = NEW.origin_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_public_news_source_url ON public.news_items;
CREATE TRIGGER reject_public_news_source_url
  BEFORE INSERT OR UPDATE OF source_url, image_url, origin_id ON public.news_items
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_editorial_news_public_fields();

-- Prevent a legacy or stale ingester from reintroducing outbound source URLs
-- into the anonymously readable news_items table. The editorial publisher
-- always writes NULL; source URLs belong only in the protected news_origins.
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

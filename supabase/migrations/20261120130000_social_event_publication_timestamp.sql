-- First publication OBSERVED after rollout. Existing rows remain NULL: neither
-- created_at nor migration time proves when a historical draft was published.
ALTER TABLE public.social_events ADD COLUMN first_published_at timestamptz;
COMMENT ON COLUMN public.social_events.first_published_at IS
  'Server-owned first publication observed after rollout; immutable once set. NULL on historical rows means unknown, not never published.';

CREATE FUNCTION public.stamp_social_event_first_publication()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.first_published_at := CASE WHEN NEW.status = 'published' THEN statement_timestamp() ELSE NULL END;
  ELSIF OLD.first_published_at IS NOT NULL THEN
    NEW.first_published_at := OLD.first_published_at;
  ELSIF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
    NEW.first_published_at := statement_timestamp();
  ELSE
    NEW.first_published_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.stamp_social_event_first_publication() FROM PUBLIC;
CREATE TRIGGER stamp_social_event_first_publication
BEFORE INSERT OR UPDATE ON public.social_events
FOR EACH ROW EXECUTE FUNCTION public.stamp_social_event_first_publication();

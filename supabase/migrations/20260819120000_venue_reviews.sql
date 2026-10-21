-- Venue review system (P1) — first-hand user reviews on /san/:slug.
-- Cuong chốt 2026-08-19: mô hình A — review hiện NGAY (default 'published'),
-- admin ẩn spam sau (set 'hidden'). Login + 1-review/user/sân là guard P1;
-- rate-limit theo ngày để P3 cùng admin moderation.
--
-- SEO: sinh aggregateRating + Review schema hợp lệ trên venue (entity bên thứ 3,
-- như TripAdvisor/Yelp) + review text = nội dung first-hand gốc. Đây là moat,
-- thay cho Google Places badge (bị chặn billing + không được nhét vào schema).

-- ── table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.venue_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  created_by  uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        text,
  status      text NOT NULL DEFAULT 'published',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.venue_reviews DROP CONSTRAINT IF EXISTS venue_reviews_status_check;
ALTER TABLE public.venue_reviews
  ADD CONSTRAINT venue_reviews_status_check CHECK (status IN ('published', 'hidden'));

-- One active review per user per venue (edit-in-place; no duplicate spam).
CREATE UNIQUE INDEX IF NOT EXISTS uq_venue_reviews_user_venue
  ON public.venue_reviews (venue_id, created_by);

-- SSR read path: published reviews of a venue, newest first.
CREATE INDEX IF NOT EXISTS idx_venue_reviews_venue_published
  ON public.venue_reviews (venue_id, created_at DESC)
  WHERE status = 'published';

-- ── aggregate columns on venues (trigger-maintained, cheap SSR read) ─────────
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_avg   numeric(2, 1);

COMMENT ON COLUMN public.venues.review_count IS 'Count of published venue_reviews (trigger-maintained).';
COMMENT ON COLUMN public.venues.review_avg   IS 'Avg rating of published venue_reviews, 1 decimal (trigger-maintained).';

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.venue_reviews ENABLE ROW LEVEL SECURITY;

-- Published readable by everyone; authors + admins always see their own/all.
DROP POLICY IF EXISTS "venue_reviews_select" ON public.venue_reviews;
CREATE POLICY "venue_reviews_select" ON public.venue_reviews
  FOR SELECT
  USING (
    status = 'published'
    OR auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin')
  );

-- Insert: authenticated, own row only, and only as 'published' (can't pre-hide
-- someone else's or forge status). One-per-venue enforced by the unique index.
DROP POLICY IF EXISTS "venue_reviews_insert_owner" ON public.venue_reviews;
CREATE POLICY "venue_reviews_insert_owner" ON public.venue_reviews
  FOR INSERT
  WITH CHECK (auth.uid() = created_by AND status = 'published');

-- Update: author may edit their own content (must stay 'published' — they can't
-- moderate); admin may set any status (the hide/unhide moderation action).
DROP POLICY IF EXISTS "venue_reviews_update_owner_or_admin" ON public.venue_reviews;
CREATE POLICY "venue_reviews_update_owner_or_admin" ON public.venue_reviews
  FOR UPDATE
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    (auth.uid() = created_by AND status = 'published')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Delete: author or admin.
DROP POLICY IF EXISTS "venue_reviews_delete_owner_or_admin" ON public.venue_reviews;
CREATE POLICY "venue_reviews_delete_owner_or_admin" ON public.venue_reviews
  FOR DELETE
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.venue_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_reviews TO authenticated;

-- ── aggregate trigger (recompute from scratch — correct across insert/edit/
--    status-flip/delete without increment drift) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_venue_reviews_aggregate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vid uuid;
BEGIN
  vid := COALESCE(NEW.venue_id, OLD.venue_id);
  UPDATE public.venues v SET
    review_count = (SELECT count(*) FROM public.venue_reviews r
                    WHERE r.venue_id = vid AND r.status = 'published'),
    review_avg   = (SELECT round(avg(r.rating)::numeric, 1) FROM public.venue_reviews r
                    WHERE r.venue_id = vid AND r.status = 'published')
  WHERE v.id = vid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_venue_reviews_aggregate ON public.venue_reviews;
CREATE TRIGGER trg_venue_reviews_aggregate
  AFTER INSERT OR UPDATE OR DELETE ON public.venue_reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_venue_reviews_aggregate();

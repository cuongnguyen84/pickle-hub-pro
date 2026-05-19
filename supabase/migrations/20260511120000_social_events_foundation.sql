-- ============================================================================
-- Social Events MVP — Sprint 1 PR1 foundation
-- ============================================================================
-- Net-new tables for the social-event feature: clubs, social_events,
-- event_registrations, otp_codes. Built for VN pickleball CLB workflow:
--   - Club admin creates a social event with a public landing page
--   - Players register by phone + OTP (no auth.users account required)
--     via a "ghost profile" pattern (is_ghost=true) — same approach as
--     the pro-tour ghost player import (20260510160000_pro_tour_foundation).
--   - Organizer manages roster + manual paid status from a dashboard.
--
-- Conventions matched from prior Sprints:
--   - Idempotent DO blocks + IF NOT EXISTS so a partial replay is safe.
--   - RLS uses DROP+CREATE (no CREATE POLICY IF NOT EXISTS in Postgres).
--   - Admin gates use the existing public.has_role(uuid, app_role) function.
--   - Public-readable rows go through SELECT policies; mutation policies
--     enforce ownership via auth.uid() = created_by.
--
-- Anti-scope (later PRs/sprints):
--   - PR2 ships the public landing page + OTP edge functions consuming
--     these tables.
--   - PR3 ships the organizer dashboard + matchmaking tools.
--   - Payment gateway / Zalo OA / live scoring all deferred.
--
-- IDEMPOTENT: replay-safe.
-- ============================================================================

-- ─── 1. clubs ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clubs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  logo_url        TEXT,
  location_text   TEXT,
  created_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Slug shape: lowercase alphanumerics + dashes, 3..60 chars, must start
-- and end with an alphanumeric. Length policed separately so the regex
-- stays simple and ARE-portable.
ALTER TABLE public.clubs
  DROP CONSTRAINT IF EXISTS clubs_slug_format;
ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_slug_format
  CHECK (
    slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'
    AND length(slug) BETWEEN 3 AND 60
  );

CREATE INDEX IF NOT EXISTS idx_clubs_created_by ON public.clubs (created_by);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clubs_select_all" ON public.clubs;
CREATE POLICY "clubs_select_all" ON public.clubs
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "clubs_insert_owner" ON public.clubs;
CREATE POLICY "clubs_insert_owner" ON public.clubs
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "clubs_update_owner_or_admin" ON public.clubs;
CREATE POLICY "clubs_update_owner_or_admin" ON public.clubs
  FOR UPDATE
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "clubs_delete_admin_only" ON public.clubs;
CREATE POLICY "clubs_delete_admin_only" ON public.clubs
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));


-- ─── 2. social_events ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.social_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  slug                TEXT NOT NULL UNIQUE,
  title_vi            TEXT NOT NULL,
  title_en            TEXT,
  description_vi      TEXT,
  description_en      TEXT,
  start_at            TIMESTAMPTZ NOT NULL,
  end_at              TIMESTAMPTZ NOT NULL,
  location_text       TEXT,
  location_lat        NUMERIC(9, 6),
  location_lng        NUMERIC(9, 6),
  court_count         INTEGER NOT NULL DEFAULT 1,
  max_players         INTEGER NOT NULL DEFAULT 16,
  level_min           NUMERIC(3, 2),
  level_max           NUMERIC(3, 2),
  price_vnd           INTEGER NOT NULL DEFAULT 0,
  allow_guests        BOOLEAN NOT NULL DEFAULT true,
  cancellation_hours  INTEGER NOT NULL DEFAULT 12,
  zalo_group_url      TEXT,
  status              TEXT NOT NULL DEFAULT 'draft',
  visibility          TEXT NOT NULL DEFAULT 'public',
  created_by          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_events
  DROP CONSTRAINT IF EXISTS social_events_slug_format;
ALTER TABLE public.social_events
  ADD CONSTRAINT social_events_slug_format
  CHECK (
    slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'
    AND length(slug) BETWEEN 3 AND 100
  );

ALTER TABLE public.social_events
  DROP CONSTRAINT IF EXISTS social_events_status_check;
ALTER TABLE public.social_events
  ADD CONSTRAINT social_events_status_check
  CHECK (status IN ('draft', 'published', 'cancelled', 'completed'));

ALTER TABLE public.social_events
  DROP CONSTRAINT IF EXISTS social_events_visibility_check;
ALTER TABLE public.social_events
  ADD CONSTRAINT social_events_visibility_check
  CHECK (visibility IN ('public', 'club_only'));

ALTER TABLE public.social_events
  DROP CONSTRAINT IF EXISTS social_events_time_order;
ALTER TABLE public.social_events
  ADD CONSTRAINT social_events_time_order
  CHECK (end_at > start_at);

ALTER TABLE public.social_events
  DROP CONSTRAINT IF EXISTS social_events_max_players_positive;
ALTER TABLE public.social_events
  ADD CONSTRAINT social_events_max_players_positive
  CHECK (max_players >= 2 AND max_players <= 200);

ALTER TABLE public.social_events
  DROP CONSTRAINT IF EXISTS social_events_court_count_positive;
ALTER TABLE public.social_events
  ADD CONSTRAINT social_events_court_count_positive
  CHECK (court_count >= 1 AND court_count <= 50);

ALTER TABLE public.social_events
  DROP CONSTRAINT IF EXISTS social_events_price_nonneg;
ALTER TABLE public.social_events
  ADD CONSTRAINT social_events_price_nonneg
  CHECK (price_vnd >= 0);

ALTER TABLE public.social_events
  DROP CONSTRAINT IF EXISTS social_events_cancellation_hours_check;
ALTER TABLE public.social_events
  ADD CONSTRAINT social_events_cancellation_hours_check
  CHECK (cancellation_hours >= 0 AND cancellation_hours <= 168);

ALTER TABLE public.social_events
  DROP CONSTRAINT IF EXISTS social_events_level_order;
ALTER TABLE public.social_events
  ADD CONSTRAINT social_events_level_order
  CHECK (
    level_min IS NULL
    OR level_max IS NULL
    OR level_max >= level_min
  );

CREATE INDEX IF NOT EXISTS idx_social_events_club_id ON public.social_events (club_id);
CREATE INDEX IF NOT EXISTS idx_social_events_created_by ON public.social_events (created_by);
CREATE INDEX IF NOT EXISTS idx_social_events_status_start_at
  ON public.social_events (status, start_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_events_upcoming
  ON public.social_events (start_at)
  WHERE status = 'published';

ALTER TABLE public.social_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_events_select_public" ON public.social_events;
CREATE POLICY "social_events_select_public" ON public.social_events
  FOR SELECT
  USING (
    (status = 'published' AND visibility = 'public')
    OR auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "social_events_insert_owner" ON public.social_events;
CREATE POLICY "social_events_insert_owner" ON public.social_events
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "social_events_update_owner_or_admin" ON public.social_events;
CREATE POLICY "social_events_update_owner_or_admin" ON public.social_events
  FOR UPDATE
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "social_events_delete_owner_or_admin" ON public.social_events;
CREATE POLICY "social_events_delete_owner_or_admin" ON public.social_events
  FOR DELETE
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));


-- ─── 3. event_registrations ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_registrations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES public.social_events(id) ON DELETE CASCADE,
  profile_id          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone               TEXT,
  display_name        TEXT NOT NULL,
  self_rated_level    NUMERIC(3, 2),
  status              TEXT NOT NULL DEFAULT 'registered',
  payment_status      TEXT NOT NULL DEFAULT 'unpaid',
  paid_at             TIMESTAMPTZ,
  notes               TEXT,
  registered_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_status_check;
ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_status_check
  CHECK (status IN ('registered', 'checked_in', 'cancelled', 'no_show'));

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_payment_check;
ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_payment_check
  CHECK (payment_status IN ('unpaid', 'paid', 'refunded'));

-- Every registration must be reachable: either linked to a profile, or carry
-- a phone + display_name (guest / ghost path). Both can coexist when an
-- authenticated user registers with their own phone.
ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_identity_present;
ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_identity_present
  CHECK (
    profile_id IS NOT NULL
    OR (phone IS NOT NULL AND length(trim(display_name)) > 0)
  );

-- Phone format: E.164 (e.g. +84901234567). Lenient length so we don't reject
-- legitimate non-VN numbers; client-side helpers enforce VN-specific rules.
ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_phone_format;
ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_phone_format
  CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$');

-- One profile per event, when present (partial unique).
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_registrations_event_profile
  ON public.event_registrations (event_id, profile_id)
  WHERE profile_id IS NOT NULL;

-- One phone per event, when present (partial unique). Guests who later log
-- in won't double-register because phone-only registration upserts the
-- ghost profile in PR2, after which the profile_id branch covers them.
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_registrations_event_phone
  ON public.event_registrations (event_id, phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id
  ON public.event_registrations (event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_profile_id
  ON public.event_registrations (profile_id)
  WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_registrations_event_status
  ON public.event_registrations (event_id, status);

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone can read registrations for a published+public event (used by
-- the public landing page roster preview, names masked client-side). Owner
-- of the event + admins see everything regardless of visibility. The
-- registrant themselves can read their own row when authenticated.
DROP POLICY IF EXISTS "event_registrations_select" ON public.event_registrations;
CREATE POLICY "event_registrations_select" ON public.event_registrations
  FOR SELECT
  USING (
    auth.uid() = profile_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.social_events e
      WHERE e.id = event_registrations.event_id
        AND (
          e.created_by = auth.uid()
          OR (e.status = 'published' AND e.visibility = 'public')
        )
    )
  );

-- INSERT: authenticated users can register themselves (profile_id =
-- auth.uid()). Guest (phone-only) inserts go through the
-- phone-otp-verify edge function using the service role key, which
-- bypasses RLS — no INSERT policy needed for that path.
DROP POLICY IF EXISTS "event_registrations_insert_self" ON public.event_registrations;
CREATE POLICY "event_registrations_insert_self" ON public.event_registrations
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND profile_id = auth.uid()
  );

-- UPDATE: organizer of the event, or admin. Registrant cannot self-update
-- (no self-check-in / self-paid) — those flow through organizer review.
DROP POLICY IF EXISTS "event_registrations_update_organizer" ON public.event_registrations;
CREATE POLICY "event_registrations_update_organizer" ON public.event_registrations
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.social_events e
      WHERE e.id = event_registrations.event_id
        AND e.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.social_events e
      WHERE e.id = event_registrations.event_id
        AND e.created_by = auth.uid()
    )
  );

-- DELETE: organizer or admin only.
DROP POLICY IF EXISTS "event_registrations_delete_organizer" ON public.event_registrations;
CREATE POLICY "event_registrations_delete_organizer" ON public.event_registrations
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.social_events e
      WHERE e.id = event_registrations.event_id
        AND e.created_by = auth.uid()
    )
  );


-- ─── 4. otp_codes ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.otp_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,
  event_id    UUID NOT NULL REFERENCES public.social_events(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_codes
  DROP CONSTRAINT IF EXISTS otp_codes_phone_format;
ALTER TABLE public.otp_codes
  ADD CONSTRAINT otp_codes_phone_format
  CHECK (phone ~ '^\+[1-9][0-9]{7,14}$');

CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_event_unused
  ON public.otp_codes (phone, event_id)
  WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_otp_codes_created_at
  ON public.otp_codes (created_at DESC);

-- RLS: zero public access. Only the service role (edge functions) can
-- read/write. Enabling RLS without a single policy effectively locks the
-- table to service_role + database superuser.
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;


-- ─── 5. updated_at trigger ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_social_events_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clubs_touch_updated_at ON public.clubs;
CREATE TRIGGER trg_clubs_touch_updated_at
  BEFORE UPDATE ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_social_events_touch_updated_at();

DROP TRIGGER IF EXISTS trg_social_events_touch_updated_at ON public.social_events;
CREATE TRIGGER trg_social_events_touch_updated_at
  BEFORE UPDATE ON public.social_events
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_social_events_touch_updated_at();


-- ─── 6. Comments for catalog discoverability ────────────────────────────────

COMMENT ON TABLE public.clubs IS
  'Pickleball CLB (club) — lightweight container for social events. created_by is the club admin.';
COMMENT ON TABLE public.social_events IS
  'Social events hosted by a CLB or solo organizer. Public-discoverable landing page + roster + optional matchmaking. See migrations/20260511120000_social_events_foundation.sql.';
COMMENT ON TABLE public.event_registrations IS
  'Per-event roster row. Either profile_id (authed) or phone+display_name (guest via OTP). Organizer mutates check_in / paid status manually.';
COMMENT ON TABLE public.otp_codes IS
  'Short-lived OTP store for phone-based event registration. service_role-only via RLS; consumed by phone-otp-send + phone-otp-verify edge functions.';

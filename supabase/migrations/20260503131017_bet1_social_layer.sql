-- ============================================================================
-- Bet #1 Social Layer — Sprint 1 Foundation
-- ============================================================================
-- Spec: docs picklehub-bet1-spec-v2.md (sections 3.1-3.12)
-- Branch: feat/social-sprint-1
-- Date: 2026-05-03
--
-- IDEMPOTENT: every CREATE/ALTER guarded with IF NOT EXISTS so migration
-- can be re-run safely. Tested locally (no destructive ops here).
--
-- ─── DEFERRED FOR USER DECISION (NOT in this migration) ────────────────────
-- 3 tables in spec conflict with existing schemas (semantic + column-name
-- mismatch). Each must be resolved by user choice (Option A/B/C in PR
-- description) before their migration can ship in a follow-up commit.
--
--   • follows         — existing is org/tournament polymorphic follows
--                       (used by useFollowData.ts), spec wants user→user
--   • comments        — existing uses ENUM target_type + `content` column
--                       (used by CommentSection.tsx, useInteractionData.ts),
--                       spec wants TEXT type + `body` column
--   • notifications   — existing uses ENUM type + `message` column
--                       (used by useNotifications.ts), spec wants TEXT
--                       type + `body` + `link_url` + `payload` JSONB
--
-- Until resolved, these features depend on those 3 tables remain blocked:
--   - User-to-user following (Sprint 3 deliverable)
--   - Comments on matches/clips/venues (Sprint 4 deliverable)
--   - Generic notification triggers (Sprint 4 deliverable)
--
-- ─── INCLUDED: 8 net-new tables + profiles ALTER ───────────────────────────
-- ============================================================================

-- ─── 3.1  PROFILES extension ────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'VN';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dominant_hand TEXT
  CHECK (dominant_hand IS NULL OR dominant_hand IN ('left', 'right', 'ambi'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_paddle TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dupr_id TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dupr_singles NUMERIC(4,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dupr_doubles NUMERIC(4,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dupr_synced_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS self_rating NUMERIC(4,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_ghost BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'vi'
  CHECK (preferred_language IS NULL OR preferred_language IN ('vi', 'en'));

CREATE INDEX IF NOT EXISTS idx_profiles_username      ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_dupr_id       ON public.profiles(dupr_id);
CREATE INDEX IF NOT EXISTS idx_profiles_city          ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_dupr_doubles  ON public.profiles(dupr_doubles DESC) WHERE dupr_doubles IS NOT NULL;

-- ─── 3.2  VENUES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.venues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  name_vi         TEXT,
  address         TEXT,
  district        TEXT,
  city            TEXT NOT NULL,
  country         TEXT DEFAULT 'VN',
  latitude        NUMERIC(10,7),
  longitude       NUMERIC(10,7),
  num_courts      INTEGER,
  surface_type    TEXT,
  is_indoor       BOOLEAN DEFAULT FALSE,
  phone           TEXT,
  website         TEXT,
  hours_json      JSONB,
  amenities       TEXT[],
  cover_image_url TEXT,
  is_verified     BOOLEAN DEFAULT FALSE,
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venues_city ON public.venues(city);
CREATE INDEX IF NOT EXISTS idx_venues_slug ON public.venues(slug);
CREATE INDEX IF NOT EXISTS idx_venues_geo  ON public.venues(latitude, longitude);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venues_public_read"     ON public.venues;
DROP POLICY IF EXISTS "venues_auth_insert"     ON public.venues;
DROP POLICY IF EXISTS "venues_creator_update"  ON public.venues;

CREATE POLICY "venues_public_read"     ON public.venues FOR SELECT USING (TRUE);
CREATE POLICY "venues_auth_insert"     ON public.venues FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "venues_creator_update"  ON public.venues FOR UPDATE USING (auth.uid() = created_by);

GRANT SELECT                          ON public.venues TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.venues TO authenticated;

-- ─── 3.3  MATCHES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.matches (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 TEXT UNIQUE NOT NULL,

  format               TEXT NOT NULL CHECK (format IN ('singles', 'doubles', 'mixed')),
  match_type           TEXT NOT NULL CHECK (match_type IN ('rec', 'open_play', 'tournament', 'league', 'practice')),

  venue_id             UUID REFERENCES public.venues(id),
  venue_name_override  TEXT,
  court_number         TEXT,

  tournament_id        UUID REFERENCES public.tournaments(id),
  tournament_round     TEXT,

  played_at            TIMESTAMPTZ NOT NULL,
  duration_minutes     INTEGER,

  team_a_score         INTEGER[] NOT NULL,
  team_b_score         INTEGER[] NOT NULL,
  winning_team         TEXT CHECK (winning_team IN ('a', 'b')),
  scoring_format       TEXT DEFAULT '11_rally'
    CHECK (scoring_format IN ('11_rally', '11_traditional', '15_rally', '21_rally')),

  verification_status  TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'disputed', 'rejected', 'expired')),
  verified_at          TIMESTAMPTZ,

  submitted_to_dupr    BOOLEAN DEFAULT FALSE,
  dupr_match_id        TEXT,
  dupr_submitted_at    TIMESTAMPTZ,

  notes                TEXT,
  weather              TEXT,
  is_public            BOOLEAN DEFAULT TRUE,
  recorded_by          UUID NOT NULL REFERENCES public.profiles(id),

  -- Fraud detection meta (silent, admin-only query)
  created_meta         JSONB,

  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_played_at    ON public.matches(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_venue        ON public.matches(venue_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament   ON public.matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_recorded_by  ON public.matches(recorded_by);
CREATE INDEX IF NOT EXISTS idx_matches_verification ON public.matches(verification_status);
CREATE INDEX IF NOT EXISTS idx_matches_slug         ON public.matches(slug);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches_public_read"   ON public.matches;
DROP POLICY IF EXISTS "matches_owner_insert"  ON public.matches;
DROP POLICY IF EXISTS "matches_owner_update"  ON public.matches;

CREATE POLICY "matches_public_read"   ON public.matches FOR SELECT USING (is_public = TRUE);
CREATE POLICY "matches_owner_insert"  ON public.matches FOR INSERT WITH CHECK (auth.uid() = recorded_by);
CREATE POLICY "matches_owner_update"  ON public.matches FOR UPDATE USING (auth.uid() = recorded_by);

GRANT SELECT                          ON public.matches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.matches TO authenticated;

-- ─── 3.4  MATCH_PARTICIPANTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.match_participants (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id                 UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id                UUID NOT NULL REFERENCES public.profiles(id),
  team                     TEXT NOT NULL CHECK (team IN ('a', 'b')),
  position                 INTEGER,

  -- DUPR rating snapshot at time of match (populated when DUPR sync runs)
  dupr_rating_before       NUMERIC(4,2),
  dupr_rating_after        NUMERIC(4,2),

  confirmed                BOOLEAN DEFAULT FALSE,
  confirmed_at             TIMESTAMPTZ,
  disputed                 BOOLEAN DEFAULT FALSE,
  dispute_reason           TEXT,

  performance_self_rating  INTEGER CHECK (performance_self_rating BETWEEN 1 AND 5),

  created_at               TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_match_participants_match       ON public.match_participants(match_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_player      ON public.match_participants(player_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_unconfirmed ON public.match_participants(player_id, confirmed) WHERE confirmed = FALSE;

ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_participants_public_read"  ON public.match_participants;
DROP POLICY IF EXISTS "match_participants_self_confirm" ON public.match_participants;

CREATE POLICY "match_participants_public_read"
  ON public.match_participants FOR SELECT USING (TRUE);
CREATE POLICY "match_participants_self_confirm"
  ON public.match_participants FOR UPDATE
  USING (auth.uid() = player_id) WITH CHECK (auth.uid() = player_id);

GRANT SELECT                          ON public.match_participants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.match_participants TO authenticated;

-- ─── 3.6  KUDOS ────────────────────────────────────────────────────────────
-- Separate from existing `likes` table (which is for forum/blog/news).
-- Kudos targets only social entities: match, clip, comment.
CREATE TABLE IF NOT EXISTS public.kudos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('match', 'clip', 'comment')),
  target_id   UUID NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_kudos_target ON public.kudos(target_type, target_id);

ALTER TABLE public.kudos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kudos_public_read" ON public.kudos;
DROP POLICY IF EXISTS "kudos_self"        ON public.kudos;

CREATE POLICY "kudos_public_read" ON public.kudos FOR SELECT USING (TRUE);
CREATE POLICY "kudos_self"        ON public.kudos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT                          ON public.kudos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.kudos TO authenticated;

-- ─── 3.8  CLIPS ────────────────────────────────────────────────────────────
-- Net-new table; separate from existing `videos` (Mux-backed editorial videos).
-- Clips are user-uploaded short highlights tied to a match.
CREATE TABLE IF NOT EXISTS public.clips (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  uploaded_by         UUID NOT NULL REFERENCES public.profiles(id),

  storage_path        TEXT NOT NULL,
  thumbnail_path      TEXT,
  duration_seconds    INTEGER,
  width               INTEGER,
  height              INTEGER,

  caption             TEXT,
  caption_vi          TEXT,

  ai_processed        BOOLEAN DEFAULT FALSE,
  ai_highlights_json  JSONB,

  view_count          INTEGER DEFAULT 0,
  is_public           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clips_match    ON public.clips(match_id);
CREATE INDEX IF NOT EXISTS idx_clips_uploader ON public.clips(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_clips_created  ON public.clips(created_at DESC) WHERE is_public = TRUE;

ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clips_public_read"  ON public.clips;
DROP POLICY IF EXISTS "clips_self_write"   ON public.clips;
DROP POLICY IF EXISTS "clips_self_update"  ON public.clips;

CREATE POLICY "clips_public_read"  ON public.clips FOR SELECT USING (is_public = TRUE);
CREATE POLICY "clips_self_write"   ON public.clips FOR INSERT WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "clips_self_update"  ON public.clips FOR UPDATE USING (auth.uid() = uploaded_by);

GRANT SELECT                          ON public.clips TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.clips TO authenticated;

-- ─── 3.9  OPEN_PLAY_SESSIONS ───────────────────────────────────────────────
-- Manual creation only. No auto-match cron in MVP (Phase 2).
CREATE TABLE IF NOT EXISTS public.open_play_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id         UUID NOT NULL REFERENCES public.venues(id),
  format           TEXT NOT NULL CHECK (format IN ('singles', 'doubles')),

  scheduled_start  TIMESTAMPTZ NOT NULL,
  scheduled_end    TIMESTAMPTZ NOT NULL,

  min_rating       NUMERIC(4,2),
  max_rating       NUMERIC(4,2),

  max_players      INTEGER NOT NULL DEFAULT 4,
  current_players  INTEGER NOT NULL DEFAULT 1,

  status           TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'full', 'locked', 'completed', 'cancelled')),

  created_by       UUID NOT NULL REFERENCES public.profiles(id),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT open_play_end_after_start CHECK (scheduled_end > scheduled_start),
  CONSTRAINT open_play_capacity        CHECK (current_players <= max_players)
);

CREATE INDEX IF NOT EXISTS idx_sessions_venue_time   ON public.open_play_sessions(venue_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_sessions_status_time  ON public.open_play_sessions(status, scheduled_start) WHERE status IN ('open', 'full');

ALTER TABLE public.open_play_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_play_public_read"     ON public.open_play_sessions;
DROP POLICY IF EXISTS "sessions_self_create"      ON public.open_play_sessions;
DROP POLICY IF EXISTS "sessions_creator_update"   ON public.open_play_sessions;

CREATE POLICY "open_play_public_read"   ON public.open_play_sessions FOR SELECT USING (TRUE);
CREATE POLICY "sessions_self_create"    ON public.open_play_sessions FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "sessions_creator_update" ON public.open_play_sessions FOR UPDATE USING (auth.uid() = created_by);

GRANT SELECT                          ON public.open_play_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.open_play_sessions TO authenticated;

-- ─── 3.10  SESSION_PARTICIPANTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_participants (
  session_id  UUID NOT NULL REFERENCES public.open_play_sessions(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'joined'
    CHECK (status IN ('joined', 'confirmed', 'declined', 'no_show')),
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, player_id)
);

ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_participants_public_read" ON public.session_participants;
DROP POLICY IF EXISTS "session_participants_self"        ON public.session_participants;

CREATE POLICY "session_participants_public_read" ON public.session_participants FOR SELECT USING (TRUE);
CREATE POLICY "session_participants_self"        ON public.session_participants FOR ALL USING (auth.uid() = player_id);

GRANT SELECT                          ON public.session_participants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.session_participants TO authenticated;

-- ─── 3.12  LEADERBOARD_SNAPSHOTS ───────────────────────────────────────────
-- Cache table populated by leaderboard-compute cron (Sprint 5).
-- Public read so SEO bot prerender can render boards without auth.
CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type    TEXT NOT NULL CHECK (scope_type IN ('global', 'country', 'city', 'venue')),
  scope_id      TEXT NOT NULL,
  period        TEXT NOT NULL CHECK (period IN ('all_time', 'monthly', 'weekly')),
  period_start  DATE,

  rankings      JSONB NOT NULL,

  generated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (scope_type, scope_id, period, period_start)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_scope ON public.leaderboard_snapshots(scope_type, scope_id, period);

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leaderboard_public_read" ON public.leaderboard_snapshots;

CREATE POLICY "leaderboard_public_read" ON public.leaderboard_snapshots FOR SELECT USING (TRUE);

GRANT SELECT  ON public.leaderboard_snapshots TO anon, authenticated;
-- INSERT only via cron (service_role); not granted to authenticated.

-- ─── Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

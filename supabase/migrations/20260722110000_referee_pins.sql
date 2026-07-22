-- referee-pin: PIN-based referee self-enrollment for the 4 /tools formats
-- (quick_table, doubles_elimination, flex_tournament, team_match).
--
-- Design per docs/proposals/referee-pin/proposal.md (Option A, D1 = retrievable):
--
--   * The PIN lives in its OWN table with NO grants to anon/authenticated.
--     Never a column on the public parent tables — the invite_code lesson
--     (20260722000000): RLS is ROW-level and cannot hide columns, and the
--     native app selects '*' on the parent tables, so a column REVOKE there
--     would 42501 installed binaries.
--   * Every read/write goes through a SECURITY DEFINER RPC:
--       set_referee_pin(format, parent)         creator-only; generates and
--                                               returns a fresh 6-digit PIN
--                                               (enable + rotate are the same op)
--       clear_referee_pin(format, parent)       creator-only; disables the PIN
--       get_referee_pin(format, parent)         creator-only reveal (empty for
--                                               everyone else); venue copy/share
--       redeem_referee_pin(format, parent, pin) any logged-in user; rate-limited,
--                                               expiry-checked, inserts the
--                                               referee row for auth.uid()
--   * Redemption is refused once the tournament is completed, for ALL 4
--     formats. status='completed' exists for every format (auto-archive cron
--     writes it for DE/Flex after 14 stale days); Doubles Elimination gets an
--     extra final_placement=1 guard to close the 0-14-day window after a
--     decided final.
--   * Referee INSERT RLS on the 4 *_referees tables stays creator-only; the
--     redeem RPC is the single sanctioned bypass and only ever inserts
--     auth.uid() (never a caller-supplied user id).

-- ─── Storage ────────────────────────────────────────────────────────────

CREATE TABLE public.referee_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  format text NOT NULL CHECK (
    format IN ('quick_table', 'doubles_elimination', 'flex_tournament', 'team_match')
  ),
  parent_id uuid NOT NULL,
  pin text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (format, parent_id)
);

COMMENT ON TABLE public.referee_pins IS
  'Join secret per tournament. No client grants on purpose — read/write only via the referee-pin RPCs (see 20260722110000).';

ALTER TABLE public.referee_pins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.referee_pins FROM PUBLIC, anon, authenticated;

-- Failed/successful redeem attempts, for rate-limiting. Login is required to
-- call redeem, so keying the budget on user_id is a global anti-spray budget
-- per account. ponytail: no cleanup job — volume is tiny (authenticated users
-- typing PINs); revisit if the table ever matters.
CREATE TABLE public.referee_pin_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  format text NOT NULL,
  parent_id uuid NOT NULL,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referee_pin_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.referee_pin_attempts FROM PUBLIC, anon, authenticated;

CREATE INDEX referee_pin_attempts_user_time_idx
  ON public.referee_pin_attempts (user_id, created_at DESC);

CREATE INDEX referee_pin_attempts_parent_time_idx
  ON public.referee_pin_attempts (format, parent_id, created_at DESC);

-- ─── Internal helpers (not client-callable) ─────────────────────────────

CREATE OR REPLACE FUNCTION public.referee_pin_is_creator(
  p_format text, p_parent_id uuid, p_user_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE p_format
    WHEN 'quick_table' THEN public.is_quick_table_creator(p_parent_id, p_user_id)
    WHEN 'doubles_elimination' THEN public.is_doubles_elimination_creator(p_parent_id, p_user_id)
    WHEN 'flex_tournament' THEN public.is_flex_tournament_creator(p_parent_id, p_user_id)
    WHEN 'team_match' THEN public.is_team_match_creator(p_parent_id, p_user_id)
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.referee_pin_is_creator(text, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- "Completed" predicate for all 4 formats. Missing parent row counts as
-- completed (fail closed). DE additionally counts a decided final.
CREATE OR REPLACE FUNCTION public.referee_pin_parent_completed(
  p_format text, p_parent_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE p_format
    WHEN 'quick_table' THEN
      COALESCE((SELECT qt.status = 'completed' FROM quick_tables qt WHERE qt.id = p_parent_id), true)
    WHEN 'team_match' THEN
      COALESCE((SELECT tm.status = 'completed' FROM team_match_tournaments tm WHERE tm.id = p_parent_id), true)
    WHEN 'flex_tournament' THEN
      COALESCE((SELECT ft.status = 'completed' FROM flex_tournaments ft WHERE ft.id = p_parent_id), true)
    WHEN 'doubles_elimination' THEN
      COALESCE((SELECT de.status = 'completed' FROM doubles_elimination_tournaments de WHERE de.id = p_parent_id), true)
      OR EXISTS (
        SELECT 1 FROM doubles_elimination_teams det
        WHERE det.tournament_id = p_parent_id AND det.final_placement = 1
      )
    ELSE true
  END;
$$;

REVOKE ALL ON FUNCTION public.referee_pin_parent_completed(text, uuid) FROM PUBLIC, anon, authenticated;

-- ─── Organizer RPCs ─────────────────────────────────────────────────────

-- Enable or rotate: always generates a fresh random 6-digit PIN and returns it.
CREATE OR REPLACE FUNCTION public.set_referee_pin(p_format text, p_parent_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pin text;
  v_bytes bytea;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF NOT public.referee_pin_is_creator(p_format, p_parent_id, v_uid) THEN
    RAISE EXCEPTION 'NOT_CREATOR';
  END IF;

  LOOP
    -- 3 bytes of pgcrypto entropy → uniform enough over 10^6 for a code whose
    -- real defence is the redeem rate-limit, not keyspace size. Schema-qualified
    -- because the function pins search_path=public and pgcrypto lives in
    -- `extensions` on Supabase.
    v_bytes := extensions.gen_random_bytes(3);
    v_pin := lpad(
      (
        (
          get_byte(v_bytes, 0) * 65536
          + get_byte(v_bytes, 1) * 256
          + get_byte(v_bytes, 2)
        ) % 1000000
      )::text,
      6, '0'
    );
    EXIT WHEN v_pin NOT IN (
      '000000','111111','222222','333333','444444','555555',
      '666666','777777','888888','999999','123456','654321'
    );
  END LOOP;

  INSERT INTO referee_pins (format, parent_id, pin, is_active, created_by)
  VALUES (p_format, p_parent_id, v_pin, true, v_uid)
  ON CONFLICT (format, parent_id) DO UPDATE
    SET pin = EXCLUDED.pin,
        is_active = true,
        created_by = EXCLUDED.created_by,
        updated_at = now();

  RETURN v_pin;
END;
$$;

REVOKE ALL ON FUNCTION public.set_referee_pin(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_referee_pin(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_referee_pin(p_format text, p_parent_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF NOT public.referee_pin_is_creator(p_format, p_parent_id, v_uid) THEN
    RAISE EXCEPTION 'NOT_CREATOR';
  END IF;

  UPDATE referee_pins
     SET is_active = false, updated_at = now()
   WHERE format = p_format AND parent_id = p_parent_id;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_referee_pin(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_referee_pin(text, uuid) TO authenticated;

-- Creator-only reveal; empty result for everyone else (no error — the UI only
-- calls this on manage surfaces, but a stray call must not leak anything).
CREATE OR REPLACE FUNCTION public.get_referee_pin(p_format text, p_parent_id uuid)
RETURNS TABLE (pin text, is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rp.pin, rp.is_active
  FROM referee_pins rp
  WHERE rp.format = p_format
    AND rp.parent_id = p_parent_id
    AND public.referee_pin_is_creator(p_format, p_parent_id, auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_referee_pin(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_referee_pin(text, uuid) TO authenticated;

-- ─── Redeem ─────────────────────────────────────────────────────────────

-- Returns a status string the client maps to copy:
--   ok | already_referee | invalid | expired | rate_limited
-- Atomic: the pin row is locked FOR UPDATE, so a concurrent clear/rotate and a
-- redeem serialize instead of racing (risk-auditor #5).
CREATE OR REPLACE FUNCTION public.redeem_referee_pin(
  p_format text, p_parent_id uuid, p_pin text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row referee_pins%ROWTYPE;
  v_fails int;
  v_already boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  -- Two independent wrong-guess budgets over a 15-minute window:
  --   * per account (10): stops one user brute-forcing.
  --   * per tournament (20, across ALL users): caps the total guess rate on a
  --     single tournament so throwaway accounts can't parallelise the grind —
  --     ~1920 guesses/day against a ~10^6 space regardless of account count.
  -- Correct PINs succeed and are never counted, so a legit referee is not
  -- locked out by someone else spraying wrong guesses.
  SELECT count(*) INTO v_fails
  FROM referee_pin_attempts
  WHERE user_id = v_uid
    AND success = false
    AND created_at > now() - interval '15 minutes';
  IF v_fails >= 10 THEN
    RETURN 'rate_limited';
  END IF;

  SELECT count(*) INTO v_fails
  FROM referee_pin_attempts
  WHERE format = p_format AND parent_id = p_parent_id
    AND success = false
    AND created_at > now() - interval '15 minutes';
  IF v_fails >= 20 THEN
    RETURN 'rate_limited';
  END IF;

  SELECT * INTO v_row
  FROM referee_pins
  WHERE format = p_format AND parent_id = p_parent_id
  FOR UPDATE;

  IF v_row.id IS NULL OR NOT v_row.is_active OR v_row.pin IS DISTINCT FROM p_pin THEN
    INSERT INTO referee_pin_attempts (user_id, format, parent_id, success)
    VALUES (v_uid, p_format, p_parent_id, false);
    RETURN 'invalid';
  END IF;

  IF public.referee_pin_parent_completed(p_format, p_parent_id) THEN
    RETURN 'expired';
  END IF;

  CASE p_format
    WHEN 'quick_table' THEN
      SELECT EXISTS (
        SELECT 1 FROM quick_table_referees WHERE table_id = p_parent_id AND user_id = v_uid
      ) INTO v_already;
      IF NOT v_already THEN
        INSERT INTO quick_table_referees (table_id, user_id) VALUES (p_parent_id, v_uid);
      END IF;
    WHEN 'doubles_elimination' THEN
      SELECT EXISTS (
        SELECT 1 FROM doubles_elimination_referees WHERE tournament_id = p_parent_id AND user_id = v_uid
      ) INTO v_already;
      IF NOT v_already THEN
        INSERT INTO doubles_elimination_referees (tournament_id, user_id) VALUES (p_parent_id, v_uid);
      END IF;
    WHEN 'flex_tournament' THEN
      SELECT EXISTS (
        SELECT 1 FROM flex_tournament_referees WHERE tournament_id = p_parent_id AND user_id = v_uid
      ) INTO v_already;
      IF NOT v_already THEN
        INSERT INTO flex_tournament_referees (tournament_id, user_id) VALUES (p_parent_id, v_uid);
      END IF;
    WHEN 'team_match' THEN
      SELECT EXISTS (
        SELECT 1 FROM team_match_referees WHERE tournament_id = p_parent_id AND user_id = v_uid
      ) INTO v_already;
      IF NOT v_already THEN
        INSERT INTO team_match_referees (tournament_id, user_id) VALUES (p_parent_id, v_uid);
      END IF;
    ELSE
      RETURN 'invalid';
  END CASE;

  IF v_already THEN
    RETURN 'already_referee';
  END IF;

  INSERT INTO referee_pin_attempts (user_id, format, parent_id, success)
  VALUES (v_uid, p_format, p_parent_id, true);

  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_referee_pin(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_referee_pin(text, uuid, text) TO authenticated;

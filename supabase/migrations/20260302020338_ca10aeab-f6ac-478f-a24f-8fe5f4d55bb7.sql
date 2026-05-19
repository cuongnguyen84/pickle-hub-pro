
-- Phase 1: Audit Log — Add before/after columns, expand constraints, score tracking triggers

-- 1. Add before_data and after_data columns
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS before_data jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS after_data jsonb DEFAULT NULL;

-- 2. Drop and recreate CHECK constraints to expand allowed values
-- severity: add 'security'
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_severity_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_severity_check
  CHECK (severity IN ('info', 'warning', 'critical', 'security'));

-- event_category: add 'match', 'player'
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_event_category_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_event_category_check
  CHECK (event_category IN ('auth', 'stream', 'tournament', 'admin', 'match', 'player'));

-- resource_type: add 'match', 'game', 'player'
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_resource_type_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_resource_type_check
  CHECK (resource_type IS NULL OR resource_type IN (
    'livestream', 'video', 'tournament', 'organization', 'user', 'api_key',
    'forum_post', 'quick_table', 'doubles_elimination', 'flex_tournament', 'team_match',
    'match', 'game', 'player'
  ));

-- 3. Update log_audit_event() function to accept before/after data
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _event_type text,
  _event_category text,
  _resource_type text DEFAULT NULL,
  _resource_id text DEFAULT NULL,
  _severity text DEFAULT 'info',
  _metadata jsonb DEFAULT '{}'::jsonb,
  _before_data jsonb DEFAULT NULL,
  _after_data jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    actor_id, actor_type, event_type, event_category,
    resource_type, resource_id, severity, metadata,
    before_data, after_data
  ) VALUES (
    auth.uid(), 'user', _event_type, _event_category,
    _resource_type, _resource_id, _severity, _metadata,
    _before_data, _after_data
  );
END;
$$;

-- 4. Score tracking trigger for quick_table_matches
CREATE OR REPLACE FUNCTION public.audit_quick_table_match_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log score updates
  IF (OLD.score1 IS DISTINCT FROM NEW.score1) OR (OLD.score2 IS DISTINCT FROM NEW.score2) THEN
    INSERT INTO public.audit_logs (
      actor_id, actor_type, event_type, event_category,
      resource_type, resource_id, severity, metadata,
      before_data, after_data
    ) VALUES (
      auth.uid(), 'user', 'MATCH_SCORE_UPDATED', 'match',
      'match', NEW.id::text, 'warning',
      jsonb_build_object('table_id', NEW.table_id, 'match_type', 'quick_table'),
      jsonb_build_object('score1', OLD.score1, 'score2', OLD.score2, 'winner_id', OLD.winner_id, 'status', OLD.status),
      jsonb_build_object('score1', NEW.score1, 'score2', NEW.score2, 'winner_id', NEW.winner_id, 'status', NEW.status)
    );
  END IF;

  -- Log match completion
  IF (OLD.winner_id IS NULL AND NEW.winner_id IS NOT NULL) THEN
    INSERT INTO public.audit_logs (
      actor_id, actor_type, event_type, event_category,
      resource_type, resource_id, severity, metadata,
      before_data, after_data
    ) VALUES (
      auth.uid(), 'user', 'MATCH_COMPLETED', 'match',
      'match', NEW.id::text, 'info',
      jsonb_build_object('table_id', NEW.table_id, 'match_type', 'quick_table', 'winner_id', NEW.winner_id),
      NULL,
      jsonb_build_object('score1', NEW.score1, 'score2', NEW.score2, 'winner_id', NEW.winner_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_quick_table_match_score ON public.quick_table_matches;
CREATE TRIGGER trg_audit_quick_table_match_score
  AFTER UPDATE ON public.quick_table_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_quick_table_match_score();

-- 5. Score tracking trigger for doubles_elimination_matches
CREATE OR REPLACE FUNCTION public.audit_doubles_match_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.score_a IS DISTINCT FROM NEW.score_a) OR (OLD.score_b IS DISTINCT FROM NEW.score_b)
     OR (OLD.games_won_a IS DISTINCT FROM NEW.games_won_a) OR (OLD.games_won_b IS DISTINCT FROM NEW.games_won_b) THEN
    INSERT INTO public.audit_logs (
      actor_id, actor_type, event_type, event_category,
      resource_type, resource_id, severity, metadata,
      before_data, after_data
    ) VALUES (
      auth.uid(), 'user', 'MATCH_SCORE_UPDATED', 'match',
      'match', NEW.id::text, 'warning',
      jsonb_build_object('tournament_id', NEW.tournament_id, 'match_type', 'doubles_elimination', 'match_number', NEW.match_number),
      jsonb_build_object('score_a', OLD.score_a, 'score_b', OLD.score_b, 'games_won_a', OLD.games_won_a, 'games_won_b', OLD.games_won_b, 'winner_id', OLD.winner_id, 'status', OLD.status),
      jsonb_build_object('score_a', NEW.score_a, 'score_b', NEW.score_b, 'games_won_a', NEW.games_won_a, 'games_won_b', NEW.games_won_b, 'winner_id', NEW.winner_id, 'status', NEW.status)
    );
  END IF;

  IF (OLD.winner_id IS NULL AND NEW.winner_id IS NOT NULL) THEN
    INSERT INTO public.audit_logs (
      actor_id, actor_type, event_type, event_category,
      resource_type, resource_id, severity, metadata,
      before_data, after_data
    ) VALUES (
      auth.uid(), 'user', 'MATCH_COMPLETED', 'match',
      'match', NEW.id::text, 'info',
      jsonb_build_object('tournament_id', NEW.tournament_id, 'match_type', 'doubles_elimination', 'winner_id', NEW.winner_id),
      NULL,
      jsonb_build_object('score_a', NEW.score_a, 'score_b', NEW.score_b, 'winner_id', NEW.winner_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_doubles_match_score ON public.doubles_elimination_matches;
CREATE TRIGGER trg_audit_doubles_match_score
  AFTER UPDATE ON public.doubles_elimination_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_doubles_match_score();

-- 6. Score tracking trigger for team_match_games
CREATE OR REPLACE FUNCTION public.audit_team_match_game_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.score_a IS DISTINCT FROM NEW.score_a) OR (OLD.score_b IS DISTINCT FROM NEW.score_b) THEN
    INSERT INTO public.audit_logs (
      actor_id, actor_type, event_type, event_category,
      resource_type, resource_id, severity, metadata,
      before_data, after_data
    ) VALUES (
      auth.uid(), 'user', 'MATCH_SCORE_UPDATED', 'match',
      'game', NEW.id::text, 'warning',
      jsonb_build_object('match_id', NEW.match_id, 'match_type', 'team_match', 'game_type', NEW.game_type),
      jsonb_build_object('score_a', OLD.score_a, 'score_b', OLD.score_b, 'winner_team_id', OLD.winner_team_id, 'status', OLD.status),
      jsonb_build_object('score_a', NEW.score_a, 'score_b', NEW.score_b, 'winner_team_id', NEW.winner_team_id, 'status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_team_match_game_score ON public.team_match_games;
CREATE TRIGGER trg_audit_team_match_game_score
  AFTER UPDATE ON public.team_match_games
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_team_match_game_score();

-- 7. Score tracking trigger for flex_matches
CREATE OR REPLACE FUNCTION public.audit_flex_match_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.score_a IS DISTINCT FROM NEW.score_a) OR (OLD.score_b IS DISTINCT FROM NEW.score_b) THEN
    INSERT INTO public.audit_logs (
      actor_id, actor_type, event_type, event_category,
      resource_type, resource_id, severity, metadata,
      before_data, after_data
    ) VALUES (
      auth.uid(), 'user', 'MATCH_SCORE_UPDATED', 'match',
      'match', NEW.id::text, 'warning',
      jsonb_build_object('tournament_id', NEW.tournament_id, 'match_type', 'flex', 'match_name', NEW.name),
      jsonb_build_object('score_a', OLD.score_a, 'score_b', OLD.score_b, 'winner_side', OLD.winner_side),
      jsonb_build_object('score_a', NEW.score_a, 'score_b', NEW.score_b, 'winner_side', NEW.winner_side)
    );
  END IF;

  IF (OLD.winner_side IS NULL AND NEW.winner_side IS NOT NULL) THEN
    INSERT INTO public.audit_logs (
      actor_id, actor_type, event_type, event_category,
      resource_type, resource_id, severity, metadata,
      before_data, after_data
    ) VALUES (
      auth.uid(), 'user', 'MATCH_COMPLETED', 'match',
      'match', NEW.id::text, 'info',
      jsonb_build_object('tournament_id', NEW.tournament_id, 'match_type', 'flex', 'winner_side', NEW.winner_side),
      NULL,
      jsonb_build_object('score_a', NEW.score_a, 'score_b', NEW.score_b, 'winner_side', NEW.winner_side)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_flex_match_score ON public.flex_matches;
CREATE TRIGGER trg_audit_flex_match_score
  AFTER UPDATE ON public.flex_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_flex_match_score();

-- 8. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_category ON public.audit_logs (event_category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs (severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON public.audit_logs (resource_id);

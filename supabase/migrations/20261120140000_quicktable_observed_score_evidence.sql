-- First qualifying score write OBSERVED after rollout, not first-ever use or intent.
-- No historical backfill; only real completed, non-tied, nonnegative score pairs.
CREATE TABLE public.quick_table_score_evidence (
  table_id uuid PRIMARY KEY REFERENCES public.quick_tables(id) ON DELETE CASCADE,
  receipt_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.quick_table_score_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quick_table_score_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.quick_table_score_evidence TO service_role;
COMMENT ON TABLE public.quick_table_score_evidence IS
  'Internal first qualifying score write observed after rollout. Not first-ever activation, event intent, payment or analytics delivery. Deleted with tournament.';
CREATE FUNCTION public.capture_quick_table_score_evidence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.score1 IS NOT NULL AND NEW.score2 IS NOT NULL
     AND NEW.score1 >= 0 AND NEW.score2 >= 0 AND NEW.score1 <> NEW.score2
     AND NEW.player1_id IS NOT NULL AND NEW.player2_id IS NOT NULL THEN
    IF TG_OP = 'UPDATE' THEN
      IF OLD.status IS NOT DISTINCT FROM NEW.status
         AND OLD.score1 IS NOT DISTINCT FROM NEW.score1
         AND OLD.score2 IS NOT DISTINCT FROM NEW.score2 THEN
        RETURN NEW;
      END IF;
    END IF;
    INSERT INTO public.quick_table_score_evidence(table_id)
    VALUES (NEW.table_id) ON CONFLICT(table_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_quick_table_score_evidence() FROM PUBLIC;
CREATE TRIGGER capture_quick_table_score_evidence
AFTER INSERT OR UPDATE OF status,score1,score2 ON public.quick_table_matches
FOR EACH ROW EXECUTE FUNCTION public.capture_quick_table_score_evidence();

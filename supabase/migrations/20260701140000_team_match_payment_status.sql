-- Per-team payment status for MLP team registration fee.
--   unpaid    → chưa nộp
--   claimed   → đội trưởng bấm "Đã chuyển khoản" (đỏ, chờ BTC xác nhận)
--   confirmed → BTC xác nhận đã nhận (xanh, đội chính thức)
ALTER TABLE public.team_match_teams
  ADD COLUMN IF NOT EXISTS payment_status       TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_claimed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;

ALTER TABLE public.team_match_teams
  DROP CONSTRAINT IF EXISTS team_match_teams_payment_status_check;
ALTER TABLE public.team_match_teams
  ADD CONSTRAINT team_match_teams_payment_status_check
  CHECK (payment_status IN ('unpaid', 'claimed', 'confirmed'));

-- Captain marks own team as transferred. Cannot downgrade a confirmed team.
CREATE OR REPLACE FUNCTION public.claim_team_payment(p_team_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.team_match_teams
     SET payment_status = 'claimed', payment_claimed_at = now()
   WHERE id = p_team_id
     AND captain_user_id = auth.uid()
     AND payment_status <> 'confirmed';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_CAPTAIN_OR_ALREADY_CONFIRMED';
  END IF;
END;
$$;

-- Tournament organizer confirms (or un-confirms) receipt.
CREATE OR REPLACE FUNCTION public.confirm_team_payment(p_team_id uuid, p_confirmed boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_creator uuid;
BEGIN
  SELECT t.created_by INTO v_creator
    FROM public.team_match_teams tm
    JOIN public.team_match_tournaments t ON t.id = tm.tournament_id
   WHERE tm.id = p_team_id;
  IF v_creator IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'NOT_ORGANIZER';
  END IF;
  UPDATE public.team_match_teams
     SET payment_status       = CASE WHEN p_confirmed THEN 'confirmed' ELSE 'claimed' END,
         payment_confirmed_at = CASE WHEN p_confirmed THEN now() ELSE NULL END
   WHERE id = p_team_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_team_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_team_payment(uuid, boolean) TO authenticated;

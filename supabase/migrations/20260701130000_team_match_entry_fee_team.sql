-- Per-team entry fee (đội), alongside the existing per-athlete entry_fee_vnd (VĐV).
ALTER TABLE public.team_match_tournaments
  ADD COLUMN IF NOT EXISTS entry_fee_team_vnd INTEGER;

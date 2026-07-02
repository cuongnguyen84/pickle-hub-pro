-- Team Match (MLP) wizard: organizer rules summary + entry fee + bank account
-- for a VietQR the athletes scan to pay. All nullable; free tournaments leave
-- fee NULL/0 and the bank trio empty. QR itself is rendered client-side from
-- these fields via img.vietqr.io — nothing QR-specific stored here.
ALTER TABLE public.team_match_tournaments
  ADD COLUMN IF NOT EXISTS rules_summary       TEXT,
  ADD COLUMN IF NOT EXISTS entry_fee_vnd        INTEGER,
  ADD COLUMN IF NOT EXISTS bank_code            TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number  TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name    TEXT;

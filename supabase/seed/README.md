# Bet #1 Social Layer — Test Data Seed

> ⚠ **DO NOT RUN THESE SCRIPTS AGAINST PRODUCTION**
> Production Supabase project ref: `ajvlcamxemgbxduhiqrl`
> Both `social-test-data.sql` and `reset-social-test-data.sql` contain a
> hard guard that aborts immediately if executed against that project,
> but the safer practice is to never paste them into the production SQL
> editor at all.

## What's in this folder

| File | Purpose |
|---|---|
| `social-test-data.sql` | Idempotent seed: 10 users, 5 venues, 20 matches (with all 4 verification states), participants, follows, kudos, comments, clips, open-play sessions, notifications |
| `reset-social-test-data.sql` | Removes everything the seed inserted (matched by `-test` username + `test-` venue slug + `@thepicklehub.test` auth email) |
| `README.md` | This file |

## Prerequisites — apply order

The seed assumes both Sprint 1 migrations are already applied to the target environment:

1. `supabase/migrations/20260503131017_bet1_social_layer.sql` — base 8 social tables
2. `supabase/migrations/20260503140000_social_optionA_tables.sql` — `social_follows`, `social_comments`, `social_notifications`
3. `supabase/seed/social-test-data.sql` — this seed

## Where to run

### Option 1 — Supabase preview branch (recommended)

1. Open the Supabase Dashboard → your project → **Branches** → **Create branch**.
2. Wait for the preview branch to provision; copy its **Connection string** (`postgresql://...`).
3. Apply migrations to the preview branch:
   ```bash
   psql "postgresql://postgres:<branch_password>@db.<branch_ref>.supabase.co:5432/postgres" \
     -f supabase/migrations/20260503131017_bet1_social_layer.sql
   psql "postgresql://...same..." \
     -f supabase/migrations/20260503140000_social_optionA_tables.sql
   ```
4. Run the seed:
   ```bash
   psql "postgresql://...same..." \
     -f supabase/seed/social-test-data.sql
   ```

### Option 2 — Local Supabase

```bash
# from repo root, requires Docker running
supabase start                  # boots local stack
supabase db reset               # applies all migrations cleanly
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" \
  -f supabase/seed/social-test-data.sql
```

`supabase status` will print `DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres` — paste that string into the verification SQL session in the dashboard SQL editor at `http://127.0.0.1:54323`.

## Reset (re-seed cleanly)

```bash
psql "$YOUR_BRANCH_OR_LOCAL_URL" -f supabase/seed/reset-social-test-data.sql
psql "$YOUR_BRANCH_OR_LOCAL_URL" -f supabase/seed/social-test-data.sql
```

The seed script also begins with the same DELETE block, so re-running it without an explicit reset is also safe.

## Test users

All 10 users share the same password: `TestPass123!`

| # | Email                                  | Username           | Display name        | City      | DUPR doubles | Notes |
|---|----------------------------------------|--------------------|---------------------|-----------|--------------|-------|
| 1 | nguyenvana-test@thepicklehub.test      | `nguyenvana-test`  | Nguyễn Văn An       | Hà Nội    | 4.20         | verified, primary login for manual test |
| 2 | tranthib-test@thepicklehub.test        | `tranthib-test`    | Trần Thị Bình       | Hà Nội    | 3.80         |       |
| 3 | lyhoangnam-test@thepicklehub.test      | `lyhoangnam-test`  | Lý Hoàng Nam        | HCMC      | 4.50         | pro, verified |
| 4 | phamquang-test@thepicklehub.test       | `phamquang-test`   | Phạm Quang Đức      | HCMC      | 3.50         |       |
| 5 | dohung-test@thepicklehub.test          | `dohung-test`      | Đỗ Hùng Mạnh        | Đà Nẵng   | 4.00         |       |
| 6 | lecam-test@thepicklehub.test           | `lecam-test`       | Lê Cẩm Tú           | Hà Nội    | — (3.0 self) | no DUPR |
| 7 | vothanh-test@thepicklehub.test         | `vothanh-test`     | Võ Thành Long       | HCMC      | — (3.5 self) | no DUPR |
| 8 | dinhmai-test@thepicklehub.test         | `dinhmai-test`     | Đinh Mai Linh       | HCMC      | — (4.0 self) | no DUPR |
| 9 | ghost1-test@thepicklehub.test          | `khachphuc-test`   | Khách Phúc          | Hà Nội    | —            | `is_ghost=true` |
| 10 | ghost2-test@thepicklehub.test         | `khachminh-test`   | Khách Minh          | Đà Nẵng   | —            | `is_ghost=true` |

**Primary login for manual UI test:** `nguyenvana-test@thepicklehub.test` / `TestPass123!`

## What's seeded

| Entity | Count | Notes |
|---|---:|---|
| profiles | 10 | 5 with DUPR, 3 self-rated only, 2 ghost |
| venues   | 5  | Hà Nội ×2, HCMC ×2, Đà Nẵng ×1; one verified |
| matches  | 20 | 10 verified, 5 pending (incl. 1 critical edge case), 3 disputed, 2 expired |
| match_participants | 60 | doubles ×4, singles ×2, mixed ×4; 5 carry DUPR rating snapshots |
| social_follows | 30 | All user→user; no self-follow |
| kudos | 25 | 20 match + 3 clip + 2 comment |
| social_comments | 15 | 10 match + 3 venue + 2 profile; 3 nested replies; 1 soft-deleted |
| clips | 8 | 5 attached to matches, 3 standalone, 1 private |
| open_play_sessions | 5 | 3 open, 1 full, 1 completed |
| session_participants | 12 | mix joined/confirmed/declined/no_show |
| social_notifications | 5 | for user 1; 3 unread, 2 read |

### Critical match for verification rule sanity test

Match `a2222222-0005-4002-8002-000000000005` is the **edge-case pending match**:

- creator (user 1) on team A — `confirmed = TRUE`
- teammate (user 2) on team A — `confirmed = TRUE`
- opponent (user 3) on team B — `confirmed = FALSE`
- opponent (user 4) on team B — `confirmed = FALSE`

Both team-A players have confirmed (50% of participants), but **zero opponents** have. Per the spec verification rule (≥1 OPPONENT TEAM member must confirm), this match's `verification_status` MUST stay `pending`. Sprint 2 `match-confirm` function logic must produce this outcome.

## Verification checklist (run after seed)

```sql
-- 1. Counts
SELECT 'profiles'             AS t, COUNT(*) FROM profiles WHERE username LIKE '%-test'
UNION ALL SELECT 'venues',             COUNT(*) FROM venues WHERE slug LIKE 'test-%'
UNION ALL SELECT 'matches',            COUNT(*) FROM matches
UNION ALL SELECT 'match_participants', COUNT(*) FROM match_participants
UNION ALL SELECT 'social_follows',     COUNT(*) FROM social_follows
UNION ALL SELECT 'kudos',              COUNT(*) FROM kudos
UNION ALL SELECT 'social_comments',    COUNT(*) FROM social_comments
UNION ALL SELECT 'clips',              COUNT(*) FROM clips
UNION ALL SELECT 'open_play_sessions', COUNT(*) FROM open_play_sessions
UNION ALL SELECT 'session_participants', COUNT(*) FROM session_participants
UNION ALL SELECT 'social_notifications', COUNT(*) FROM social_notifications;

-- 2. Match state distribution (expect 10/5/3/2)
SELECT verification_status, COUNT(*) FROM matches GROUP BY verification_status ORDER BY 1;

-- 3. Verification edge-case sanity
SELECT
  m.id,
  m.verification_status,
  (SELECT COUNT(*) FROM match_participants mp
    WHERE mp.match_id = m.id AND mp.confirmed = TRUE
      AND mp.team = (SELECT team FROM match_participants
                     WHERE match_id = m.id AND player_id = m.recorded_by)
  ) AS creator_team_confirmed,
  (SELECT COUNT(*) FROM match_participants mp
    WHERE mp.match_id = m.id AND mp.confirmed = TRUE
      AND mp.team != (SELECT team FROM match_participants
                      WHERE match_id = m.id AND player_id = m.recorded_by)
  ) AS opponent_team_confirmed
FROM matches m
WHERE m.verification_status = 'pending'
ORDER BY creator_team_confirmed DESC;
-- Expect: at least one row has creator_team_confirmed >= 2 AND opponent_team_confirmed = 0

-- 4. RLS test
SET ROLE anon;
SELECT COUNT(*) FROM matches WHERE is_public = TRUE;   -- expect: 20
SELECT COUNT(*) FROM matches WHERE is_public = FALSE;  -- expect: 0
RESET ROLE;

-- 5. Existing tables untouched (Option A choice)
SELECT 'follows'              AS t, COUNT(*) FROM follows
UNION ALL SELECT 'social_follows',     COUNT(*) FROM social_follows
UNION ALL SELECT 'comments',           COUNT(*) FROM comments
UNION ALL SELECT 'social_comments',    COUNT(*) FROM social_comments
UNION ALL SELECT 'notifications',      COUNT(*) FROM notifications
UNION ALL SELECT 'social_notifications', COUNT(*) FROM social_notifications;
```

## Score-validation unit tests

The `validateScores` function in `src/lib/social/score-validation.ts` covers the rules the seed exercises (11 rally win-by-2, 3-game match, format mix). Sprint 2 will add a Vitest spec at `src/lib/social/__tests__/score-validation.test.ts` once the test runner is wired into `npm run test`.

## Not committed to git

This README, the seed script, and the reset script ARE committed (they're tools).
The actual rows the seed inserts ARE NOT — they live only in the preview/local environment where you run the SQL.

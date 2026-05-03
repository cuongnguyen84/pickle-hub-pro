-- ============================================================================
-- Bet #1 Social Layer — Test Data Seed (idempotent)
-- ============================================================================
-- ⚠ DO NOT RUN ON PRODUCTION (project ajvlcamxemgbxduhiqrl).
-- Intended environments:
--   • Supabase preview branch
--   • Local Supabase via `supabase start`
--
-- Hard guard: aborts immediately if executed against the prod project.
-- Soft guard: every inserted row carries a "-test" suffix in the username,
-- venue slug starts with "test-", clip storage_path starts with "test/", so
-- reset-social-test-data.sql can clean up unambiguously.
--
-- Apply order:
--   1. supabase/migrations/20260503131017_bet1_social_layer.sql       (Sprint 1)
--   2. supabase/migrations/20260503140000_social_optionA_tables.sql   (Option A)
--   3. THIS FILE
--
-- The script is idempotent — re-running it deletes the existing test
-- payload first via the same -test naming convention, then inserts fresh.
-- ============================================================================

-- ─── 0. ENVIRONMENT GUARD  (refuses to run on prod) ────────────────────────
DO $$
DECLARE
  v_db_name TEXT;
  v_url     TEXT := COALESCE(current_setting('app.supabase_url', true), '');
BEGIN
  SELECT current_database() INTO v_db_name;
  -- Production project ref is the Supabase API hostname prefix
  -- "ajvlcamxemgbxduhiqrl"; we also check the database name pattern in
  -- case the SQL is run via psql against the prod connection string.
  IF v_url ILIKE '%ajvlcamxemgbxduhiqrl%' THEN
    RAISE EXCEPTION 'REFUSED: this seed file must not run against the production Supabase project (ajvlcamxemgbxduhiqrl). Set up a preview branch or use local Supabase.';
  END IF;
  RAISE NOTICE 'Seeding social test data into database: %', v_db_name;
END $$;

-- pgcrypto for crypt() bcrypt hashing of test user passwords.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── 1. CLEAN PRIOR TEST DATA  (idempotent re-seed) ────────────────────────
-- Order: respect FK dependencies (children first).
DELETE FROM public.social_notifications WHERE user_id IN (
  SELECT id FROM public.profiles WHERE username LIKE '%-test'
);
DELETE FROM public.session_participants WHERE session_id IN (
  SELECT id FROM public.open_play_sessions WHERE created_by IN (
    SELECT id FROM public.profiles WHERE username LIKE '%-test'
  )
);
DELETE FROM public.open_play_sessions WHERE created_by IN (
  SELECT id FROM public.profiles WHERE username LIKE '%-test'
);
DELETE FROM public.clips WHERE uploaded_by IN (
  SELECT id FROM public.profiles WHERE username LIKE '%-test'
);
DELETE FROM public.social_comments WHERE user_id IN (
  SELECT id FROM public.profiles WHERE username LIKE '%-test'
);
DELETE FROM public.kudos WHERE user_id IN (
  SELECT id FROM public.profiles WHERE username LIKE '%-test'
);
DELETE FROM public.social_follows WHERE follower_id IN (
  SELECT id FROM public.profiles WHERE username LIKE '%-test'
);
DELETE FROM public.match_participants WHERE match_id IN (
  SELECT id FROM public.matches WHERE recorded_by IN (
    SELECT id FROM public.profiles WHERE username LIKE '%-test'
  )
);
DELETE FROM public.matches WHERE recorded_by IN (
  SELECT id FROM public.profiles WHERE username LIKE '%-test'
);
DELETE FROM public.venues WHERE slug LIKE 'test-%';
DELETE FROM public.profiles WHERE username LIKE '%-test';
DELETE FROM auth.users WHERE email LIKE '%@thepicklehub.test';

-- ─── 2. AUTH USERS  (10 fixed UUIDs, password "TestPass123!" for all) ─────
-- Inserts into auth.users so profile FK to auth.users(id) is satisfied.
-- Bcrypt hash via pgcrypto's crypt() with bf salt.
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  aud, role, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
VALUES
  ('11111111-1111-4111-8111-111111111111'::UUID, '00000000-0000-0000-0000-000000000000', 'nguyenvana-test@thepicklehub.test', crypt('TestPass123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB, 'authenticated', 'authenticated', NOW(), NOW(), '', '', '', ''),
  ('22222222-2222-4222-8222-222222222222'::UUID, '00000000-0000-0000-0000-000000000000', 'tranthib-test@thepicklehub.test',  crypt('TestPass123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB, 'authenticated', 'authenticated', NOW(), NOW(), '', '', '', ''),
  ('33333333-3333-4333-8333-333333333333'::UUID, '00000000-0000-0000-0000-000000000000', 'lyhoangnam-test@thepicklehub.test', crypt('TestPass123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB, 'authenticated', 'authenticated', NOW(), NOW(), '', '', '', ''),
  ('44444444-4444-4444-8444-444444444444'::UUID, '00000000-0000-0000-0000-000000000000', 'phamquang-test@thepicklehub.test',  crypt('TestPass123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB, 'authenticated', 'authenticated', NOW(), NOW(), '', '', '', ''),
  ('55555555-5555-4555-8555-555555555555'::UUID, '00000000-0000-0000-0000-000000000000', 'dohung-test@thepicklehub.test',     crypt('TestPass123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB, 'authenticated', 'authenticated', NOW(), NOW(), '', '', '', ''),
  ('66666666-6666-4666-8666-666666666666'::UUID, '00000000-0000-0000-0000-000000000000', 'lecam-test@thepicklehub.test',      crypt('TestPass123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB, 'authenticated', 'authenticated', NOW(), NOW(), '', '', '', ''),
  ('77777777-7777-4777-8777-777777777777'::UUID, '00000000-0000-0000-0000-000000000000', 'vothanh-test@thepicklehub.test',    crypt('TestPass123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB, 'authenticated', 'authenticated', NOW(), NOW(), '', '', '', ''),
  ('88888888-8888-4888-8888-888888888888'::UUID, '00000000-0000-0000-0000-000000000000', 'dinhmai-test@thepicklehub.test',    crypt('TestPass123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB, 'authenticated', 'authenticated', NOW(), NOW(), '', '', '', ''),
  ('99999999-9999-4999-8999-999999999999'::UUID, '00000000-0000-0000-0000-000000000000', 'ghost1-test@thepicklehub.test',     crypt('TestPass123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB, 'authenticated', 'authenticated', NOW(), NOW(), '', '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::UUID, '00000000-0000-0000-0000-000000000000', 'ghost2-test@thepicklehub.test',     crypt('TestPass123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB, 'authenticated', 'authenticated', NOW(), NOW(), '', '', '', '');

-- ─── 3. PROFILES  (10 users, mix of DUPR/non-DUPR/ghost) ──────────────────
INSERT INTO public.profiles (
  id, email, username, display_name, avatar_url, bio, city, country,
  dominant_hand, dupr_id, dupr_singles, dupr_doubles, dupr_synced_at,
  self_rating, is_pro, is_verified, is_ghost, preferred_language
)
VALUES
  -- 1-5: with DUPR
  ('11111111-1111-4111-8111-111111111111', 'nguyenvana-test@thepicklehub.test', 'nguyenvana-test', 'Nguyễn Văn An',  NULL, 'Singles + doubles. Hard hitter.',           'Hà Nội',  'VN', 'right', 'TPH-N1', 4.05, 4.20, NOW() - INTERVAL '2 days', NULL, FALSE, TRUE,  FALSE, 'vi'),
  ('22222222-2222-4222-8222-222222222222', 'tranthib-test@thepicklehub.test',  'tranthib-test',   'Trần Thị Bình',  NULL, 'Mixed doubles specialist.',                  'Hà Nội',  'VN', 'right', 'TPH-N2', 3.55, 3.80, NOW() - INTERVAL '1 day',  NULL, FALSE, FALSE, FALSE, 'vi'),
  ('33333333-3333-4333-8333-333333333333', 'lyhoangnam-test@thepicklehub.test','lyhoangnam-test', 'Lý Hoàng Nam',   NULL, 'Pro circuit, Saigon Open Q3.',               'HCMC',    'VN', 'left',  'TPH-N3', 4.35, 4.50, NOW() - INTERVAL '3 days', NULL, TRUE,  TRUE,  FALSE, 'vi'),
  ('44444444-4444-4444-8444-444444444444', 'phamquang-test@thepicklehub.test', 'phamquang-test',  'Phạm Quang Đức', NULL, 'Open level, club captain.',                  'HCMC',    'VN', 'right', 'TPH-N4', 3.20, 3.50, NOW() - INTERVAL '5 days', NULL, FALSE, FALSE, FALSE, 'vi'),
  ('55555555-5555-4555-8555-555555555555', 'dohung-test@thepicklehub.test',    'dohung-test',     'Đỗ Hùng Mạnh',   NULL, 'Đà Nẵng league regular.',                    'Đà Nẵng', 'VN', 'right', 'TPH-N5', 3.80, 4.00, NOW() - INTERVAL '4 days', NULL, FALSE, FALSE, FALSE, 'vi'),
  -- 6-8: no DUPR, self-rated only
  ('66666666-6666-4666-8666-666666666666', 'lecam-test@thepicklehub.test',     'lecam-test',      'Lê Cẩm Tú',      NULL, 'Mới chơi 6 tháng.',                          'Hà Nội',  'VN', 'right', NULL,    NULL, NULL, NULL, 3.00, FALSE, FALSE, FALSE, 'vi'),
  ('77777777-7777-4777-8777-777777777777', 'vothanh-test@thepicklehub.test',   'vothanh-test',    'Võ Thành Long',  NULL, 'Open play tối thứ 4 + 6.',                   'HCMC',    'VN', 'right', NULL,    NULL, NULL, NULL, 3.50, FALSE, FALSE, FALSE, 'vi'),
  ('88888888-8888-4888-8888-888888888888', 'dinhmai-test@thepicklehub.test',   'dinhmai-test',    'Đinh Mai Linh',  NULL, 'Mixed + women''s doubles.',                  'HCMC',    'VN', 'left',  NULL,    NULL, NULL, NULL, 4.00, FALSE, FALSE, FALSE, 'vi'),
  -- 9-10: ghost profiles (logged into a match by someone else)
  ('99999999-9999-4999-8999-999999999999', 'ghost1-test@thepicklehub.test',    'khachphuc-test',  'Khách Phúc',     NULL, NULL,                                         'Hà Nội',  'VN', NULL,    NULL,    NULL, NULL, NULL, NULL, FALSE, FALSE, TRUE,  'vi'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ghost2-test@thepicklehub.test',    'khachminh-test',  'Khách Minh',     NULL, NULL,                                         'Đà Nẵng', 'VN', NULL,    NULL,    NULL, NULL, NULL, NULL, FALSE, FALSE, TRUE,  'vi');

-- ─── 4. VENUES (5 hardcoded realistic, 1 verified) ────────────────────────
INSERT INTO public.venues (
  id, slug, name, name_vi, address, district, city, country,
  num_courts, surface_type, is_indoor, is_verified, created_by
)
VALUES
  ('b1111111-1111-4111-8111-111111111111', 'test-san-long-bien', 'Sân Long Biên', 'Sân Pickleball Long Biên',
    '123 Long Biên', 'Long Biên', 'Hà Nội', 'VN', 6, 'hard',     FALSE, TRUE,
    '11111111-1111-4111-8111-111111111111'),
  ('b2222222-2222-4222-8222-222222222222', 'test-san-my-dinh',   'Sân Mỹ Đình',  'Sân Pickleball Mỹ Đình',
    '45 Mỹ Đình',   'Nam Từ Liêm', 'Hà Nội', 'VN', 4, 'hard',    TRUE,  FALSE,
    '11111111-1111-4111-8111-111111111111'),
  ('b3333333-3333-4333-8333-333333333333', 'test-san-phu-tho',   'Sân Phú Thọ',   'Sân Pickleball Phú Thọ',
    '88 3/2',       'Quận 11', 'HCMC', 'VN', 8, 'hard',          FALSE, FALSE,
    '11111111-1111-4111-8111-111111111111'),
  ('b4444444-4444-4444-8444-444444444444', 'test-san-quan-7',    'Sân Quận 7',    'Sân Pickleball Quận 7',
    '256 Nguyễn Lương Bằng', 'Quận 7', 'HCMC', 'VN', 4, 'cushion', TRUE, FALSE,
    '11111111-1111-4111-8111-111111111111'),
  ('b5555555-5555-4555-8555-555555555555', 'test-san-son-tra',   'Sân Sơn Trà',   'Sân Pickleball Sơn Trà',
    '12 Hoàng Sa',  'Sơn Trà', 'Đà Nẵng', 'VN', 6, 'hard',       FALSE, FALSE,
    '11111111-1111-4111-8111-111111111111');

-- ─── 5. MATCHES (20 across states; fixed UUIDs for repeatable participant FK) ──
-- IDs encode state for readability:
--   m1xxxxxx = verified  (10)
--   m2xxxxxx = pending   (5; m2000005 = critical edge case)
--   m3xxxxxx = disputed  (3)
--   m4xxxxxx = expired   (2)
INSERT INTO public.matches (
  id, slug, format, match_type, venue_id, played_at,
  team_a_score, team_b_score, winning_team, scoring_format,
  verification_status, verified_at,
  is_public, recorded_by, created_meta, created_at
)
VALUES
  -- ===== 10 VERIFIED =====
  ('a1111111-0001-4001-8001-000000000001', 'nguyenvana-vs-lyhoangnam-20260420-v00001', 'doubles', 'rec',        'b1111111-1111-4111-8111-111111111111', NOW() - INTERVAL '14 days', ARRAY[11,11],   ARRAY[9,8],   'a', '11_rally', 'verified', NOW() - INTERVAL '13 days', TRUE, '11111111-1111-4111-8111-111111111111', '{"ip":"203.0.113.10","ua":"web/test","device_fp":"fp-aaa-1"}'::JSONB, NOW() - INTERVAL '14 days'),
  ('a1111111-0002-4001-8001-000000000002', 'tranthib-vs-phamquang-20260418-v00002',     'doubles', 'tournament', 'b2222222-2222-4222-8222-222222222222', NOW() - INTERVAL '16 days', ARRAY[11,9,11], ARRAY[9,11,7],'a', '11_rally', 'verified', NOW() - INTERVAL '15 days', TRUE, '22222222-2222-4222-8222-222222222222', '{"ip":"203.0.113.11","ua":"ios/test","device_fp":"fp-bbb-2","capacitor_platform":"ios"}'::JSONB, NOW() - INTERVAL '16 days'),
  ('a1111111-0003-4001-8001-000000000003', 'lyhoangnam-vs-dohung-20260415-v00003',     'singles', 'tournament', 'b3333333-3333-4333-8333-333333333333', NOW() - INTERVAL '19 days', ARRAY[11,11],   ARRAY[7,9],   'a', '11_rally', 'verified', NOW() - INTERVAL '18 days', TRUE, '33333333-3333-4333-8333-333333333333', '{"ip":"203.0.113.12","ua":"web/test","device_fp":"fp-ccc-3"}'::JSONB, NOW() - INTERVAL '19 days'),
  ('a1111111-0004-4001-8001-000000000004', 'phamquang-vs-vothanh-20260412-v00004',     'singles', 'rec',        'b4444444-4444-4444-8444-444444444444', NOW() - INTERVAL '22 days', ARRAY[11,7,11], ARRAY[8,11,9],'a', '11_rally', 'verified', NOW() - INTERVAL '21 days', TRUE, '44444444-4444-4444-8444-444444444444', NULL, NOW() - INTERVAL '22 days'),
  ('a1111111-0005-4001-8001-000000000005', 'dohung-vs-dinhmai-20260410-v00005',         'mixed',   'open_play',  'b5555555-5555-4555-8555-555555555555', NOW() - INTERVAL '24 days', ARRAY[11,11],   ARRAY[6,8],   'a', '11_rally', 'verified', NOW() - INTERVAL '23 days', TRUE, '55555555-5555-4555-8555-555555555555', '{"ip":"203.0.113.14","ua":"android/test","device_fp":"fp-eee-5","capacitor_platform":"android"}'::JSONB, NOW() - INTERVAL '24 days'),
  ('a1111111-0006-4001-8001-000000000006', 'lecam-vs-vothanh-20260408-v00006',          'doubles', 'rec',        'b1111111-1111-4111-8111-111111111111', NOW() - INTERVAL '26 days', ARRAY[11,11],   ARRAY[5,9],   'a', '11_rally', 'verified', NOW() - INTERVAL '25 days', TRUE, '66666666-6666-4666-8666-666666666666', NULL, NOW() - INTERVAL '26 days'),
  ('a1111111-0007-4001-8001-000000000007', 'vothanh-vs-dinhmai-20260405-v00007',        'doubles', 'open_play',  'b2222222-2222-4222-8222-222222222222', NOW() - INTERVAL '28 days', ARRAY[9,11,11], ARRAY[11,9,8],'a', '11_rally', 'verified', NOW() - INTERVAL '27 days', TRUE, '77777777-7777-4777-8777-777777777777', NULL, NOW() - INTERVAL '28 days'),
  ('a1111111-0008-4001-8001-000000000008', 'dinhmai-vs-tranthib-20260403-v00008',       'doubles', 'rec',        'b3333333-3333-4333-8333-333333333333', NOW() - INTERVAL '30 days', ARRAY[11,11],   ARRAY[8,9],   'a', '11_rally', 'verified', NOW() - INTERVAL '29 days', TRUE, '88888888-8888-4888-8888-888888888888', '{"ip":"203.0.113.18","ua":"web/test","device_fp":"fp-hhh-8"}'::JSONB, NOW() - INTERVAL '30 days'),
  ('a1111111-0009-4001-8001-000000000009', 'nguyenvana-vs-tranthib-20260401-v00009',    'doubles', 'rec',        'b4444444-4444-4444-8444-444444444444', NOW() - INTERVAL '32 days', ARRAY[11,7,11], ARRAY[9,11,7],'a', '11_rally', 'verified', NOW() - INTERVAL '31 days', TRUE, '11111111-1111-4111-8111-111111111111', NULL, NOW() - INTERVAL '32 days'),
  ('a1111111-0010-4001-8001-000000000010', 'lyhoangnam-vs-phamquang-20260330-v00010',  'singles', 'rec',        'b5555555-5555-4555-8555-555555555555', NOW() - INTERVAL '34 days', ARRAY[11,11],   ARRAY[7,8],   'a', '11_rally', 'verified', NOW() - INTERVAL '33 days', TRUE, '33333333-3333-4333-8333-333333333333', NULL, NOW() - INTERVAL '34 days'),

  -- ===== 5 PENDING (m2000005 = CRITICAL EDGE CASE) =====
  ('a2222222-0001-4002-8002-000000000001', 'nguyenvana-vs-vothanh-20260502-p00001',     'singles', 'rec',        'b1111111-1111-4111-8111-111111111111', NOW() - INTERVAL '1 day',  ARRAY[11,11],   ARRAY[9,7],   'a', '11_rally', 'pending',  NULL, TRUE, '11111111-1111-4111-8111-111111111111', NULL, NOW() - INTERVAL '1 day'),
  ('a2222222-0002-4002-8002-000000000002', 'tranthib-vs-dinhmai-20260501-p00002',       'doubles', 'open_play',  'b2222222-2222-4222-8222-222222222222', NOW() - INTERVAL '2 days', ARRAY[11,9,11], ARRAY[7,11,8],'a', '11_rally', 'pending',  NULL, TRUE, '22222222-2222-4222-8222-222222222222', NULL, NOW() - INTERVAL '2 days'),
  ('a2222222-0003-4002-8002-000000000003', 'phamquang-vs-dohung-20260430-p00003',       'singles', 'rec',        'b3333333-3333-4333-8333-333333333333', NOW() - INTERVAL '3 days', ARRAY[11,11],   ARRAY[6,9],   'a', '11_rally', 'pending',  NULL, TRUE, '44444444-4444-4444-8444-444444444444', NULL, NOW() - INTERVAL '3 days'),
  ('a2222222-0004-4002-8002-000000000004', 'lecam-vs-vothanh-20260429-p00004',          'doubles', 'rec',        'b4444444-4444-4444-8444-444444444444', NOW() - INTERVAL '4 days', ARRAY[11,11],   ARRAY[8,9],   'a', '11_rally', 'pending',  NULL, TRUE, '66666666-6666-4666-8666-666666666666', NULL, NOW() - INTERVAL '4 days'),
  -- m2000005: doubles, creator team A both confirmed, opponent team B BOTH unconfirmed
  -- → status MUST stay 'pending' even though 50% of participants confirmed.
  -- Tests the verification rule (≥1 OPPONENT TEAM member must confirm).
  ('a2222222-0005-4002-8002-000000000005', 'edgecase-team-a-confirmed-only-p00005',    'doubles', 'rec',        'b5555555-5555-4555-8555-555555555555', NOW() - INTERVAL '5 days', ARRAY[11,11],   ARRAY[7,9],   'a', '11_rally', 'pending',  NULL, TRUE, '11111111-1111-4111-8111-111111111111', '{"ip":"203.0.113.20","ua":"edge-case-test","device_fp":"fp-edgecase"}'::JSONB, NOW() - INTERVAL '5 days'),

  -- ===== 3 DISPUTED =====
  ('a3333333-0001-4003-8003-000000000001', 'nguyenvana-vs-lyhoangnam-20260427-d00001',  'doubles', 'tournament', 'b1111111-1111-4111-8111-111111111111', NOW() - INTERVAL '6 days', ARRAY[11,11],   ARRAY[9,8],   'a', '11_rally', 'disputed', NULL, TRUE, '11111111-1111-4111-8111-111111111111', '{"ip":"203.0.113.21","ua":"web/test","device_fp":"fp-jjj-d1"}'::JSONB, NOW() - INTERVAL '6 days'),
  ('a3333333-0002-4003-8003-000000000002', 'phamquang-vs-dinhmai-20260425-d00002',      'singles', 'rec',        'b3333333-3333-4333-8333-333333333333', NOW() - INTERVAL '8 days', ARRAY[11,9,11], ARRAY[8,11,9],'a', '11_rally', 'disputed', NULL, TRUE, '44444444-4444-4444-8444-444444444444', NULL, NOW() - INTERVAL '8 days'),
  ('a3333333-0003-4003-8003-000000000003', 'dohung-vs-vothanh-20260423-d00003',         'mixed',   'open_play',  'b5555555-5555-4555-8555-555555555555', NOW() - INTERVAL '10 days', ARRAY[11,11],  ARRAY[7,8],   'a', '11_rally', 'disputed', NULL, TRUE, '55555555-5555-4555-8555-555555555555', NULL, NOW() - INTERVAL '10 days'),

  -- ===== 2 EXPIRED (created >7 days, never confirmed) =====
  ('a4444444-0001-4004-8004-000000000001', 'tranthib-vs-lecam-20260424-x00001',         'singles', 'rec',        'b2222222-2222-4222-8222-222222222222', NOW() - INTERVAL '9 days',  ARRAY[11,11],   ARRAY[5,7],   'a', '11_rally', 'expired',  NULL, TRUE, '22222222-2222-4222-8222-222222222222', NULL, NOW() - INTERVAL '9 days'),
  ('a4444444-0002-4004-8004-000000000002', 'lyhoangnam-vs-vothanh-20260420-x00002',     'doubles', 'rec',        'b4444444-4444-4444-8444-444444444444', NOW() - INTERVAL '12 days', ARRAY[11,7,11], ARRAY[9,11,8],'a', '11_rally', 'expired',  NULL, TRUE, '33333333-3333-4333-8333-333333333333', NULL, NOW() - INTERVAL '12 days');

-- ─── 6. MATCH PARTICIPANTS ────────────────────────────────────────────────
-- Pattern reference (creator confirmed automatically per match-create logic):
--   verified: creator team confirmed + ≥1 opponent confirmed
--   pending : only creator confirmed (except m2000005 — creator+teammate)
--   disputed: 1 row has disputed=true + reason
--   expired : only creator confirmed (same as pending, just older)

-- ── m1 verified (a1111111-0001) — doubles, creator user 1 (team a)
INSERT INTO public.match_participants (match_id, player_id, team, position, dupr_rating_before, dupr_rating_after, confirmed, confirmed_at) VALUES
  ('a1111111-0001-4001-8001-000000000001', '11111111-1111-4111-8111-111111111111', 'a', 1, 4.20, 4.21, TRUE, NOW() - INTERVAL '14 days'),
  ('a1111111-0001-4001-8001-000000000001', '22222222-2222-4222-8222-222222222222', 'a', 2, 3.80, 3.81, TRUE, NOW() - INTERVAL '13 days'),
  ('a1111111-0001-4001-8001-000000000001', '33333333-3333-4333-8333-333333333333', 'b', 1, 4.50, 4.49, TRUE, NOW() - INTERVAL '13 days'),
  ('a1111111-0001-4001-8001-000000000001', '44444444-4444-4444-8444-444444444444', 'b', 2, 3.50, 3.49, FALSE, NULL);

-- ── m1 verified (a1111111-0002) — doubles, creator user 2 (team a)
INSERT INTO public.match_participants (match_id, player_id, team, position, dupr_rating_before, dupr_rating_after, confirmed, confirmed_at) VALUES
  ('a1111111-0002-4001-8001-000000000002', '22222222-2222-4222-8222-222222222222', 'a', 1, 3.80, 3.82, TRUE, NOW() - INTERVAL '16 days'),
  ('a1111111-0002-4001-8001-000000000002', '11111111-1111-4111-8111-111111111111', 'a', 2, 4.20, 4.22, TRUE, NOW() - INTERVAL '15 days'),
  ('a1111111-0002-4001-8001-000000000002', '44444444-4444-4444-8444-444444444444', 'b', 1, 3.50, 3.48, TRUE, NOW() - INTERVAL '15 days'),
  ('a1111111-0002-4001-8001-000000000002', '88888888-8888-4888-8888-888888888888', 'b', 2, NULL, NULL, FALSE, NULL);

-- ── m1 verified (a1111111-0003) — singles, creator user 3 (team a)
INSERT INTO public.match_participants (match_id, player_id, team, position, dupr_rating_before, dupr_rating_after, confirmed, confirmed_at) VALUES
  ('a1111111-0003-4001-8001-000000000003', '33333333-3333-4333-8333-333333333333', 'a', 1, 4.35, 4.37, TRUE, NOW() - INTERVAL '19 days'),
  ('a1111111-0003-4001-8001-000000000003', '55555555-5555-4555-8555-555555555555', 'b', 1, 3.80, 3.78, TRUE, NOW() - INTERVAL '18 days');

-- ── m1 verified (a1111111-0004) — singles, creator user 4 (team a)
INSERT INTO public.match_participants (match_id, player_id, team, position, confirmed, confirmed_at) VALUES
  ('a1111111-0004-4001-8001-000000000004', '44444444-4444-4444-8444-444444444444', 'a', 1, TRUE, NOW() - INTERVAL '22 days'),
  ('a1111111-0004-4001-8001-000000000004', '77777777-7777-4777-8777-777777777777', 'b', 1, TRUE, NOW() - INTERVAL '21 days');

-- ── m1 verified (a1111111-0005) — mixed, creator user 5 (team a)
INSERT INTO public.match_participants (match_id, player_id, team, position, dupr_rating_before, dupr_rating_after, confirmed, confirmed_at) VALUES
  ('a1111111-0005-4001-8001-000000000005', '55555555-5555-4555-8555-555555555555', 'a', 1, 4.00, 4.01, TRUE, NOW() - INTERVAL '24 days'),
  ('a1111111-0005-4001-8001-000000000005', '88888888-8888-4888-8888-888888888888', 'a', 2, NULL, NULL, TRUE, NOW() - INTERVAL '23 days'),
  ('a1111111-0005-4001-8001-000000000005', '44444444-4444-4444-8444-444444444444', 'b', 1, 3.50, 3.49, TRUE, NOW() - INTERVAL '23 days'),
  ('a1111111-0005-4001-8001-000000000005', '66666666-6666-4666-8666-666666666666', 'b', 2, NULL, NULL, FALSE, NULL);

-- ── m1 verified (a1111111-0006) — doubles, creator user 6 (team a)
INSERT INTO public.match_participants (match_id, player_id, team, position, confirmed, confirmed_at) VALUES
  ('a1111111-0006-4001-8001-000000000006', '66666666-6666-4666-8666-666666666666', 'a', 1, TRUE, NOW() - INTERVAL '26 days'),
  ('a1111111-0006-4001-8001-000000000006', '88888888-8888-4888-8888-888888888888', 'a', 2, TRUE, NOW() - INTERVAL '25 days'),
  ('a1111111-0006-4001-8001-000000000006', '77777777-7777-4777-8777-777777777777', 'b', 1, TRUE, NOW() - INTERVAL '25 days'),
  ('a1111111-0006-4001-8001-000000000006', '99999999-9999-4999-8999-999999999999', 'b', 2, FALSE, NULL);

-- ── m1 verified (a1111111-0007) — doubles, creator user 7
INSERT INTO public.match_participants (match_id, player_id, team, position, confirmed, confirmed_at) VALUES
  ('a1111111-0007-4001-8001-000000000007', '77777777-7777-4777-8777-777777777777', 'a', 1, TRUE, NOW() - INTERVAL '28 days'),
  ('a1111111-0007-4001-8001-000000000007', '66666666-6666-4666-8666-666666666666', 'a', 2, TRUE, NOW() - INTERVAL '27 days'),
  ('a1111111-0007-4001-8001-000000000007', '88888888-8888-4888-8888-888888888888', 'b', 1, TRUE, NOW() - INTERVAL '27 days'),
  ('a1111111-0007-4001-8001-000000000007', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'b', 2, FALSE, NULL);

-- ── m1 verified (a1111111-0008) — doubles, creator user 8
INSERT INTO public.match_participants (match_id, player_id, team, position, dupr_rating_before, dupr_rating_after, confirmed, confirmed_at) VALUES
  ('a1111111-0008-4001-8001-000000000008', '88888888-8888-4888-8888-888888888888', 'a', 1, NULL, NULL, TRUE, NOW() - INTERVAL '30 days'),
  ('a1111111-0008-4001-8001-000000000008', '77777777-7777-4777-8777-777777777777', 'a', 2, NULL, NULL, TRUE, NOW() - INTERVAL '29 days'),
  ('a1111111-0008-4001-8001-000000000008', '22222222-2222-4222-8222-222222222222', 'b', 1, 3.80, 3.79, TRUE, NOW() - INTERVAL '29 days'),
  ('a1111111-0008-4001-8001-000000000008', '66666666-6666-4666-8666-666666666666', 'b', 2, NULL, NULL, FALSE, NULL);

-- ── m1 verified (a1111111-0009) — doubles, creator user 1
INSERT INTO public.match_participants (match_id, player_id, team, position, confirmed, confirmed_at) VALUES
  ('a1111111-0009-4001-8001-000000000009', '11111111-1111-4111-8111-111111111111', 'a', 1, TRUE, NOW() - INTERVAL '32 days'),
  ('a1111111-0009-4001-8001-000000000009', '55555555-5555-4555-8555-555555555555', 'a', 2, TRUE, NOW() - INTERVAL '31 days'),
  ('a1111111-0009-4001-8001-000000000009', '22222222-2222-4222-8222-222222222222', 'b', 1, TRUE, NOW() - INTERVAL '31 days'),
  ('a1111111-0009-4001-8001-000000000009', '33333333-3333-4333-8333-333333333333', 'b', 2, FALSE, NULL);

-- ── m1 verified (a1111111-0010) — singles, creator user 3
INSERT INTO public.match_participants (match_id, player_id, team, position, confirmed, confirmed_at) VALUES
  ('a1111111-0010-4001-8001-000000000010', '33333333-3333-4333-8333-333333333333', 'a', 1, TRUE, NOW() - INTERVAL '34 days'),
  ('a1111111-0010-4001-8001-000000000010', '44444444-4444-4444-8444-444444444444', 'b', 1, TRUE, NOW() - INTERVAL '33 days');

-- ── m2 pending (a2222222-0001) — singles, creator user 1, opponent user 7 NOT confirmed
INSERT INTO public.match_participants (match_id, player_id, team, position, confirmed, confirmed_at) VALUES
  ('a2222222-0001-4002-8002-000000000001', '11111111-1111-4111-8111-111111111111', 'a', 1, TRUE, NOW() - INTERVAL '1 day'),
  ('a2222222-0001-4002-8002-000000000001', '77777777-7777-4777-8777-777777777777', 'b', 1, FALSE, NULL);

-- ── m2 pending (a2222222-0002) — doubles
INSERT INTO public.match_participants (match_id, player_id, team, position, confirmed, confirmed_at) VALUES
  ('a2222222-0002-4002-8002-000000000002', '22222222-2222-4222-8222-222222222222', 'a', 1, TRUE, NOW() - INTERVAL '2 days'),
  ('a2222222-0002-4002-8002-000000000002', '11111111-1111-4111-8111-111111111111', 'a', 2, FALSE, NULL),
  ('a2222222-0002-4002-8002-000000000002', '88888888-8888-4888-8888-888888888888', 'b', 1, FALSE, NULL),
  ('a2222222-0002-4002-8002-000000000002', '66666666-6666-4666-8666-666666666666', 'b', 2, FALSE, NULL);

-- ── m2 pending (a2222222-0003) — singles
INSERT INTO public.match_participants (match_id, player_id, team, position, confirmed, confirmed_at) VALUES
  ('a2222222-0003-4002-8002-000000000003', '44444444-4444-4444-8444-444444444444', 'a', 1, TRUE, NOW() - INTERVAL '3 days'),
  ('a2222222-0003-4002-8002-000000000003', '55555555-5555-4555-8555-555555555555', 'b', 1, FALSE, NULL);

-- ── m2 pending (a2222222-0004) — doubles
INSERT INTO public.match_participants (match_id, player_id, team, position, confirmed, confirmed_at) VALUES
  ('a2222222-0004-4002-8002-000000000004', '66666666-6666-4666-8666-666666666666', 'a', 1, TRUE, NOW() - INTERVAL '4 days'),
  ('a2222222-0004-4002-8002-000000000004', '88888888-8888-4888-8888-888888888888', 'a', 2, FALSE, NULL),
  ('a2222222-0004-4002-8002-000000000004', '77777777-7777-4777-8777-777777777777', 'b', 1, FALSE, NULL),
  ('a2222222-0004-4002-8002-000000000004', '99999999-9999-4999-8999-999999999999', 'b', 2, FALSE, NULL);

-- ── m2000005 EDGE CASE — doubles, creator team A BOTH confirmed, team B NEITHER
INSERT INTO public.match_participants (match_id, player_id, team, position, confirmed, confirmed_at) VALUES
  ('a2222222-0005-4002-8002-000000000005', '11111111-1111-4111-8111-111111111111', 'a', 1, TRUE,  NOW() - INTERVAL '5 days'),  -- creator
  ('a2222222-0005-4002-8002-000000000005', '22222222-2222-4222-8222-222222222222', 'a', 2, TRUE,  NOW() - INTERVAL '5 days'),  -- TEAMMATE confirmed
  ('a2222222-0005-4002-8002-000000000005', '33333333-3333-4333-8333-333333333333', 'b', 1, FALSE, NULL),                        -- opponent NOT confirmed
  ('a2222222-0005-4002-8002-000000000005', '44444444-4444-4444-8444-444444444444', 'b', 2, FALSE, NULL);                        -- opponent NOT confirmed

-- ── m3 disputed (a3333333-0001) — 1 row disputed=true
INSERT INTO public.match_participants (match_id, player_id, team, position, confirmed, confirmed_at, disputed, dispute_reason) VALUES
  ('a3333333-0001-4003-8003-000000000001', '11111111-1111-4111-8111-111111111111', 'a', 1, TRUE,  NOW() - INTERVAL '6 days', FALSE, NULL),
  ('a3333333-0001-4003-8003-000000000001', '22222222-2222-4222-8222-222222222222', 'a', 2, FALSE, NULL,                       FALSE, NULL),
  ('a3333333-0001-4003-8003-000000000001', '33333333-3333-4333-8333-333333333333', 'b', 1, FALSE, NULL,                       TRUE,  'Tỷ số game 2 sai'),
  ('a3333333-0001-4003-8003-000000000001', '55555555-5555-4555-8555-555555555555', 'b', 2, FALSE, NULL,                       FALSE, NULL);

-- ── m3 disputed (a3333333-0002) — singles
INSERT INTO public.match_participants (match_id, player_id, team, position, confirmed, confirmed_at, disputed, dispute_reason) VALUES
  ('a3333333-0002-4003-8003-000000000002', '44444444-4444-4444-8444-444444444444', 'a', 1, TRUE,  NOW() - INTERVAL '8 days', FALSE, NULL),
  ('a3333333-0002-4003-8003-000000000002', '88888888-8888-4888-8888-888888888888', 'b', 1, FALSE, NULL,                       TRUE,  'Game 3 chưa kết thúc');

-- ── m3 disputed (a3333333-0003) — mixed
INSERT INTO public.match_participants (match_id, player_id, team, position, confirmed, confirmed_at, disputed, dispute_reason) VALUES
  ('a3333333-0003-4003-8003-000000000003', '55555555-5555-4555-8555-555555555555', 'a', 1, TRUE,  NOW() - INTERVAL '10 days', FALSE, NULL),
  ('a3333333-0003-4003-8003-000000000003', '88888888-8888-4888-8888-888888888888', 'a', 2, FALSE, NULL,                        FALSE, NULL),
  ('a3333333-0003-4003-8003-000000000003', '77777777-7777-4777-8777-777777777777', 'b', 1, FALSE, NULL,                        TRUE,  'Tôi không chơi trận này'),
  ('a3333333-0003-4003-8003-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'b', 2, FALSE, NULL,                        FALSE, NULL);

-- ── m4 expired (a4444444-0001) — singles, creator confirmed only
INSERT INTO public.match_participants (match_id, player_id, team, position, confirmed, confirmed_at) VALUES
  ('a4444444-0001-4004-8004-000000000001', '22222222-2222-4222-8222-222222222222', 'a', 1, TRUE, NOW() - INTERVAL '9 days'),
  ('a4444444-0001-4004-8004-000000000001', '66666666-6666-4666-8666-666666666666', 'b', 1, FALSE, NULL);

-- ── m4 expired (a4444444-0002) — doubles, creator confirmed only
INSERT INTO public.match_participants (match_id, player_id, team, position, confirmed, confirmed_at) VALUES
  ('a4444444-0002-4004-8004-000000000002', '33333333-3333-4333-8333-333333333333', 'a', 1, TRUE,  NOW() - INTERVAL '12 days'),
  ('a4444444-0002-4004-8004-000000000002', '11111111-1111-4111-8111-111111111111', 'a', 2, FALSE, NULL),
  ('a4444444-0002-4004-8004-000000000002', '77777777-7777-4777-8777-777777777777', 'b', 1, FALSE, NULL),
  ('a4444444-0002-4004-8004-000000000002', '88888888-8888-4888-8888-888888888888', 'b', 2, FALSE, NULL);

-- ─── 7. SOCIAL_FOLLOWS (30 user→user, no self-follow) ─────────────────────
INSERT INTO public.social_follows (follower_id, followed_id) VALUES
  -- User 1 follows users 2-8 (7 follows)
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'),
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333'),
  ('11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444'),
  ('11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555'),
  ('11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666'),
  ('11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777'),
  ('11111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-888888888888'),
  -- User 2 follows users 1, 3, 5 (3)
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'),
  ('22222222-2222-4222-8222-222222222222', '55555555-5555-4555-8555-555555555555'),
  -- User 3 follows users 1, 2, 4, 5 (4)
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111'),
  ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'),
  ('33333333-3333-4333-8333-333333333333', '55555555-5555-4555-8555-555555555555'),
  -- User 4 follows users 1, 3 (2)
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111'),
  ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333'),
  -- User 5 follows users 1, 3, 8 (3)
  ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111'),
  ('55555555-5555-4555-8555-555555555555', '33333333-3333-4333-8333-333333333333'),
  ('55555555-5555-4555-8555-555555555555', '88888888-8888-4888-8888-888888888888'),
  -- User 6 follows users 1, 7 (2)
  ('66666666-6666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111'),
  ('66666666-6666-4666-8666-666666666666', '77777777-7777-4777-8777-777777777777'),
  -- User 7 follows users 1, 6, 8 (3)
  ('77777777-7777-4777-8777-777777777777', '11111111-1111-4111-8111-111111111111'),
  ('77777777-7777-4777-8777-777777777777', '66666666-6666-4666-8666-666666666666'),
  ('77777777-7777-4777-8777-777777777777', '88888888-8888-4888-8888-888888888888'),
  -- User 8 follows users 1, 5, 7 (3)
  ('88888888-8888-4888-8888-888888888888', '11111111-1111-4111-8111-111111111111'),
  ('88888888-8888-4888-8888-888888888888', '55555555-5555-4555-8555-555555555555'),
  ('88888888-8888-4888-8888-888888888888', '77777777-7777-4777-8777-777777777777'),
  -- Some cross-user finishing the count to 30
  ('44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'),
  ('44444444-4444-4444-8444-444444444444', '88888888-8888-4888-8888-888888888888'),
  ('66666666-6666-4666-8666-666666666666', '88888888-8888-4888-8888-888888888888');

-- ─── 8. CLIPS (8 — 5 attached to matches, 3 standalone, 1 private) ────────
INSERT INTO public.clips (
  id, match_id, uploaded_by, storage_path, thumbnail_path,
  duration_seconds, width, height, caption, caption_vi, view_count, is_public, created_at
) VALUES
  ('c0000001-1111-4111-8111-000000000001', 'a1111111-0001-4001-8001-000000000001', '11111111-1111-4111-8111-111111111111', 'test/clip-1.mp4', 'test/clip-1-thumb.jpg', 22, 1920, 1080, 'Crosscourt winner game 1',  'Cú winner chéo sân game 1',     34, TRUE,  NOW() - INTERVAL '13 days'),
  ('c0000002-1111-4111-8111-000000000002', 'a1111111-0002-4001-8001-000000000002', '22222222-2222-4222-8222-222222222222', 'test/clip-2.mp4', 'test/clip-2-thumb.jpg', 45, 1920, 1080, 'Game point save',           'Pha cứu game point',            58, TRUE,  NOW() - INTERVAL '15 days'),
  ('c0000003-1111-4111-8111-000000000003', 'a1111111-0005-4001-8001-000000000005', '55555555-5555-4555-8555-555555555555', 'test/clip-3.mp4', 'test/clip-3-thumb.jpg', 18, 1080, 1920, 'Mixed: serve return',        'Mixed: trả giao bóng',           21, TRUE,  NOW() - INTERVAL '23 days'),
  ('c0000004-1111-4111-8111-000000000004', 'a1111111-0008-4001-8001-000000000008', '88888888-8888-4888-8888-888888888888', 'test/clip-4.mp4', 'test/clip-4-thumb.jpg', 30, 1920, 1080, 'Long rally',                 'Rally dài',                      12, TRUE,  NOW() - INTERVAL '29 days'),
  ('c0000005-1111-4111-8111-000000000005', 'a1111111-0010-4001-8001-000000000010', '33333333-3333-4333-8333-333333333333', 'test/clip-5.mp4', 'test/clip-5-thumb.jpg', 25, 1920, 1080, 'Singles match point',        'Match point trận đơn',           90, TRUE,  NOW() - INTERVAL '33 days'),
  ('c0000006-1111-4111-8111-000000000006', NULL,                                    '11111111-1111-4111-8111-111111111111', 'test/clip-6.mp4', 'test/clip-6-thumb.jpg', 60, 1080, 1920, 'Practice solo serve',        'Tập giao bóng một mình',         8,  TRUE,  NOW() - INTERVAL '7 days'),
  ('c0000007-1111-4111-8111-000000000007', NULL,                                    '33333333-3333-4333-8333-333333333333', 'test/clip-7.mp4', 'test/clip-7-thumb.jpg', 75, 1920, 1080, 'Drill: third shot drop',     'Drill: third shot drop',         44, TRUE,  NOW() - INTERVAL '4 days'),
  ('c0000008-1111-4111-8111-000000000008', NULL,                                    '88888888-8888-4888-8888-888888888888', 'test/clip-8.mp4', 'test/clip-8-thumb.jpg', 90, 1080, 1920, 'Private personal review',    'Review cá nhân',                  0,  FALSE, NOW() - INTERVAL '2 days');

-- ─── 9. KUDOS (25 total: 20 match + 3 clip + 2 social_comment) ────────────
-- 20 match kudos — distinct (user, target_id) per UNIQUE constraint
INSERT INTO public.kudos (user_id, target_type, target_id) VALUES
  ('11111111-1111-4111-8111-111111111111', 'match', 'a1111111-0002-4001-8001-000000000002'),
  ('22222222-2222-4222-8222-222222222222', 'match', 'a1111111-0001-4001-8001-000000000001'),
  ('33333333-3333-4333-8333-333333333333', 'match', 'a1111111-0001-4001-8001-000000000001'),
  ('44444444-4444-4444-8444-444444444444', 'match', 'a1111111-0001-4001-8001-000000000001'),
  ('55555555-5555-4555-8555-555555555555', 'match', 'a1111111-0003-4001-8001-000000000003'),
  ('66666666-6666-4666-8666-666666666666', 'match', 'a1111111-0006-4001-8001-000000000006'),
  ('77777777-7777-4777-8777-777777777777', 'match', 'a1111111-0007-4001-8001-000000000007'),
  ('88888888-8888-4888-8888-888888888888', 'match', 'a1111111-0008-4001-8001-000000000008'),
  ('11111111-1111-4111-8111-111111111111', 'match', 'a1111111-0003-4001-8001-000000000003'),
  ('22222222-2222-4222-8222-222222222222', 'match', 'a1111111-0005-4001-8001-000000000005'),
  ('33333333-3333-4333-8333-333333333333', 'match', 'a1111111-0006-4001-8001-000000000006'),
  ('44444444-4444-4444-8444-444444444444', 'match', 'a1111111-0007-4001-8001-000000000007'),
  ('55555555-5555-4555-8555-555555555555', 'match', 'a1111111-0008-4001-8001-000000000008'),
  ('66666666-6666-4666-8666-666666666666', 'match', 'a1111111-0010-4001-8001-000000000010'),
  ('77777777-7777-4777-8777-777777777777', 'match', 'a1111111-0009-4001-8001-000000000009'),
  ('88888888-8888-4888-8888-888888888888', 'match', 'a1111111-0010-4001-8001-000000000010'),
  ('11111111-1111-4111-8111-111111111111', 'match', 'a1111111-0007-4001-8001-000000000007'),
  ('22222222-2222-4222-8222-222222222222', 'match', 'a1111111-0009-4001-8001-000000000009'),
  ('33333333-3333-4333-8333-333333333333', 'match', 'a1111111-0010-4001-8001-000000000010'),
  ('44444444-4444-4444-8444-444444444444', 'match', 'a1111111-0008-4001-8001-000000000008');

-- 3 clip kudos
INSERT INTO public.kudos (user_id, target_type, target_id) VALUES
  ('22222222-2222-4222-8222-222222222222', 'clip', 'c0000005-1111-4111-8111-000000000005'),
  ('33333333-3333-4333-8333-333333333333', 'clip', 'c0000005-1111-4111-8111-000000000005'),
  ('44444444-4444-4444-8444-444444444444', 'clip', 'c0000007-1111-4111-8111-000000000007');

-- 2 comment kudos — target_id refers to social_comments rows (inserted below).
-- Inserted later via DO block after social_comments to keep id stable.

-- ─── 10. SOCIAL_COMMENTS (15 — 10 match, 3 venue, 2 profile, 3 nested, 1 deleted) ──
INSERT INTO public.social_comments (id, user_id, target_type, target_id, parent_id, body, is_deleted, created_at) VALUES
  ('d0000001-2222-4222-8222-000000000001', '22222222-2222-4222-8222-222222222222', 'match',   'a1111111-0001-4001-8001-000000000001', NULL,                                        'Trận hay quá! Nam đánh tốt.',                FALSE, NOW() - INTERVAL '13 days'),
  ('d0000002-2222-4222-8222-000000000002', '33333333-3333-4333-8333-333333333333', 'match',   'a1111111-0001-4001-8001-000000000001', NULL,                                        'Game 3 anyone has video?',                    FALSE, NOW() - INTERVAL '12 days'),
  ('d0000003-2222-4222-8222-000000000003', '11111111-1111-4111-8111-111111111111', 'match',   'a1111111-0001-4001-8001-000000000001', 'd0000002-2222-4222-8222-000000000002',     'Có clip rồi, anh xem ở phần highlight.',     FALSE, NOW() - INTERVAL '12 days'),
  ('d0000004-2222-4222-8222-000000000004', '44444444-4444-4444-8444-444444444444', 'match',   'a1111111-0002-4001-8001-000000000002', NULL,                                        'Bình đánh chéo sân chuẩn.',                  FALSE, NOW() - INTERVAL '15 days'),
  ('d0000005-2222-4222-8222-000000000005', '55555555-5555-4555-8555-555555555555', 'match',   'a1111111-0003-4001-8001-000000000003', NULL,                                        'Singles của Nam quá đỉnh.',                  FALSE, NOW() - INTERVAL '18 days'),
  ('d0000006-2222-4222-8222-000000000006', '66666666-6666-4666-8666-666666666666', 'match',   'a1111111-0005-4001-8001-000000000005', NULL,                                        'Mixed pair này ăn ý ghê.',                   FALSE, NOW() - INTERVAL '23 days'),
  ('d0000007-2222-4222-8222-000000000007', '77777777-7777-4777-8777-777777777777', 'match',   'a1111111-0006-4001-8001-000000000006', NULL,                                        'GG. Trận sau mời tôi vào nhé.',              FALSE, NOW() - INTERVAL '25 days'),
  ('d0000008-2222-4222-8222-000000000008', '88888888-8888-4888-8888-888888888888', 'match',   'a1111111-0007-4001-8001-000000000007', NULL,                                        'Game 1 của bên A hơi run.',                  FALSE, NOW() - INTERVAL '27 days'),
  ('d0000009-2222-4222-8222-000000000009', '11111111-1111-4111-8111-111111111111', 'match',   'a1111111-0010-4001-8001-000000000010', NULL,                                        'Match point quá đẹp!',                       FALSE, NOW() - INTERVAL '33 days'),
  ('d0000010-2222-4222-8222-000000000010', '22222222-2222-4222-8222-222222222222', 'match',   'a1111111-0009-4001-8001-000000000009', NULL,                                        'Comment xóa thử nghiệm.',                    TRUE,  NOW() - INTERVAL '31 days'),
  ('d0000011-2222-4222-8222-000000000011', '33333333-3333-4333-8333-333333333333', 'venue',   'b1111111-1111-4111-8111-111111111111', NULL,                                        'Sân Long Biên tuyệt vời, sạch sẽ.',          FALSE, NOW() - INTERVAL '5 days'),
  ('d0000012-2222-4222-8222-000000000012', '44444444-4444-4444-8444-444444444444', 'venue',   'b1111111-1111-4111-8111-111111111111', 'd0000011-2222-4222-8222-000000000011',     'Đồng ý, ánh sáng cũng tốt.',                 FALSE, NOW() - INTERVAL '5 days'),
  ('d0000013-2222-4222-8222-000000000013', '55555555-5555-4555-8555-555555555555', 'venue',   'b3333333-3333-4333-8333-333333333333', NULL,                                        'Sân Phú Thọ giá hợp lý không?',              FALSE, NOW() - INTERVAL '3 days'),
  ('d0000014-2222-4222-8222-000000000014', '66666666-6666-4666-8666-666666666666', 'profile', '11111111-1111-4111-8111-111111111111', NULL,                                        'Nam ơi cho hỏi paddle dùng loại nào?',       FALSE, NOW() - INTERVAL '2 days'),
  ('d0000015-2222-4222-8222-000000000015', '11111111-1111-4111-8111-111111111111', 'profile', '11111111-1111-4111-8111-111111111111', 'd0000014-2222-4222-8222-000000000014',     'Joola Vision CGS 16, mua trên TPH shop.',    FALSE, NOW() - INTERVAL '2 days');

-- 2 comment kudos (now that social_comments rows exist)
INSERT INTO public.kudos (user_id, target_type, target_id) VALUES
  ('11111111-1111-4111-8111-111111111111', 'comment', 'd0000011-2222-4222-8222-000000000011'),
  ('33333333-3333-4333-8333-333333333333', 'comment', 'd0000004-2222-4222-8222-000000000004');

-- ─── 11. OPEN_PLAY_SESSIONS (5: 3 open / 1 full / 1 completed) ────────────
INSERT INTO public.open_play_sessions (
  id, venue_id, format, scheduled_start, scheduled_end,
  min_rating, max_rating, max_players, current_players, status, created_by, notes
) VALUES
  ('e0000001-3333-4333-8333-000000000001', 'b1111111-1111-4111-8111-111111111111', 'doubles', NOW() + INTERVAL '2 days  19 hours', NOW() + INTERVAL '2 days 21 hours',  3.0, 3.5, 4, 3, 'open',      '11111111-1111-4111-8111-111111111111', 'Cần thêm 1 người. Level 3.0-3.5.'),
  ('e0000002-3333-4333-8333-000000000002', 'b3333333-3333-4333-8333-333333333333', 'doubles', NOW() + INTERVAL '3 days  18 hours', NOW() + INTERVAL '3 days 20 hours',  3.5, 4.0, 4, 2, 'open',      '33333333-3333-4333-8333-333333333333', 'Còn 2 slot, ưu tiên doubles partner sẵn có.'),
  ('e0000003-3333-4333-8333-000000000003', 'b5555555-5555-4555-8555-555555555555', 'singles', NOW() + INTERVAL '1 day   20 hours', NOW() + INTERVAL '1 day  22 hours',  NULL, NULL, 2, 1, 'open',      '55555555-5555-4555-8555-555555555555', 'Mở cho mọi level. Singles knockout.'),
  ('e0000004-3333-4333-8333-000000000004', 'b2222222-2222-4222-8222-222222222222', 'doubles', NOW() + INTERVAL '5 days  19 hours', NOW() + INTERVAL '5 days 21 hours',  4.0, 5.0, 4, 4, 'full',      '22222222-2222-4222-8222-222222222222', 'Đầy người. Level cao only.'),
  ('e0000005-3333-4333-8333-000000000005', 'b4444444-4444-4444-8444-444444444444', 'doubles', NOW() - INTERVAL '7 days  19 hours', NOW() - INTERVAL '7 days 17 hours',  3.0, 4.0, 4, 4, 'completed', '44444444-4444-4444-8444-444444444444', 'Tuần trước. Trận hay.');

-- ─── 12. SESSION_PARTICIPANTS (12) ─────────────────────────────────────────
INSERT INTO public.session_participants (session_id, player_id, status) VALUES
  -- e0000001 (3 players, 1 slot open)
  ('e0000001-3333-4333-8333-000000000001', '11111111-1111-4111-8111-111111111111', 'joined'),
  ('e0000001-3333-4333-8333-000000000001', '22222222-2222-4222-8222-222222222222', 'joined'),
  ('e0000001-3333-4333-8333-000000000001', '66666666-6666-4666-8666-666666666666', 'confirmed'),
  -- e0000002 (2 players, 2 slots open)
  ('e0000002-3333-4333-8333-000000000002', '33333333-3333-4333-8333-333333333333', 'joined'),
  ('e0000002-3333-4333-8333-000000000002', '55555555-5555-4555-8555-555555555555', 'joined'),
  -- e0000003 (1 player solo, looking for opponent)
  ('e0000003-3333-4333-8333-000000000003', '55555555-5555-4555-8555-555555555555', 'joined'),
  -- e0000004 full (4 players)
  ('e0000004-3333-4333-8333-000000000004', '22222222-2222-4222-8222-222222222222', 'joined'),
  ('e0000004-3333-4333-8333-000000000004', '11111111-1111-4111-8111-111111111111', 'confirmed'),
  ('e0000004-3333-4333-8333-000000000004', '33333333-3333-4333-8333-333333333333', 'joined'),
  ('e0000004-3333-4333-8333-000000000004', '88888888-8888-4888-8888-888888888888', 'declined'),
  -- e0000005 completed
  ('e0000005-3333-4333-8333-000000000005', '44444444-4444-4444-8444-444444444444', 'joined'),
  ('e0000005-3333-4333-8333-000000000005', '77777777-7777-4777-8777-777777777777', 'no_show');

-- ─── 13. SOCIAL_NOTIFICATIONS (5 for user 1: 3 unread, 2 read) ────────────
INSERT INTO public.social_notifications (
  user_id, type, title, body, link_url, payload, is_read, created_at
) VALUES
  ('11111111-1111-4111-8111-111111111111', 'match_needs_confirm', 'Có trận chờ bạn xác nhận', 'Bình vừa log 1 trận với bạn — xác nhận?', 'https://www.thepicklehub.net/tran-dau/a2222222-0002-4002-8002-000000000002', '{"match_id":"a2222222-0002-4002-8002-000000000002"}'::JSONB, FALSE, NOW() - INTERVAL '2 hours'),
  ('11111111-1111-4111-8111-111111111111', 'match_verified',      'Trận của bạn đã verified',  'Trận với Tú đã được Tú xác nhận.',         'https://www.thepicklehub.net/tran-dau/a1111111-0009-4001-8001-000000000009', '{"match_id":"a1111111-0009-4001-8001-000000000009"}'::JSONB, FALSE, NOW() - INTERVAL '6 hours'),
  ('11111111-1111-4111-8111-111111111111', 'kudos_received',      'Bạn vừa nhận 1 kudos',       'Hoàng Nam đã kudos trận của bạn.',          'https://www.thepicklehub.net/tran-dau/a1111111-0001-4001-8001-000000000001', '{"match_id":"a1111111-0001-4001-8001-000000000001","actor_id":"33333333-3333-4333-8333-333333333333"}'::JSONB, FALSE, NOW() - INTERVAL '1 day'),
  ('11111111-1111-4111-8111-111111111111', 'follower_added',      'Có người mới theo dõi bạn', 'Cẩm Tú bắt đầu theo dõi bạn.',              'https://www.thepicklehub.net/nguoi-choi/lecam-test',                          '{"actor_id":"66666666-6666-4666-8666-666666666666"}'::JSONB, TRUE,  NOW() - INTERVAL '3 days'),
  ('11111111-1111-4111-8111-111111111111', 'weekly_recap',        'Tuần này của bạn',          '5 trận, 4 thắng, +0.05 DUPR.',              'https://www.thepicklehub.net/nguoi-choi/nguyenvana-test',                     '{"matches":5,"wins":4,"dupr_delta":0.05}'::JSONB,           TRUE,  NOW() - INTERVAL '5 days');

-- ─── 14. DONE — quick summary ─────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '────────────────────────────────────────────────';
  RAISE NOTICE 'Seed complete. Quick counts:';
  RAISE NOTICE '  profiles (test):    %', (SELECT COUNT(*) FROM public.profiles WHERE username LIKE '%-test');
  RAISE NOTICE '  venues (test):      %', (SELECT COUNT(*) FROM public.venues WHERE slug LIKE 'test-%');
  RAISE NOTICE '  matches:            %', (SELECT COUNT(*) FROM public.matches);
  RAISE NOTICE '  match_participants: %', (SELECT COUNT(*) FROM public.match_participants);
  RAISE NOTICE '  social_follows:     %', (SELECT COUNT(*) FROM public.social_follows);
  RAISE NOTICE '  kudos:              %', (SELECT COUNT(*) FROM public.kudos);
  RAISE NOTICE '  social_comments:    %', (SELECT COUNT(*) FROM public.social_comments);
  RAISE NOTICE '  clips:              %', (SELECT COUNT(*) FROM public.clips);
  RAISE NOTICE '  open_play_sessions: %', (SELECT COUNT(*) FROM public.open_play_sessions);
  RAISE NOTICE '  session_participants: %', (SELECT COUNT(*) FROM public.session_participants);
  RAISE NOTICE '  social_notifications: %', (SELECT COUNT(*) FROM public.social_notifications);
  RAISE NOTICE '────────────────────────────────────────────────';
  RAISE NOTICE 'Login for manual test:';
  RAISE NOTICE '  email:    nguyenvana-test@thepicklehub.test';
  RAISE NOTICE '  password: TestPass123!';
  RAISE NOTICE '────────────────────────────────────────────────';
END $$;

-- Gán cứng sân theo bảng (p_group_courts) cho setup_quick_table_roster_atomic:
-- bảng đã gán chỉ đánh ở đúng sân đó, gán được lưu vào quick_tables,
-- gọi kiểu cũ (không có tham số mới) vẫn chạy.

BEGIN;

SELECT plan(8);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'b7000001-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'group-courts-owner@thepicklehub.test', '', now(),
  '{"provider":"test","providers":["test"]}'::jsonb,
  '{"display_name":"Group Courts Owner"}'::jsonb, now(), now()
);

INSERT INTO public.quick_tables (
  id, creator_user_id, name, player_count, format, status, group_count, share_id
) VALUES
  ('b7000010-0000-4000-8000-000000000010', 'b7000001-0000-4000-8000-000000000001',
   'QT Group Courts', 8, 'round_robin', 'setup', 2, 'qtgroupcourts'),
  ('b7000020-0000-4000-8000-000000000020', 'b7000001-0000-4000-8000-000000000001',
   'QT Group Courts Invalid', 4, 'round_robin', 'setup', 2, 'qtgroupcourtsbad'),
  ('b7000030-0000-4000-8000-000000000030', 'b7000001-0000-4000-8000-000000000001',
   'QT Group Courts Legacy Call', 4, 'round_robin', 'setup', 2, 'qtgroupcourtsold');

CREATE TEMP TABLE qt_gc_results (kind text PRIMARY KEY, result jsonb NOT NULL);
GRANT SELECT, INSERT, UPDATE ON qt_gc_results TO authenticated;
GRANT SELECT ON public.quick_tables, public.quick_table_players,
  public.quick_table_groups, public.quick_table_matches TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b7000001-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"b7000001-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- Bảng A (index 0) gán sân 2, bảng B (index 1) gán sân 1 — cố ý đảo thứ tự
-- so với sân nhà mặc định để chứng minh gán cứng thắng luật sân nhà.
INSERT INTO qt_gc_results VALUES (
  'pinned',
  public.setup_quick_table_roster_atomic(
    'b7000010-0000-4000-8000-000000000010',
    '[{"name":"A1"},{"name":"A2"},{"name":"A3"},{"name":"A4"},
      {"name":"B1"},{"name":"B2"},{"name":"B3"},{"name":"B4"}]'::jsonb,
    '[0,0,0,0,1,1,1,1]'::jsonb,
    '[1,2]'::jsonb,
    '08:00',
    '[2,1]'::jsonb
  )::jsonb
);
SELECT is((SELECT result ->> 'success' FROM qt_gc_results WHERE kind = 'pinned'),
  'true', 'setup with group court pins succeeds');
SELECT is(
  (SELECT count(*)::integer FROM public.quick_table_matches m
   JOIN public.quick_table_groups g ON g.id = m.group_id
   WHERE m.table_id = 'b7000010-0000-4000-8000-000000000010'
     AND NOT m.is_playoff
     AND ((g.name = 'A' AND m.court_id <> 2) OR (g.name = 'B' AND m.court_id <> 1))),
  0, 'every group-stage match is on its pinned court');
SELECT is(
  (SELECT group_courts::text FROM public.quick_tables
   WHERE id = 'b7000010-0000-4000-8000-000000000010'),
  '[2, 1]', 'pins are stored on quick_tables.group_courts');

-- Gán sai kiểu bị từ chối, không ghi gì.
INSERT INTO qt_gc_results VALUES (
  'invalid',
  public.setup_quick_table_roster_atomic(
    'b7000020-0000-4000-8000-000000000020',
    '[{"name":"W"},{"name":"X"},{"name":"Y"},{"name":"Z"}]'::jsonb,
    '[0,0,1,1]'::jsonb,
    '[1,2]'::jsonb,
    NULL,
    '["court-one"]'::jsonb
  )::jsonb
);
SELECT is((SELECT result ->> 'error' FROM qt_gc_results WHERE kind = 'invalid'),
  'INVALID_GROUP_COURTS', 'non-numeric pin is rejected');
SELECT is((SELECT count(*)::integer FROM public.quick_table_players
  WHERE table_id = 'b7000020-0000-4000-8000-000000000020'),
  0, 'rejected pin setup writes no players');

-- Client cũ gọi 5 tham số (không p_group_courts) vẫn chạy như trước.
INSERT INTO qt_gc_results VALUES (
  'legacy',
  public.setup_quick_table_roster_atomic(
    'b7000030-0000-4000-8000-000000000030',
    '[{"name":"W"},{"name":"X"},{"name":"Y"},{"name":"Z"}]'::jsonb,
    '[0,0,1,1]'::jsonb,
    '[1,2]'::jsonb,
    '09:00'
  )::jsonb
);
SELECT is((SELECT result ->> 'success' FROM qt_gc_results WHERE kind = 'legacy'),
  'true', 'legacy 5-argument call still succeeds');
SELECT is(
  (SELECT group_courts IS NULL FROM public.quick_tables
   WHERE id = 'b7000030-0000-4000-8000-000000000030'),
  true, 'legacy call leaves group_courts null');

SELECT * FROM finish();
ROLLBACK;

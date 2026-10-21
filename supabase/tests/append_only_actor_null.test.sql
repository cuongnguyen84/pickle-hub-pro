-- ============================================================================
-- Append-only ledgers must not hold delete-account hostage.
--
-- Four tables carry `actor_user_id … ON DELETE SET NULL` AND a BEFORE UPDATE
-- trigger that used to raise unconditionally. Deleting an account makes
-- Postgres issue exactly one UPDATE per row — actor_user_id → NULL, nothing
-- else — and the trigger refused it, so `auth.admin.deleteUser`
-- (supabase/functions/delete-account/index.ts:156) failed for anybody who had
-- ever left a trace in one of them.
--
-- Per table, three claims:
--   (a) an UPDATE that changes a BUSINESS column is still 42501;
--   (b) an UPDATE that only nulls actor_user_id goes through;
--   (c) DELETE FROM auth.users of somebody who wrote into that table succeeds,
--       and the history row is still there with actor_user_id IS NULL.
--
-- (c) is written with lives_ok rather than a bare DELETE on purpose: a raise
-- outside an exception block aborts the whole pgTAP transaction, and every
-- assertion after it reports a failure that says nothing about its own subject.
-- ============================================================================

BEGIN;

SELECT plan(16);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('0ac00001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'aan-owner@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0ac00002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'aan-editor@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  -- One deletable user PER TABLE. A single shared user would make one broken
  -- trigger fail all four deletions, and the report would not say which.
  ('0ac00003-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'aan-del-inv@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0ac00004-0000-4000-8000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'aan-del-sub@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0ac00005-0000-4000-8000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'aan-del-mod@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0ac00006-0000-4000-8000-000000000006'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'aan-del-con@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW());

INSERT INTO public.shops (id, slug, name, state, owner_user_id)
VALUES ('0ac0e001-0000-4000-8000-000000000001'::uuid, 'aan-shop', 'Shop Sổ Sách', 'active',
        '0ac00001-0000-4000-8000-000000000001'::uuid);

INSERT INTO public.products (id, shop_id, slug, title, description, category_slug)
VALUES ('0ac0f001-0000-4000-8000-000000000001'::uuid, '0ac0e001-0000-4000-8000-000000000001'::uuid,
        'aan-vot', 'Vợt Sổ Sách', 'Chỉ để có một dòng sổ.', 'vot');

INSERT INTO public.product_variants (id, product_id, shop_id, price_vnd, stock_on_hand, position)
VALUES ('0ac01001-0000-4000-8000-000000000001'::uuid, '0ac0f001-0000-4000-8000-000000000001'::uuid,
        '0ac0e001-0000-4000-8000-000000000001'::uuid, 100000, 10, 0);

INSERT INTO public.shop_contact_channels (id, shop_id, type, value_raw, value_normalized)
VALUES ('0ac0c001-0000-4000-8000-000000000001'::uuid, '0ac0e001-0000-4000-8000-000000000001'::uuid,
        'phone', '0912345678', '0912345678');

-- Two rows per table: one the "somebody is editing the books" assertions work
-- on, one owned by the user who is about to be deleted.

INSERT INTO public.inventory_movements (
  id, shop_id, variant_id, product_id, delta, on_hand_before, on_hand_after, reason, actor_user_id)
VALUES
  ('0acb0001-0000-4000-8000-000000000001'::uuid, '0ac0e001-0000-4000-8000-000000000001'::uuid,
   '0ac01001-0000-4000-8000-000000000001'::uuid, '0ac0f001-0000-4000-8000-000000000001'::uuid,
   10, 0, 10, 'opening', '0ac00002-0000-4000-8000-000000000002'::uuid),
  ('0acb0002-0000-4000-8000-000000000002'::uuid, '0ac0e001-0000-4000-8000-000000000001'::uuid,
   '0ac01001-0000-4000-8000-000000000001'::uuid, '0ac0f001-0000-4000-8000-000000000001'::uuid,
   -1, 10, 9, 'manual', '0ac00003-0000-4000-8000-000000000003'::uuid);

INSERT INTO public.product_submission_events (
  id, product_id, shop_id, event, from_status, to_status, actor_user_id)
VALUES
  ('0acb1001-0000-4000-8000-000000000001'::uuid, '0ac0f001-0000-4000-8000-000000000001'::uuid,
   '0ac0e001-0000-4000-8000-000000000001'::uuid, 'submitted', 'draft', 'pending_review',
   '0ac00002-0000-4000-8000-000000000002'::uuid),
  ('0acb1002-0000-4000-8000-000000000002'::uuid, '0ac0f001-0000-4000-8000-000000000001'::uuid,
   '0ac0e001-0000-4000-8000-000000000001'::uuid, 'resubmitted', 'needs_changes', 'pending_review',
   '0ac00004-0000-4000-8000-000000000004'::uuid);

INSERT INTO public.product_moderation_events (
  id, product_id, shop_id, decision, from_status, to_status, actor_user_id)
VALUES
  ('0acb2001-0000-4000-8000-000000000001'::uuid, '0ac0f001-0000-4000-8000-000000000001'::uuid,
   '0ac0e001-0000-4000-8000-000000000001'::uuid, 'approve', 'pending_review', 'approved',
   '0ac00002-0000-4000-8000-000000000002'::uuid),
  ('0acb2002-0000-4000-8000-000000000002'::uuid, '0ac0f001-0000-4000-8000-000000000001'::uuid,
   '0ac0e001-0000-4000-8000-000000000001'::uuid, 'unpublish', 'approved', 'approved',
   '0ac00005-0000-4000-8000-000000000005'::uuid);

INSERT INTO public.shop_contact_moderation_events (
  id, shop_id, contact_channel_id, action, from_state, to_state, channel_type, actor_user_id)
VALUES
  ('0acb3001-0000-4000-8000-000000000001'::uuid, '0ac0e001-0000-4000-8000-000000000001'::uuid,
   '0ac0c001-0000-4000-8000-000000000001'::uuid, 'approve', 'pending_review', 'approved', 'phone',
   '0ac00002-0000-4000-8000-000000000002'::uuid),
  ('0acb3002-0000-4000-8000-000000000002'::uuid, '0ac0e001-0000-4000-8000-000000000001'::uuid,
   '0ac0c001-0000-4000-8000-000000000001'::uuid, 'disable', 'approved', 'disabled', 'phone',
   '0ac00006-0000-4000-8000-000000000006'::uuid);

-- ─── inventory_movements ────────────────────────────────────────────────────

SELECT throws_ok(
  $$ UPDATE public.inventory_movements SET delta = delta - 1
     WHERE id = '0acb0001-0000-4000-8000-000000000001'::uuid $$,
  '42501', NULL, 'sổ kho: sửa một cột nghiệp vụ vẫn bị chặn 42501');

SELECT lives_ok(
  $$ UPDATE public.inventory_movements SET actor_user_id = NULL
     WHERE id = '0acb0001-0000-4000-8000-000000000001'::uuid $$,
  'sổ kho: UPDATE chỉ null hoá actor_user_id đi qua được');

SELECT lives_ok(
  $$ DELETE FROM auth.users WHERE id = '0ac00003-0000-4000-8000-000000000003'::uuid $$,
  'sổ kho: xoá tài khoản người từng ghi sổ KHÔNG bị trigger chặn');

SELECT ok(
  (SELECT actor_user_id IS NULL FROM public.inventory_movements
   WHERE id = '0acb0002-0000-4000-8000-000000000002'::uuid),
  'sổ kho: dòng sổ còn nguyên, chỉ mất danh tính người ghi');

-- ─── product_submission_events ──────────────────────────────────────────────

SELECT throws_ok(
  $$ UPDATE public.product_submission_events SET event = 'withdrawn'
     WHERE id = '0acb1001-0000-4000-8000-000000000001'::uuid $$,
  '42501', NULL, 'lịch sử gửi duyệt: sửa cột nghiệp vụ vẫn bị chặn 42501');

SELECT lives_ok(
  $$ UPDATE public.product_submission_events SET actor_user_id = NULL
     WHERE id = '0acb1001-0000-4000-8000-000000000001'::uuid $$,
  'lịch sử gửi duyệt: UPDATE chỉ null hoá actor_user_id đi qua được');

SELECT lives_ok(
  $$ DELETE FROM auth.users WHERE id = '0ac00004-0000-4000-8000-000000000004'::uuid $$,
  'lịch sử gửi duyệt: xoá tài khoản người từng gửi duyệt KHÔNG bị chặn');

SELECT ok(
  (SELECT actor_user_id IS NULL FROM public.product_submission_events
   WHERE id = '0acb1002-0000-4000-8000-000000000002'::uuid),
  'lịch sử gửi duyệt: dòng lịch sử còn nguyên');

-- ─── product_moderation_events ──────────────────────────────────────────────

SELECT throws_ok(
  $$ UPDATE public.product_moderation_events SET decision = 'reject'
     WHERE id = '0acb2001-0000-4000-8000-000000000001'::uuid $$,
  '42501', NULL, 'nhật ký kiểm duyệt sản phẩm: sửa cột nghiệp vụ vẫn bị chặn 42501');

SELECT lives_ok(
  $$ UPDATE public.product_moderation_events SET actor_user_id = NULL
     WHERE id = '0acb2001-0000-4000-8000-000000000001'::uuid $$,
  'nhật ký kiểm duyệt sản phẩm: UPDATE chỉ null hoá actor_user_id đi qua được');

SELECT lives_ok(
  $$ DELETE FROM auth.users WHERE id = '0ac00005-0000-4000-8000-000000000005'::uuid $$,
  'nhật ký kiểm duyệt sản phẩm: xoá tài khoản quản trị viên cũ KHÔNG bị chặn');

SELECT ok(
  (SELECT actor_user_id IS NULL FROM public.product_moderation_events
   WHERE id = '0acb2002-0000-4000-8000-000000000002'::uuid),
  'nhật ký kiểm duyệt sản phẩm: dòng nhật ký còn nguyên');

-- ─── shop_contact_moderation_events ─────────────────────────────────────────

SELECT throws_ok(
  $$ UPDATE public.shop_contact_moderation_events SET action = 'reject'
     WHERE id = '0acb3001-0000-4000-8000-000000000001'::uuid $$,
  '42501', NULL, 'nhật ký kênh liên hệ: sửa cột nghiệp vụ vẫn bị chặn 42501');

SELECT lives_ok(
  $$ UPDATE public.shop_contact_moderation_events SET actor_user_id = NULL
     WHERE id = '0acb3001-0000-4000-8000-000000000001'::uuid $$,
  'nhật ký kênh liên hệ: UPDATE chỉ null hoá actor_user_id đi qua được');

SELECT lives_ok(
  $$ DELETE FROM auth.users WHERE id = '0ac00006-0000-4000-8000-000000000006'::uuid $$,
  'nhật ký kênh liên hệ: xoá tài khoản người từng duyệt kênh KHÔNG bị chặn');

SELECT ok(
  (SELECT actor_user_id IS NULL FROM public.shop_contact_moderation_events
   WHERE id = '0acb3002-0000-4000-8000-000000000002'::uuid),
  'nhật ký kênh liên hệ: dòng nhật ký còn nguyên');

SELECT * FROM finish();
ROLLBACK;

-- Seller rules — versioned document + server-enforced acceptance (CP12).
--
-- The thing being proven is narrow and worth stating: BEFORE this migration,
-- shop_application_submit() validated five fields and never looked at consent,
-- while the UI checkbox sat there `disabled`. The checkbox was locked and the
-- submit was not. Every assertion below exists because that gap was real.
--
-- Convention follows shop_p2b_moderation.test.sql: this pgTAP build has no
-- *_policy helpers, so assert against catalogs and behaviour.

BEGIN;

SELECT plan(58);

-- ─── Fixture ────────────────────────────────────────────────────────────────
-- A: pilot applicant, the one who signs.  B: pilot applicant, never signs.
-- D: admin with a verified TOTP factor, so is_admin() genuinely demands aal2.

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('5e100001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rules-a@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Rules A"}'::jsonb, NOW(), NOW()),
  ('5e100002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rules-b@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Rules B"}'::jsonb, NOW(), NOW()),
  ('5e100004-0000-4000-8000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rules-admin@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Rules Admin"}'::jsonb, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role)
VALUES ('5e100004-0000-4000-8000-000000000004'::uuid, 'admin') ON CONFLICT DO NOTHING;

-- Without a verified factor admin_session_aal_ok() passes any session, and the
-- aal2 assertions below would prove nothing.
INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
VALUES ('5e10f001-0000-4000-8000-00000000f001'::uuid, '5e100004-0000-4000-8000-000000000004'::uuid,
        'test', 'totp', 'verified', NOW(), NOW(), 'TESTSECRET');

INSERT INTO public.shop_pilot_members (user_id) VALUES
  ('5e100001-0000-4000-8000-000000000001'::uuid),
  ('5e100002-0000-4000-8000-000000000002'::uuid);

CREATE TEMP TABLE t_rules (k TEXT PRIMARY KEY, v TEXT);
GRANT SELECT, INSERT ON t_rules TO authenticated, anon;

-- ─── Shape ──────────────────────────────────────────────────────────────────

SELECT has_table('public', 'legal_documents',   'a versioned document has a home');
SELECT has_table('public', 'legal_acceptances', 'and a signature has its own');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='legal_documents'),
          'RLS enabled on legal_documents');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='legal_acceptances'),
          'RLS enabled on legal_acceptances');
SELECT ok(NOT (SELECT has_table_privilege('authenticated','public.legal_acceptances','INSERT')),
          'nobody holding a user JWT may INSERT a signature — legal_accept() is the only writer');
SELECT ok(NOT (SELECT has_table_privilege('authenticated','public.legal_acceptances','UPDATE')),
          'nor UPDATE one');
SELECT ok(NOT (SELECT has_table_privilege('anon','public.legal_acceptances','SELECT')),
          'and the public cannot read who signed what');

-- Exactly one submit function. Two would make a no-argument call ambiguous —
-- 42725, which is how every approve/reject in this feature broke once before.
SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='shop_application_submit'),
  1, 'exactly one shop_application_submit — the zero-argument one was dropped, not left beside it');

-- ─── No document published: submission is blocked, not waved through ────────

INSERT INTO public.shop_applications (id, applicant_user_id, status, seller_type, full_name, phone, shop_name, city)
VALUES ('a0000001-0000-4000-8000-000000000001'::uuid, '5e100001-0000-4000-8000-000000000001'::uuid,
        'draft', 'ca-nhan', 'Nguyễn Văn A', '0901234567', 'Shop Rules A', 'Hà Nội');
INSERT INTO public.shop_applications (id, applicant_user_id, status, seller_type, full_name, phone, shop_name, city)
VALUES ('a0000002-0000-4000-8000-000000000002'::uuid, '5e100002-0000-4000-8000-000000000002'::uuid,
        'draft', 'ca-nhan', 'Trần Thị B', '0907654321', 'Shop Rules B', 'Đà Nẵng');

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5e100001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT throws_ok('SELECT public.shop_application_submit()', 'P0002', NULL,
  'no effective seller rules ⇒ nobody may submit (fail CLOSED, not open)');

SELECT throws_ok(
  $$SELECT public.legal_accept('seller-rules','v1','deadbeef')$$, 'P0002', NULL,
  'and nobody may sign a document that does not exist');

-- ─── Publish v1 ─────────────────────────────────────────────────────────────

RESET role;
INSERT INTO public.legal_documents (document_key, version, title, body, effective_at)
VALUES ('seller-rules', 'v1', 'Quy chế người bán (TEST)',
        repeat('Điều khoản thử nghiệm dùng cho pgTAP. Đây không phải văn bản pháp lý. ', 6),
        now() - interval '1 day');

-- A future version and a retired one, so "effective" is tested against
-- neighbours rather than against an empty table.
INSERT INTO public.legal_documents (document_key, version, title, body, effective_at)
VALUES ('seller-rules', 'v9', 'Quy chế người bán (TƯƠNG LAI)',
        repeat('Bản chưa tới hạn hiệu lực, không ai được ký. ', 8),
        now() + interval '30 days');
INSERT INTO public.legal_documents (document_key, version, title, body, effective_at, retired_at)
VALUES ('seller-rules', 'v0', 'Quy chế người bán (ĐÃ THU HỒI)',
        repeat('Bản cũ đã thu hồi, không còn là một lời mời ký. ', 8),
        now() - interval '10 days', now() - interval '2 days');

INSERT INTO t_rules
SELECT 'v1_hash', content_hash FROM public.legal_documents
WHERE document_key='seller-rules' AND version='v1';

SELECT is((SELECT version FROM public.legal_current_document('seller-rules')), 'v1',
  'the effective version is v1 — not the future one, not the retired one');

SELECT is(
  (SELECT content_hash FROM public.legal_documents WHERE document_key='seller-rules' AND version='v1'),
  encode(extensions.digest((SELECT body FROM public.legal_documents WHERE document_key='seller-rules' AND version='v1'), 'sha256'), 'hex'),
  'content_hash is generated from the body — it cannot claim to hash text it does not');

-- ─── Signing: every way of getting it wrong ─────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5e100001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT throws_ok(
  $$SELECT public.legal_accept('seller-rules','v0',(SELECT v FROM t_rules WHERE k='v1_hash'))$$,
  'PT409', NULL, 'a RETIRED version cannot be signed');

SELECT throws_ok(
  $$SELECT public.legal_accept('seller-rules','v9',(SELECT v FROM t_rules WHERE k='v1_hash'))$$,
  'PT409', NULL, 'a NOT-YET-EFFECTIVE version cannot be signed');

SELECT throws_ok(
  $$SELECT public.legal_accept('seller-rules','v1','0000000000000000000000000000000000000000000000000000000000000000')$$,
  'PT409', NULL, 'a hash that does not match the effective text is refused');

-- The submit still refuses, because none of the above wrote anything.
SELECT throws_ok('SELECT public.shop_application_submit()', '23514', NULL,
  'four failed attempts to sign leave the submit exactly as closed as it was');

-- ─── Signing correctly ──────────────────────────────────────────────────────

SELECT lives_ok(
  $$SELECT public.legal_accept('seller-rules','v1',(SELECT v FROM t_rules WHERE k='v1_hash'),'tok-a-1')$$,
  'the applicant signs the effective version');

SELECT is((SELECT count(*)::int FROM public.legal_acceptances
            WHERE user_id='5e100001-0000-4000-8000-000000000001'::uuid), 1,
  'one signature, one row');

SELECT is(
  (SELECT content_hash FROM public.legal_acceptances
    WHERE user_id='5e100001-0000-4000-8000-000000000001'::uuid),
  (SELECT v FROM t_rules WHERE k='v1_hash'),
  'the hash stored is the SERVER copy, not whatever the caller sent');

SELECT ok(
  (SELECT accepted_at FROM public.legal_acceptances
    WHERE user_id='5e100001-0000-4000-8000-000000000001'::uuid) <= now(),
  'accepted_at is server time — there is no parameter through which to forge it');

SELECT is(
  (SELECT application_id FROM public.legal_acceptances
    WHERE user_id='5e100001-0000-4000-8000-000000000001'::uuid),
  'a0000001-0000-4000-8000-000000000001'::uuid,
  'the application is stamped by the server from the caller''s own row, not accepted as an argument');

-- ─── Idempotency ────────────────────────────────────────────────────────────

SELECT is(
  (public.legal_accept('seller-rules','v1',(SELECT v FROM t_rules WHERE k='v1_hash'),'tok-a-1'))->>'replayed',
  'true', 'the same client token replays the first receipt');

SELECT is(
  (public.legal_accept('seller-rules','v1',(SELECT v FROM t_rules WHERE k='v1_hash'),'tok-a-2'))->>'replayed',
  'true', 'and a DIFFERENT token on an already-signed version replays too — one signature per version');

SELECT is((SELECT count(*)::int FROM public.legal_acceptances
            WHERE user_id='5e100001-0000-4000-8000-000000000001'::uuid), 1,
  'three calls, still one row');

-- ─── The submit now opens, and only for the person who signed ───────────────

SELECT is(public.shop_application_submit()::text, 'submitted',
  'having signed, the applicant may submit');

SELECT is(
  (SELECT status::text FROM public.shop_applications WHERE id='a0000001-0000-4000-8000-000000000001'::uuid),
  'submitted', 'and the row actually moved');

-- B never signed. Same version, same everything else.
SET LOCAL request.jwt.claims TO '{"sub":"5e100002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

SELECT throws_ok('SELECT public.shop_application_submit()', '23514', NULL,
  'B has not signed — B may not submit, and A''s signature does not help B');

SELECT is((SELECT count(*)::int FROM public.legal_acceptances
            WHERE user_id='5e100002-0000-4000-8000-000000000002'::uuid), 0,
  'a refused submit does not quietly create a signature for the refuser');

-- This is the whole point of putting the check inside the RPC: there is no
-- other door. Calling the function directly is what a client that skips the UI
-- does, and it is what this line is.
SELECT throws_ok('SELECT public.shop_application_submit(NULL)', '23514', NULL,
  'calling the submit RPC directly, with no UI in the picture, hits the same check');

-- ─── The version the client displayed must be the version in force ──────────

SELECT throws_ok(
  $$SELECT public.shop_application_submit('v0')$$, 'PT409', NULL,
  'a form that displayed a stale version is refused even by someone who HAS signed something');

-- ─── Resubmit: same version does not need a second signature ────────────────

RESET role;
SELECT set_config('shop.privileged_write', 'on', true);
UPDATE public.shop_applications SET status='needs_changes'
WHERE id='a0000001-0000-4000-8000-000000000001'::uuid;
SELECT set_config('shop.privileged_write', 'off', true);

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5e100001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT is(public.shop_application_submit()::text, 'submitted',
  'resubmitting the SAME version does not ask for a second signature');

SELECT is((SELECT count(*)::int FROM public.legal_acceptances
            WHERE user_id='5e100001-0000-4000-8000-000000000001'::uuid), 1,
  'and does not create one');

-- ─── A new effective version re-closes the door ─────────────────────────────

RESET role;
INSERT INTO public.legal_documents (document_key, version, title, body, effective_at)
VALUES ('seller-rules', 'v2', 'Quy chế người bán v2 (TEST)',
        repeat('Bản hai, nội dung khác hẳn bản một, dùng cho pgTAP. ', 8),
        now() - interval '1 hour');

SELECT set_config('shop.privileged_write', 'on', true);
UPDATE public.shop_applications SET status='needs_changes'
WHERE id='a0000001-0000-4000-8000-000000000001'::uuid;
SELECT set_config('shop.privileged_write', 'off', true);

INSERT INTO t_rules
SELECT 'v2_hash', content_hash FROM public.legal_documents
WHERE document_key='seller-rules' AND version='v2';

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5e100001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT is((SELECT version FROM public.legal_current_document('seller-rules')), 'v2',
  'v2 is now the effective version');

SELECT throws_ok('SELECT public.shop_application_submit()', '23514', NULL,
  'a NEW effective version re-closes the door on someone who only signed v1');

SELECT throws_ok(
  $$SELECT public.legal_accept('seller-rules','v1',(SELECT v FROM t_rules WHERE k='v1_hash'))$$,
  'PT409', NULL, 'and they cannot re-sign the old version to get back in');

SELECT lives_ok(
  $$SELECT public.legal_accept('seller-rules','v2',(SELECT v FROM t_rules WHERE k='v2_hash'),'tok-a-v2')$$,
  'they sign v2');

SELECT is(public.shop_application_submit('v2')::text, 'submitted',
  'and only then may they resubmit');

SELECT is((SELECT count(*)::int FROM public.legal_acceptances
            WHERE user_id='5e100001-0000-4000-8000-000000000001'::uuid), 2,
  'both signatures are kept — the v1 one is still evidence of what they agreed to then');

-- ─── Reading a receipt ──────────────────────────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"5e100002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

SELECT is((SELECT count(*)::int FROM public.legal_acceptances
            WHERE user_id='5e100001-0000-4000-8000-000000000001'::uuid), 0,
  'another seller cannot read A''s signatures — RLS, not a missing query');

SELECT throws_ok(
  $$SELECT public.shop_application_rules_receipt('a0000001-0000-4000-8000-000000000001'::uuid)$$,
  '42501', NULL, 'nor read A''s receipt through the RPC');

SET LOCAL request.jwt.claims TO '{"sub":"5e100004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  $$SELECT public.shop_application_rules_receipt('a0000001-0000-4000-8000-000000000001'::uuid)$$,
  '42501', NULL, 'an admin at aal1 cannot read it either — is_admin() means aal2');

SET LOCAL request.jwt.claims TO '{"sub":"5e100004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
SELECT is(
  (public.shop_application_rules_receipt('a0000001-0000-4000-8000-000000000001'::uuid))->>'version',
  'v2', 'at aal2 the moderator sees which version was accepted');
SELECT is(
  (public.shop_application_rules_receipt('a0000001-0000-4000-8000-000000000001'::uuid))->>'content_hash',
  (SELECT v FROM t_rules WHERE k='v2_hash'), 'and the hash they can check it against');
SELECT ok(
  ((public.shop_application_rules_receipt('a0000001-0000-4000-8000-000000000001'::uuid))->>'accepted_at') IS NOT NULL,
  'and when');

SELECT is(
  (public.shop_application_rules_receipt('a0000002-0000-4000-8000-000000000002'::uuid))->>'accepted',
  'false', 'for an applicant who never signed, the receipt says so plainly');

-- ─── Append-only, and immutable ─────────────────────────────────────────────

RESET role;

SELECT throws_ok(
  $$UPDATE public.legal_acceptances SET accepted_at = now() - interval '1 year'$$,
  '42501', NULL, 'a signature cannot be back-dated, by anyone');

SELECT throws_ok(
  $$UPDATE public.legal_acceptances SET version = 'v1'$$,
  '42501', NULL, 'nor moved to a different version');

SELECT throws_ok(
  $$UPDATE public.legal_acceptances
      SET application_id = 'a0000002-0000-4000-8000-000000000002'::uuid$$,
  '42501', NULL, 'nor re-pointed at somebody else''s application');

-- The one permitted UPDATE, and only because the FK does it: deleting an
-- application detaches the evidence pointer. Blocking this made every
-- `DELETE FROM shop_applications` fail — found by the browser acceptance run,
-- which is the only thing here that tears a real fixture down.
SELECT lives_ok(
  $$DELETE FROM public.shop_applications WHERE id='a0000001-0000-4000-8000-000000000001'::uuid$$,
  'deleting an application detaches the signature instead of being refused');

SELECT is(
  (SELECT count(*)::int FROM public.legal_acceptances
    WHERE user_id='5e100001-0000-4000-8000-000000000001'::uuid),
  2, 'and the signatures themselves survive it — they belong to the person, not the form');

SELECT is(
  (SELECT count(*)::int FROM public.legal_acceptances
    WHERE user_id='5e100001-0000-4000-8000-000000000001'::uuid AND application_id IS NOT NULL),
  0, 'with the pointer nulled, not dangling');

SELECT throws_ok(
  $$UPDATE public.legal_documents SET body = body || ' thêm một câu' WHERE version='v1'$$,
  '42501', NULL,
  'a document version cannot be edited in place — that would rewrite what people already signed');

SELECT throws_ok(
  $$UPDATE public.legal_documents SET effective_at = now() WHERE version='v1'$$,
  '42501', NULL, 'nor can its effective date be moved under a signature');

SELECT throws_ok(
  $$DELETE FROM public.legal_documents WHERE version='v1'$$,
  '42501', NULL, 'nor can a signed version be deleted');

SELECT lives_ok(
  $$UPDATE public.legal_documents SET retired_at = now() + interval '1 day' WHERE version='v1'$$,
  'retiring it IS allowed — that is how a version stops being offered');

SELECT throws_ok(
  $$UPDATE public.legal_documents SET retired_at = NULL WHERE version='v1'$$,
  '42501', NULL, 'but un-retiring is not');

SELECT lives_ok(
  $$DELETE FROM public.legal_documents WHERE version='v9'$$,
  'an unsigned version may be deleted — nothing depends on it');

-- ─── Deleting the person deletes the signature ──────────────────────────────
-- A signature that outlives the account is a retention bug, not evidence. This
-- also keeps account deletion and the QA teardown working.

SELECT lives_ok(
  $$DELETE FROM auth.users WHERE id='5e100002-0000-4000-8000-000000000002'::uuid$$,
  'a user can still be deleted with the append-only trigger in place');

SELECT * FROM finish();
ROLLBACK;

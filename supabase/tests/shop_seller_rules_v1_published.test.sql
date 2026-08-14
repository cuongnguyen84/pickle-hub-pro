-- The published "Quy chế người bán v1" — CP15.
--
-- shop_seller_rules_acceptance.test.sql proves the MACHINERY with a fixture
-- document it publishes and deletes. This file proves the opposite thing: that
-- the row migration 20260814100000 actually left in the database is the
-- document the Product Owner approved on 2026-08-13, with the fields they
-- decided, and that it cannot be quietly edited afterwards.
--
-- No fixture, deliberately. Every assertion reads what the migration wrote,
-- because a test that first inserts its own row would prove nothing about the
-- one real sellers will be asked to sign.
--
-- The one thing NOT asserted here is "the submit now works". effective_at is a
-- wall-clock fact, and an assertion that flips at midnight is a test that
-- reports the date rather than the behaviour — so §"On offer" below states the
-- rule in the only form that is true at every hour.

BEGIN;

SELECT plan(19);

-- ─── The row the migration published ────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.legal_documents
    WHERE document_key = 'seller-rules' AND version = 'v1'),
  1,
  'seller-rules v1 is published exactly once');

SELECT is(
  (SELECT scope FROM public.legal_documents WHERE document_key='seller-rules' AND version='v1'),
  'closed-pilot',
  'scoped to the closed pilot — the public launch gets its own version, not this one by default');

SELECT is(
  (SELECT title FROM public.legal_documents WHERE document_key='seller-rules' AND version='v1'),
  'Quy chế người bán v1 — Closed Pilot',
  'titled with the document''s own heading');

SELECT is(
  (SELECT approved_by FROM public.legal_documents WHERE document_key='seller-rules' AND version='v1'),
  'Cuong Nguyen — Product Owner, ThePickleHub',
  'approved by the Product Owner, by name');

SELECT is(
  (SELECT approved_at FROM public.legal_documents WHERE document_key='seller-rules' AND version='v1'),
  '2026-08-13 07:30:00+07'::timestamptz,
  'approved at the moment the decision was executed');

SELECT is(
  (SELECT effective_at FROM public.legal_documents WHERE document_key='seller-rules' AND version='v1'),
  '2026-08-14 00:00:00+07'::timestamptz,
  'in force from midnight 14/08/2026, Vietnam time');

SELECT ok(
  (SELECT effective_at >= approved_at FROM public.legal_documents
    WHERE document_key='seller-rules' AND version='v1'),
  'and not one second before it was approved');

SELECT is(
  (SELECT retired_at FROM public.legal_documents WHERE document_key='seller-rules' AND version='v1'),
  NULL::timestamptz,
  'not retired');

-- ─── The text ───────────────────────────────────────────────────────────────
-- The hash is the load-bearing one: every acceptance in legal_acceptances is
-- matched against it, so if this value is not the sha256 of the approved file
-- then every signature is a signature on something else.

SELECT is(
  (SELECT content_hash FROM public.legal_documents WHERE document_key='seller-rules' AND version='v1'),
  'fb62bd471d7b6b27c53d9eeded57dd636aa2f1f1f03db9a4a20abd49d7c70c98',
  'content_hash is the sha256 of the approved file');

SELECT is(
  (SELECT content_hash FROM public.legal_documents WHERE document_key='seller-rules' AND version='v1'),
  (SELECT encode(extensions.digest(body, 'sha256'), 'hex') FROM public.legal_documents
    WHERE document_key='seller-rules' AND version='v1'),
  'and it is genuinely computed from the body stored beside it');

-- char_length, not octet_length: the document is Vietnamese, so bytes run
-- roughly 30% ahead of characters and a byte threshold copied from `wc -c`
-- would be measuring the encoding rather than the text. The exact content is
-- already pinned by the hash above; this is only here so a truncated or
-- placeholder body is obvious at a glance.
SELECT ok(
  (SELECT char_length(body) > 20000 FROM public.legal_documents
    WHERE document_key='seller-rules' AND version='v1'),
  'the body is the full document, not a placeholder or a link to one');

SELECT ok(
  (SELECT body LIKE '%## 20. Hiệu lực và phê duyệt%' FROM public.legal_documents
    WHERE document_key='seller-rules' AND version='v1'),
  'it carries its own approval section');

SELECT ok(
  (SELECT body LIKE '%tapickleballvn@gmail.com%' FROM public.legal_documents
    WHERE document_key='seller-rules' AND version='v1'),
  'and the official support channel a seller is told to use');

SELECT ok(
  (SELECT body NOT LIKE '%[TEST-ONLY]%' FROM public.legal_documents
    WHERE document_key='seller-rules' AND version='v1'),
  'a QA document has not been published in its place');

SELECT ok(
  (SELECT body NOT LIKE '%' || content_hash || '%' FROM public.legal_documents
    WHERE document_key='seller-rules' AND version='v1'),
  'the text does not contain its own hash — it could not, and claiming to would be false');

-- ─── On offer ───────────────────────────────────────────────────────────────
-- True before midnight on 14/08 and true after it: what is being asserted is
-- the gate, not the hour it happens to be run at.

SELECT is(
  (SELECT version FROM public.legal_current_document('seller-rules')),
  CASE
    WHEN now() >= (SELECT effective_at FROM public.legal_documents
                    WHERE document_key='seller-rules' AND version='v1')
    THEN 'v1'
  END,
  'v1 is the document on offer exactly when its effective time has arrived, and not before');

-- ─── Immutable now that it is approved ──────────────────────────────────────
-- Running as the migration role, so RLS is out of the picture and what refuses
-- these is the trigger — which is the point: there is no privilege level at
-- which the text people signed can be edited underneath them.

SELECT throws_ok(
  $$UPDATE public.legal_documents SET body = body || ' thêm một điều khoản'
     WHERE document_key='seller-rules' AND version='v1'$$,
  '42501', NULL,
  'the approved text cannot be edited in place');

SELECT throws_ok(
  $$UPDATE public.legal_documents SET effective_at = now()
     WHERE document_key='seller-rules' AND version='v1'$$,
  '42501', NULL,
  'nor brought forward to take effect early');

SELECT throws_ok(
  $$UPDATE public.legal_documents SET approved_by = 'ai đó khác'
     WHERE document_key='seller-rules' AND version='v1'$$,
  '42501', NULL,
  'nor re-attributed to somebody who did not approve it');

SELECT * FROM finish();
ROLLBACK;

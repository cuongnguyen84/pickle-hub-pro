BEGIN;
SELECT plan(12);
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES ('00000000-0000-0000-0000-00000000f093','00000000-0000-0000-0000-000000000000','authenticated','authenticated','publication-fixture@thepicklehub.test','',now(),'{"provider":"test","providers":["test"]}','{"display_name":"Publication Fixture"}',now(),now());

INSERT INTO public.social_events(id,slug,title_vi,start_at,end_at,created_by,status,first_published_at)
VALUES ('00000000-0000-0000-0000-00000000e093','publication-draft-fixture','Draft',now()+interval '1 day',now()+interval '1 day 2 hours','00000000-0000-0000-0000-00000000f093','draft','2000-01-01'),
('00000000-0000-0000-0000-00000000e094','publication-live-fixture','Live',now()+interval '1 day',now()+interval '1 day 2 hours','00000000-0000-0000-0000-00000000f093','published','2000-01-01');

SELECT ok((SELECT first_published_at IS NULL FROM public.social_events WHERE slug='publication-draft-fixture'),'draft insert ignores spoofed timestamp');
SELECT ok((SELECT first_published_at IS NOT NULL FROM public.social_events WHERE slug='publication-live-fixture'),'published insert stamped');
SELECT ok((SELECT first_published_at >= transaction_timestamp() FROM public.social_events WHERE slug='publication-live-fixture'),'published insert uses server clock');
UPDATE public.social_events SET first_published_at='2000-01-01' WHERE slug='publication-draft-fixture';
SELECT ok((SELECT first_published_at IS NULL FROM public.social_events WHERE slug='publication-draft-fixture'),'draft timestamp spoof rejected');
UPDATE public.social_events SET status='published', first_published_at='2000-01-01' WHERE slug='publication-draft-fixture';
SELECT ok((SELECT first_published_at >= transaction_timestamp() FROM public.social_events WHERE slug='publication-draft-fixture'),'draft transition stamped by server');
CREATE TEMP TABLE publication_expected AS SELECT id,first_published_at FROM public.social_events WHERE slug IN ('publication-draft-fixture','publication-live-fixture');
UPDATE public.social_events SET title_vi='Changed' WHERE slug='publication-draft-fixture';
SELECT is((SELECT first_published_at FROM public.social_events WHERE slug='publication-draft-fixture'),(SELECT first_published_at FROM publication_expected WHERE id='00000000-0000-0000-0000-00000000e093'),'ordinary update preserves timestamp');
UPDATE public.social_events SET status='draft',first_published_at=NULL WHERE slug='publication-draft-fixture';
SELECT is((SELECT first_published_at FROM public.social_events WHERE slug='publication-draft-fixture'),(SELECT first_published_at FROM publication_expected WHERE id='00000000-0000-0000-0000-00000000e093'),'unpublish cannot clear timestamp');
UPDATE public.social_events SET status='published',first_published_at='2000-01-01' WHERE slug='publication-draft-fixture';
SELECT is((SELECT first_published_at FROM public.social_events WHERE slug='publication-draft-fixture'),(SELECT first_published_at FROM publication_expected WHERE id='00000000-0000-0000-0000-00000000e093'),'republish cannot replace timestamp');
UPDATE public.social_events SET first_published_at=NULL WHERE slug='publication-live-fixture';
SELECT is((SELECT first_published_at FROM public.social_events WHERE slug='publication-live-fixture'),(SELECT first_published_at FROM publication_expected WHERE id='00000000-0000-0000-0000-00000000e094'),'cannot clear direct-publish timestamp');

-- Simulate a pre-rollout published row without inventing a historical date.
ALTER TABLE public.social_events DISABLE TRIGGER stamp_social_event_first_publication;
UPDATE public.social_events SET first_published_at=NULL WHERE slug='publication-live-fixture';
ALTER TABLE public.social_events ENABLE TRIGGER stamp_social_event_first_publication;
UPDATE public.social_events SET title_vi='Historical' WHERE slug='publication-live-fixture';
SELECT ok((SELECT first_published_at IS NULL FROM public.social_events WHERE slug='publication-live-fixture'),'historical published ordinary update stays unknown');
UPDATE public.social_events SET status='draft' WHERE slug='publication-live-fixture';
SELECT ok((SELECT first_published_at IS NULL FROM public.social_events WHERE slug='publication-live-fixture'),'historical unpublish stays unknown');
UPDATE public.social_events SET status='published' WHERE slug='publication-live-fixture';
SELECT ok((SELECT first_published_at >= transaction_timestamp() FROM public.social_events WHERE slug='publication-live-fixture'),'historical republish records first observed transition only');
SELECT * FROM finish();
ROLLBACK;

BEGIN;
SELECT plan(12);
INSERT INTO auth.users(id, email, raw_user_meta_data)
VALUES ('f6200000-0000-4000-8000-000000000001','token-lifecycle@thepicklehub.test','{}');
INSERT INTO public.profiles(id,email,display_name)
VALUES ('f6200000-0000-4000-8000-000000000001','token-lifecycle@thepicklehub.test','Fixture')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.social_events(id,slug,title_vi,start_at,end_at,created_by)
VALUES ('f6200000-0000-4000-8000-000000000002','token-lifecycle-fixture','Fixture',now()+interval '1 day',now()+interval '2 days','f6200000-0000-4000-8000-000000000001');
INSERT INTO public.event_registrations(id,event_id,profile_id)
VALUES ('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000002','f6200000-0000-4000-8000-000000000001');
INSERT INTO public.registration_secrets(registration_id,magic_token,expires_at)
VALUES ('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000004',now()+interval '1 day');
SELECT ok(NOT has_function_privilege('anon','public.registration_token_is_valid(uuid,uuid)','EXECUTE'),'anon cannot probe validity');
SELECT ok(NOT has_function_privilege('authenticated','public.registration_token_is_valid(uuid,uuid)','EXECUTE'),'members cannot probe validity');
SELECT ok(has_function_privilege('service_role','public.registration_token_is_valid(uuid,uuid)','EXECUTE'),'service can authorize');
SELECT ok(public.registration_token_is_valid('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000004'),'valid guest token accepted');
SELECT ok(NOT public.registration_token_is_valid('f6200000-0000-4000-8000-000000000005','f6200000-0000-4000-8000-000000000004'),'wrong registration denied');
SELECT ok(NOT public.registration_token_is_valid('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000005'),'wrong token denied');
SELECT ok(NOT public.registration_token_is_valid(NULL,NULL),'null inputs denied');
UPDATE public.registration_secrets SET expires_at=NULL WHERE registration_id='f6200000-0000-4000-8000-000000000003';
SELECT ok(NOT public.registration_token_is_valid('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000004'),'null expiry denied');
UPDATE public.registration_secrets SET expires_at=statement_timestamp() WHERE registration_id='f6200000-0000-4000-8000-000000000003';
SELECT ok(NOT public.registration_token_is_valid('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000004'),'expiry equal to earlier statement denied');
UPDATE public.registration_secrets SET expires_at='infinity' WHERE registration_id='f6200000-0000-4000-8000-000000000003';
SELECT ok(NOT public.registration_token_is_valid('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000004'),'infinite expiry denied');
UPDATE public.registration_secrets SET expires_at=now()-interval '1 day' WHERE registration_id='f6200000-0000-4000-8000-000000000003';
SELECT ok(NOT public.registration_token_is_valid('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000004'),'expired denied');
UPDATE public.registration_secrets SET expires_at=now()+interval '1 day' WHERE registration_id='f6200000-0000-4000-8000-000000000003';
UPDATE public.event_registrations SET cancelled_at=now(),status='cancelled' WHERE id='f6200000-0000-4000-8000-000000000003';
SELECT ok(public.registration_token_is_valid('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000004'),'cancelled status is caller policy, preserving reactivation authorization');
SELECT * FROM finish();
ROLLBACK;

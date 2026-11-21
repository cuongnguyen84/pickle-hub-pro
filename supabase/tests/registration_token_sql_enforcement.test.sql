BEGIN;
SELECT plan(25);
INSERT INTO auth.users(id, email, raw_user_meta_data)
VALUES ('f6200000-0000-4000-8000-000000000001','token-lifecycle@thepicklehub.test','{}');
INSERT INTO public.profiles(id,email,display_name)
VALUES ('f6200000-0000-4000-8000-000000000001','token-lifecycle@thepicklehub.test','Fixture')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.social_events(id,slug,title_vi,start_at,end_at,created_by)
VALUES ('f6200000-0000-4000-8000-000000000002','token-lifecycle-fixture','Fixture',now()+interval '1 day',now()+interval '2 days','f6200000-0000-4000-8000-000000000001');
INSERT INTO public.event_registrations(id,event_id,profile_id,display_name)
VALUES ('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000002','f6200000-0000-4000-8000-000000000001','Fixture');
INSERT INTO public.registration_secrets(registration_id,magic_token,expires_at)
VALUES ('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000004',now()+interval '1 day');

UPDATE public.event_registrations SET phone='+84901234567' WHERE id='f6200000-0000-4000-8000-000000000003';
SET LOCAL ROLE anon;
SELECT is((SELECT count(*)::int FROM public.get_registration_by_token('f6200000-0000-4000-8000-000000000004')),1,'valid registration read preserved');
SELECT is((SELECT count(*)::int FROM public.get_my_event_dupr_by_token('f6200000-0000-4000-8000-000000000004')),1,'valid DUPR read preserved');
SELECT lives_ok($$ SELECT public.link_event_dupr_id_by_token('f6200000-0000-4000-8000-000000000004','TEST01') $$,'valid DUPR write preserved');
SELECT lives_ok($$ SELECT public.update_profile_contact_from_magic('f6200000-0000-4000-8000-000000000004','owner@example.test') $$,'valid contact write preserved');
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT is((SELECT count(*)::int FROM public.find_registrations_by_phone('+84901234567')),1,'valid service recovery lookup preserved');
RESET ROLE;
UPDATE public.registration_secrets SET expires_at=now()-interval '1 day' WHERE registration_id='f6200000-0000-4000-8000-000000000003';
SET LOCAL ROLE anon;
SELECT is((SELECT count(*)::int FROM public.get_registration_by_token('f6200000-0000-4000-8000-000000000004')),0,'expired registration read denied');
SELECT is((SELECT count(*)::int FROM public.get_my_event_dupr_by_token('f6200000-0000-4000-8000-000000000004')),0,'expired DUPR read denied');
SELECT throws_ok($$ SELECT public.link_event_dupr_id_by_token('f6200000-0000-4000-8000-000000000004','TEST01') $$,'P0002',NULL,'expired DUPR write denied');
SELECT throws_ok($$ SELECT public.update_profile_contact_from_magic('f6200000-0000-4000-8000-000000000004','attacker@example.test') $$,'P0002',NULL,'expired contact write denied');
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT is((SELECT count(*)::int FROM public.find_registrations_by_phone('+84901234567')),0,'expired recovery lookup denied');
RESET ROLE;
UPDATE public.registration_secrets SET expires_at=NULL WHERE registration_id='f6200000-0000-4000-8000-000000000003';
SET LOCAL ROLE anon;
SELECT is((SELECT count(*)::int FROM public.get_registration_by_token('f6200000-0000-4000-8000-000000000004')),0,'null registration read denied');
SELECT is((SELECT count(*)::int FROM public.get_my_event_dupr_by_token('f6200000-0000-4000-8000-000000000004')),0,'null DUPR read denied');
SELECT throws_ok($$ SELECT public.link_event_dupr_id_by_token('f6200000-0000-4000-8000-000000000004','TEST01') $$,'P0002',NULL,'null DUPR write denied');
SELECT throws_ok($$ SELECT public.update_profile_contact_from_magic('f6200000-0000-4000-8000-000000000004','attacker@example.test') $$,'P0002',NULL,'null contact write denied');
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT is((SELECT count(*)::int FROM public.find_registrations_by_phone('+84901234567')),0,'null recovery lookup denied');
RESET ROLE;
UPDATE public.registration_secrets SET expires_at=now()+interval '1 day' WHERE registration_id='f6200000-0000-4000-8000-000000000003';
SET LOCAL ROLE anon;
SELECT is((SELECT count(*)::int FROM public.get_registration_by_token('f6200000-0000-4000-8000-000000000005')),0,'wrong-token registration read denied');
SELECT is((SELECT count(*)::int FROM public.get_my_event_dupr_by_token('f6200000-0000-4000-8000-000000000005')),0,'wrong-token DUPR read denied');
SELECT throws_ok($$ SELECT public.link_event_dupr_id_by_token('f6200000-0000-4000-8000-000000000005','TEST01') $$,'P0002',NULL,'wrong-token DUPR write denied');
SELECT throws_ok($$ SELECT public.update_profile_contact_from_magic('f6200000-0000-4000-8000-000000000005','attacker@example.test') $$,'P0002',NULL,'wrong-token contact write denied');
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT ok(NOT public.registration_token_is_valid('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000005'),'wrong token cannot satisfy scoped predicate');
RESET ROLE;
UPDATE public.registration_secrets SET expires_at=now()+interval '1 day' WHERE registration_id='f6200000-0000-4000-8000-000000000003';
UPDATE public.event_registrations SET cancelled_at=now(),status='cancelled' WHERE id='f6200000-0000-4000-8000-000000000003';
SET LOCAL ROLE anon;
SELECT is((SELECT count(*)::int FROM public.get_registration_by_token('f6200000-0000-4000-8000-000000000004')),1,'valid cancelled registration remains readable for reactivation');
SELECT throws_ok($$ SELECT public.link_event_dupr_id_by_token('f6200000-0000-4000-8000-000000000004','TEST01') $$,'P0002',NULL,'existing cancelled DUPR write restriction preserved');
RESET ROLE;
SELECT ok(NOT has_function_privilege('anon','public.registration_token_is_valid(uuid,uuid)','EXECUTE'),'helper not public');
SELECT ok(NOT has_function_privilege('authenticated','public.registration_token_is_valid(uuid,uuid)','EXECUTE'),'helper not member-callable');
SELECT ok(position('pg_advisory_xact_lock' in pg_get_functiondef('public.register_event_as_member(uuid,text)'::regprocedure)) > 0,'JWT issuer capacity lock retained');
SELECT * FROM finish();
ROLLBACK;

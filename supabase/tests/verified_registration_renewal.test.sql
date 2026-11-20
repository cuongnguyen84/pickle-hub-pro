BEGIN;
SELECT plan(23);
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

UPDATE auth.users SET email_confirmed_at=now() WHERE id='f6200000-0000-4000-8000-000000000001';
UPDATE public.event_registrations SET phone='+84901234567' WHERE id='f6200000-0000-4000-8000-000000000003';
CREATE TEMP TABLE renewal_results(label text,payload jsonb);
GRANT ALL ON renewal_results TO service_role;
SET LOCAL ROLE service_role;
SELECT is((SELECT count(*)::int FROM public.renew_registration_token_by_phone('+84901234567','f6200000-0000-4000-8000-000000000002',repeat('a',64))),0,'legacy/no dedicated proof cannot renew');
SELECT is((SELECT count(*)::int FROM public.renew_registration_token_by_owner('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000099')),0,'wrong session owner denied');
INSERT INTO renewal_results SELECT 'owner',to_jsonb(x) FROM public.renew_registration_token_by_owner('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000001') x;
SELECT is((SELECT payload->>'magic_token' FROM renewal_results WHERE label='owner'),'f6200000-0000-4000-8000-000000000004','valid owner recovery preserves existing token');
RESET ROLE;
UPDATE public.registration_secrets SET expires_at=now()-interval '1 day' WHERE registration_id='f6200000-0000-4000-8000-000000000003';
SET LOCAL ROLE service_role;
INSERT INTO renewal_results SELECT 'request',to_jsonb(x) FROM public.begin_registration_renewal('+84901234567','f6200000-0000-4000-8000-000000000002',repeat('b',64),repeat('a',64)) x;
SELECT is((SELECT magic_token::text FROM public.registration_secrets WHERE registration_id='f6200000-0000-4000-8000-000000000003'),'f6200000-0000-4000-8000-000000000004','public challenge request does not rotate');
SELECT is((SELECT count(*)::int FROM public.renew_registration_token_by_phone('+84901234567','f6200000-0000-4000-8000-000000000002',repeat('a',64))),0,'provider failure/undelivered proof cannot renew');
UPDATE public.registration_renewal_challenges SET delivered_at=now() WHERE phone='+84901234567';
SELECT is((SELECT count(*)::int FROM public.renew_registration_token_by_phone('+84909999999','f6200000-0000-4000-8000-000000000002',repeat('a',64))),0,'wrong phone denied');
SELECT is((SELECT count(*)::int FROM public.renew_registration_token_by_phone('+84901234567','f6200000-0000-4000-8000-000000000099',repeat('a',64))),0,'wrong event denied');
INSERT INTO renewal_results SELECT 'renewed',to_jsonb(x) FROM public.renew_registration_token_by_phone('+84901234567','f6200000-0000-4000-8000-000000000002',repeat('a',64)) x;
SELECT is((SELECT (payload->>'rotated')::boolean FROM renewal_results WHERE label='renewed'),true,'expired credential renewed after phone proof');
SELECT ok((SELECT payload->>'magic_token' FROM renewal_results WHERE label='renewed')<>'f6200000-0000-4000-8000-000000000004','old credential replaced');
SELECT is((SELECT count(*)::int FROM public.renew_registration_token_by_phone('+84901234567','f6200000-0000-4000-8000-000000000002',repeat('a',64))),0,'consumed proof replay denied');
INSERT INTO renewal_results SELECT 'owner-retry',to_jsonb(x) FROM public.renew_registration_token_by_owner('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000001') x;
SELECT is((SELECT payload->>'magic_token' FROM renewal_results WHERE label='owner-retry'),(SELECT payload->>'magic_token' FROM renewal_results WHERE label='renewed'),'verified retry converges without revocation');
INSERT INTO public.registration_renewal_challenges(registration_id,phone,ip_hash,code_hash,delivered_at) VALUES('f6200000-0000-4000-8000-000000000003','+84901234567',repeat('c',64),repeat('d',64),now());
SELECT is((SELECT count(*)::int FROM public.renew_registration_token_by_phone('+84901234567','f6200000-0000-4000-8000-000000000002',repeat('e',64))),0,'wrong code attempt1 denied');
SELECT is((SELECT count(*)::int FROM public.renew_registration_token_by_phone('+84901234567','f6200000-0000-4000-8000-000000000002',repeat('e',64))),0,'wrong code attempt2 denied');
SELECT is((SELECT count(*)::int FROM public.renew_registration_token_by_phone('+84901234567','f6200000-0000-4000-8000-000000000002',repeat('e',64))),0,'wrong code attempt3 denied');
SELECT is((SELECT count(*)::int FROM public.renew_registration_token_by_phone('+84901234567','f6200000-0000-4000-8000-000000000002',repeat('d',64))),0,'correct code after attempt exhaustion denied');
RESET ROLE;
SELECT ok(NOT has_function_privilege('anon','public.begin_registration_renewal(text,uuid,text,text)','EXECUTE'),'public cannot mint phone proof');
SELECT ok(NOT has_function_privilege('authenticated','public.renew_registration_token_by_owner(uuid,uuid)','EXECUTE'),'member cannot forge service owner parameter');
SELECT ok(NOT has_function_privilege('service_role','public.issue_verified_registration_token(uuid)','EXECUTE'),'service cannot bypass proof with internal primitive');
SELECT is((SELECT count(*)::int FROM public.event_registrations WHERE id='f6200000-0000-4000-8000-000000000003'),1,'renewal creates no duplicate registration');
SET LOCAL ROLE service_role;
SELECT is((SELECT count(*)::int FROM public.begin_registration_renewal('+84901234567','f6200000-0000-4000-8000-000000000002',repeat('f',64),repeat('a',64))),1,'third phone reservation allowed');
SELECT is((SELECT count(*)::int FROM public.begin_registration_renewal('+84901234567','f6200000-0000-4000-8000-000000000002',repeat('f',64),repeat('a',64))),0,'fourth phone reservation blocked before provider cost');
UPDATE public.registration_renewal_challenges SET used_at=now() WHERE used_at IS NULL;
INSERT INTO public.registration_renewal_challenges(registration_id,phone,ip_hash,code_hash,delivered_at,expires_at)
VALUES('f6200000-0000-4000-8000-000000000003','+84901234567',repeat('f',64),repeat('a',64),now(),now()-interval '1 minute');
SELECT is((SELECT count(*)::int FROM public.renew_registration_token_by_phone('+84901234567','f6200000-0000-4000-8000-000000000002',repeat('a',64))),0,'expired delivered code denied');
RESET ROLE;
UPDATE auth.users SET email_confirmed_at=NULL,phone_confirmed_at=NULL WHERE id='f6200000-0000-4000-8000-000000000001';
SET LOCAL ROLE service_role;
SELECT is((SELECT count(*)::int FROM public.renew_registration_token_by_owner('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000001')),0,'unconfirmed account not ownership proof');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;

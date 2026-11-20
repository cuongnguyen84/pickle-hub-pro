BEGIN;
SELECT plan(10);
SELECT ok(NOT has_any_column_privilege('anon','public.dupr_user_tokens','SELECT'),
  'anon cannot select any DUPR user token column');
SELECT ok(NOT has_any_column_privilege('anon','public.dupr_partner_tokens','SELECT'),
  'anon cannot read partner token columns');
SELECT ok(NOT has_any_column_privilege('authenticated','public.dupr_partner_tokens','SELECT'),
  'authenticated cannot read partner token columns');
SELECT ok(NOT has_any_column_privilege('anon','public.registration_secrets','SELECT'),
  'anon cannot read registration secrets');
SELECT ok(NOT has_any_column_privilege('authenticated','public.registration_secrets','SELECT'),
  'authenticated cannot read registration secrets');
SELECT ok(has_column_privilege('authenticated','public.dupr_user_tokens','connected_at','SELECT')
 AND has_column_privilege('authenticated','public.dupr_user_tokens','revoked_at','SELECT'),
 'authenticated connection-state reads preserved');
SELECT ok(NOT has_column_privilege('authenticated','public.dupr_user_tokens','access_token','SELECT')
 AND NOT has_column_privilege('authenticated','public.dupr_user_tokens','refresh_token','SELECT'),
 'authenticated cannot read user credentials');
SELECT ok(has_table_privilege('service_role','public.dupr_user_tokens','SELECT'),
 'service role user token reads preserved');
SELECT ok(has_table_privilege('service_role','public.dupr_partner_tokens','SELECT'),
 'service role partner token reads preserved');
SELECT ok(has_table_privilege('service_role','public.registration_secrets','SELECT'),
 'service role registration secret reads preserved');
SELECT * FROM finish();
ROLLBACK;

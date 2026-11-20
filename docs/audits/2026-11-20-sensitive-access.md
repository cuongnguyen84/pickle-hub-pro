# Sensitive access catalog audit — 20/11/2026

Production observation: **2026-11-20 11:50:14 UTC**, Supabase Management API
read-only endpoint. Only PostgreSQL catalog was queried; no application rows,
credential values, emails, phone numbers or token values were selected.
Query: [catalog audit](../sql/sensitive-access-baseline.sql).

## Effective privileges and policies

| Relation | anon | authenticated | RLS policy restriction |
|---|---|---|---|
| dupr_user_tokens | Table SELECT exists, including token columns | Table SELECT false; column SELECT metadata only, not access_token/refresh_token | SELECT policy only for authenticated, auth.uid() = user_id; anon has no matching policy |
| dupr_partner_tokens | SELECT exists | SELECT exists | No policies; RLS default deny for these roles |
| registration_secrets | SELECT exists | SELECT exists | No policies; RLS default deny for these roles |
| payment_orders | SELECT exists | SELECT exists | Organizer ownership through event registration/event or has_role admin |
| profiles | Column SELECT only | Column SELECT, INSERT, UPDATE | Broad SELECT policies; self/ghost INSERT and self/admin UPDATE policies |
| public_profiles | SELECT | SELECT | View has no security_invoker reloption; published projection is id, display_name, avatar_url, organization_id, created_at |

All five target base tables have RLS enabled, not forced. This is normal for
service-role operations, but ownership/BYPASSRLS and SECURITY DEFINER paths
must be audited separately. Neither browser role has direct INSERT/UPDATE/
DELETE on the three credential/secret tables or payment_orders.

Column privilege follow-up confirms neither anon nor authenticated can directly
SELECT profiles.email or profiles.phone. Authenticated cannot directly SELECT
DUPR token columns, consistent with migration
20260516050000_dupr_security_hardening.sql. Profile column privileges align with
20260706120000_profiles_pii_column_lockdown.sql: table-wide SELECT revoked,
non-PII column grants retained. Broad profiles SELECT policies therefore do
not by themselves expose email/phone.

## Findings and priorities

1. **Defense-in-depth gap:** anon retains SELECT on dupr_user_tokens including
   credential columns, although RLS currently supplies no anon policy and thus
   blocks rows. Partner token and registration secret tables similarly retain
   broad SELECT grants behind policy-less default-deny RLS. No current row
   exposure is proven by these grants. Remove unused browser grants in a
   reviewed migration with role-matrix regression tests, preserving service-role
   access and authenticated DUPR connection-metadata reads.
2. **View semantics require explicit documentation:** public_profiles has
   no security_invoker reloption in production and thus uses default view-owner
   privilege semantics. Its five-column projection contains no email/phone.
   Do not conclude that profiles RLS protects this view. Confirm intentional
   public projection and account-visibility requirements before changing it;
   migration 20260716120000_sec05_hardening.sql documents intentional public
   projections. Earlier migration comments calling it SECURITY INVOKER are
   insufficient evidence of current behavior.
3. **SECURITY DEFINER scope:** 346 public definers; all have an explicit
   search_path. This closes only the missing-search_path check. Many sensitive
   routines are executable by anon/authenticated, including token-authorized
   registration helpers and payment helpers. Review each function body for
   caller binding, token expiry, admin MFA and idempotency before concluding
   authorization is correct. Execute privilege alone does not prove a bypass.
4. **Profile privacy:** public/non-PII grants include bio/location and metadata
   while broad policies allow viewing. Confirm product visibility promises,
   especially is_public_profile, against the intended public projection.
   This audit does not claim those fields should be private.

## Limits and next steps

Catalog snapshots do not prove runtime policy truth under every JWT, owner,
service role, RPC or view. No production mutations or role simulation were
performed. Run the existing rls_auth_matrix/SEC-05 pgTAP cases on replayed staging
schema, add grant tests above, inspect sensitive SECURITY DEFINER bodies, and
compare normalized catalog/function/grant snapshots with clean migration replay.

## Proposed defense-in-depth patch (not applied to production)

Migration 20261120120000_secret_table_select_hardening.sql revokes SELECT only:
anon on dupr_user_tokens, and anon/authenticated on dupr_partner_tokens and
registration_secrets. Existing authenticated DUPR connection metadata grants,
service_role privileges, write privileges and policies are unchanged.

Compatibility inventory: src/hooks/useDuprConnection.ts explicitly reads only
connected_at/revoked_at with authenticated user ID. No frontend/native direct
partner-token or registration-secret reader was found. Edge consumers use
service-role clients. Production catalog query of public function bodies
referencing registration_secrets/dupr_partner_tokens returned six routines, all
SECURITY DEFINER: find_registrations_by_phone, get_my_event_dupr_by_token,
get_registration_by_token, link_event_dupr_id_by_token, register_event_as_member,
update_profile_contact_from_magic. Their ownership-based access does not rely
on caller table grants. This static/catalog inventory is not exhaustive proof
against dynamic SQL or external clients.

New pgTAP file tests revoked column visibility, preserved metadata reads,
credential column denial and preserved service-role SELECT (10 assertions).
Migration duplicate guard passes (428 versions), diff check passes. Runtime
pgTAP was not run: no psql executable or working local Docker database was
available. Require clean-replay pgTAP CI before applying. No production apply.

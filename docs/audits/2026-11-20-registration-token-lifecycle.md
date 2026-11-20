# Registration bearer-token lifecycle — inventory and migration design

Read-only source inventory against fetched remote main `6a060661bf3f276bf35fbb2a2e4dd424ecba5e89`, 20/11/2026. No production application rows or credential values were selected. Source schema is not asserted to be the current live catalog. November grant evidence separately verifies browser direct-table denial; it does not establish token expiry enforcement through definers or service-role handlers.

## Effective SQL consumers

Latest source definitions were reconciled by function name across migration order, not by assuming the original creation is effective. Overload/grant/catalog parity must still be checked on staging/live catalogs.

| Routine | Latest defining migration | Token operation / expiry |
|---|---|---|
| get_registration_by_token | 20260514100000_extend_get_registration_by_token | Public registration/event/payment read by token; no expires_at predicate. |
| find_registrations_by_phone | 20260512190000_registration_recovery | Service-role recovery lookup returns token/contact/channel; event start newer than now minus 7 days; no token expiry predicate. New recovery handler independently checks expiry. |
| update_profile_contact_from_magic | 20260512190000_registration_recovery | Token authorizes profile recovery-email write; no expiry predicate. |
| register_event_as_member | 20260717200000_db01c_member_capacity_lock | Authenticated issuance, new secret insert (inherits default); cancellation/reactivation/capacity semantics must be preserved. No shared token-validity predicate. |
| link_event_dupr_id_by_token | 20260526130100_social_event_dupr_link_and_match_log | Token authorizes registration DUPR linking; no expiry predicate. |
| get_my_event_dupr_by_token | 20260526130100_social_event_dupr_link_and_match_log | Token authorizes DUPR read; no expiry predicate. |

## Edge consumers and writers

| Function | Current source behavior |
|---|---|
| add-registration-direct | Proxy authorization lookup selects registration_id by proxy magic token (around 171); checks event/active registration afterwards but not token expiry. Creates UUID token when absent; re-registration keeps existing token (around 387,445–459), without renewing/checking expiry. Returns token to legitimate registration caller. |
| cancel-registration | index lookup by token selects registration_id (around 79), no expiry/revocation. handler.ts mirrors dependency-injected authorization path; production index wiring must be covered, not just handler tests. |
| reactivate-registration | index lookup by token selects registration_id (around 71), no expiry/revocation. Existing documented contract intentionally reuses token to avoid a second OTP. handler.ts has parallel authorization seam. |
| create-payment-order | index adapter selects magic_token by registration ID (around 68); handler compares bearer token but no expiry metadata. Retrying legitimate payment initialization must remain possible. |
| mark-payment-claimed | index adapter selects magic_token (around 64); handler compares it, no expiry metadata. Server confirmation/actual bank payment are independent authorization boundaries. |
| phone-otp-verify | After verified OTP registration, generates UUID and inserts secret (339–350); relies on expiry default. Secret insert error currently logged without failing registration; token can be returned despite failed persistence. Do not blindly retry registration creation to repair. |
| submit-match-score | Selects token, expires_at; rejects only if expiry present and earlier than now (225–240). Null/missing/invalid date bypasses expiry; exact equality is not rejected. Separate organizer/JWT path must remain unaffected by guest token checks. |
| request-recovery-link | Merged ownership fix requires CAPTCHA before lookup, known delivery channel, confirmed Auth-email match for email, no token in HTTP response. Checks finite future expires_at independently before notification. Reuses existing token rather than rotating. Cancelled registrations excluded. CAPTCHA is abuse control only. |

No active token-rotation UPDATE was found in the reviewed migration/Edge source. Replacing a registration secret token would revoke all prior copies at once; no generation/revoked_at/grace history exists in this schema.

## Schema and client compatibility

`20260512110000_registration_secrets.sql:33–42`: registration_id primary key with registration delete cascade; magic_token UUID NOT NULL with random default and unique index; created_at NOT NULL. `20260706140000_registration_secret_expiry.sql` adds **nullable** expires_at, default now + 400 days, one-time null backfill from created_at. It does not add NOT NULL, a revocation column, rotation transaction, or enforcement to the six SQL routines and other Edge consumers. `20261120120000_secret_table_select_hardening.sql` changes grants only. A ledger entry or historical backfill does not prove zero nulls, valid live values, or end-to-end expiry.

Browser consumers: registrationApi/RegistrationModal, ProxyRegistrationModal/addRegistrationDirect, myRegistration localStorage, PlayerRegistration, SocialEventDetail/Live, QRPaymentStep, EventDuprLinkCard, useEventLive/useSocialEventMatches. Routes /dang-ky/:token and shared referee/player flows must be included in compatibility tests.

Native consumers: SocialModels/SocialRepository, PhoneEventRegistrationView, PlayerRegistrationView, DeepLink and registration destination. A web-only migration can invalidate saved native URLs and local records. Enumerating paths proves references, not that each is an authorization boundary; server controls remain authoritative.

## Coherent staged migration plan

1. **Establish policy and catalog truth first.** Read catalog nullability/default/grants/function definitions without token rows. Obtain aggregate counts only (null expiry, expired active/future-event registrations, orphan secret rows) if authorized; never output credentials or contacts. Decide explicit registration-management retention and verified reissuance after expiry. Current 400 days is an implementation constant, not a justified universal retention policy.
2. **Add central DB validity predicate**, bound to one registration and caller-supplied token, requiring finite future expiry and not revoked; fix search_path, least execution grants. Update all token-authorized SQL routines in one reviewed migration; service-role phone lookup may return eligible records only but verified reissuance must still find owner registrations independently of old token validity. Do not use cancelled_at as global revocation: reactivate flow intentionally authorizes cancelled registrations before event start.
3. **Normalize metadata before strict enforcement.** Backfill nulls deterministically from created_at under reviewed policy, assess active/future-event guest impact, then validate a NOT NULL constraint. Do not extend genuinely expired credentials indiscriminately. Introduce revoked_at/token_version and audit reason if revocation is needed; limit audit data to metadata. Existing UUID storage/hashing migration is separate compatibility work.
4. **Wire every Edge adapter to a shared validation contract**, including payment adapters and proxy authorization; compare registration identity plus token + expiry + revocation. Return generic invalid/expired response without leaking secret. Tests must exercise production index adapters as well as handler interfaces. Preserve organizer JWT authorization and event-capacity/idempotency rules.
5. **Verified reissuance transaction.** After owned OTP/session or trusted registered channel verification, atomically lock registration/secret, rotate token and renew expiry according to policy; deliver the new URL only out of band. Decide whether normal recovery resends still-valid token (lowest disruption) and reserve rotation for explicit compromise/reissue. Never rotate merely on public phone lookup or CAPTCHA: that would let attackers invalidate legitimate guest links. Avoid rotating before an unverified delivery attempt, which can strand the guest. If delivery fails after commit, repeat verified recovery must retrieve current token, not issue unbounded competing rotations.
6. **Deployment order.** Additive schema/predicate and clean replay tests first; deploy compatible Edge/native/web clients; migrate SQL authorization with verified recovery available; enforce constraints after aggregates show readiness. Record deploy versions and read-only catalog checks per control. Rollback must not silently restore an expired-token authorization bypass.

## Required role and lifecycle regression matrix

Cover future valid, expiry equal now, past, null, invalid timestamp adapter data, revoked token, wrong registration/token, cancelled-but-reactivatable, started/ended event, secret-write failure, concurrent recovery/score/payment, delivery failure/retry, old token after explicit rotation, OTP re-registration and proxy capacity limits. Include guest browser, signed-in member, organizer, unrelated user, service-role and native saved-link scenarios. SQL pgTAP must verify all affected routines; Edge tests must prove requests cannot bypass them via service-role adapters.

**Decision: design first; no shared helper wired in this pass.** A TypeScript-only helper would leave SQL RPC bypasses, while enforcing strict null denial in one endpoint without verified reissuance and aggregate readiness can lock guests out. This inventory is not remediation completion and does not justify a 9/10 security score.

## Primary aggregate evidence and phase-1 patch — 20/11/2026

Primary agent reported a read-only production aggregate over normal verified TLS:
103 total secrets, 0 null expiry, 0 expired, 103 future expiry; 0 upcoming active
event registrations and 0 upcoming active registrations without future expiry.
Only aggregates were read, no token/PII/application rows. This was relayed primary
evidence, not a query executed by this inventory agent; exact query timestamp and
artifact should be attached by the primary operator. It removes an immediate
null-backfill need at the snapshot but not future nullability or consumer bypasses.

Phase-1 source is pinned to `1384fc1b2ec182f8207e57fa214164d3e3296c95`:
`20261120220000_registration_token_validity_predicate.sql` adds a service/definer-only
registration-scoped predicate requiring a matching UUID token and finite future
expiry. It does not mutate rows/defaults/constraints, rotate tokens, change JWT
paths or gate cancellation status. No existing consumer is switched. pgTAP adds
12 cases including scope, role grants, valid/expired/null/infinity and legitimate
cancelled registration authorization for the caller's reactivation decision.
Runtime pgTAP requires clean-replay CI; local Docker daemon is unavailable.
This additive primitive is NOT end-to-end M6 closure. Phase2 must wire all SQL
routines and Edge adapters above with verified reissuance ready and compatibility
checks; adding this function alone changes no existing guest authorization.

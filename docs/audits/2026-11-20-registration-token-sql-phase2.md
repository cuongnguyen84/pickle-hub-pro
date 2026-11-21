# M6 phase2 SQL authorization — staged draft

Source baseline: remote main `95de8c2635e8413950de0e76e2b4007f8ae38532`.
Dependency: phase1 PR1083 (registration_token_is_valid), initially stacked at
`0ef34065d24d9884e3c449a8d1314bb199335394`. No production deployment/application.

Five effective SQL consumer definitions are copied from their latest migrations,
with exactly one additive AND predicate per routine:
get_registration_by_token, update_profile_contact_from_magic,
find_registrations_by_phone, link_event_dupr_id_by_token,
get_my_event_dupr_by_token. Existing token comparisons, signatures, grants,
search paths, cancellation/business predicates and return contracts are retained.
The phone recovery lookup is service-only and filters invalid credentials;
verified renewal must use a separate registration-owner lookup, not depend on
recovering an already-valid bearer token.

The sixth inventory routine register_event_as_member is a JWT-authenticated
issuer, not a bearer consumer. It is intentionally absent from this migration;
its ownership, capacity advisory lock, idempotency and issuance remain unchanged.
No authenticated DUPR linking routine is replaced. Cancelled registrations stay
readable with valid tokens for legitimate reactivation; existing DUPR write
restriction for cancelled status remains.

## Reissuance gate — NOT READY FOR PRODUCTION APPLY

Existing phone-otp-verify sends active existing registrations to already_registered
before secret issuance. Therefore it is NOT a verified renewal endpoint for an
expired saved URL. Current safe recovery only delivers an existing finite future
token. Public CAPTCHA/phone knowledge must never rotate, renew or disclose tokens.

Before applying stricter SQL consumption in production, ship verified owned
OTP/session renewal that locates registration independently of token validity,
locks registration/secret, rotates/renews atomically with explicit retention,
returns/delivers only to verified owner, and supports delivery-failure retry.
Keep valid cancelled/future-event guest flows, native saved-link recovery and
organizer/JWT routes working.103 observed production secrets all had future
expiry, but that snapshot does not establish future recovery readiness.

Edge consumers remain divergent: cancel/reactivate, proxy, payment creation and
payment-claim adapters still bypass central validity until separately wired.
submit-match-score retains null/invalid boundary issues. This SQL-only draft
must not be presented as M6 closure or deployed independently as full enforcement.

## Validation

25 new pgTAP assertions exercise public valid reads/writes, expired/null/wrong
credentials across all five SQL consumers (phone lookup has no supplied token,
so wrong-token scope is tested through the service predicate), preserved valid
cancelled read and forbidden cancelled DUPR write, private predicate execution
and retained member capacity lock. Fixtures are transactional and synthetic.
Combined phase1 tests cover exact statement-time boundary, finite timestamps,
role execution and helper search path. Local SQL runtime unavailable; clean
migration replay + pgTAP CI required. Source-preservation diff and whitespace
checks pass; neither proves runtime correctness or deployment.

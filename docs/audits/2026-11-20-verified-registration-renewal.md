# Verified registration credential renewal — staged prerequisite

Source review: remote main `0b96d35019ed32bd39605449576ef750078f5525`.
Depends on phase1 PR1083; separate from SQL enforcement draft PR1086.
No deployment, activation, frontend entry point or real notification is performed.

## Ownership contract

Legacy phone-otp-send prioritizes email supplied in the request. otp_codes has
no trusted channel/purpose metadata. Such a code does NOT prove phone ownership
and is never accepted by this renewal path. This finding does not claim the
original registration/OTP contract has been globally fixed.

New service-only RPCs operate on a dedicated registration_renewal_challenges
table, never legacy otp_codes. A public request supplies phone/event plus
Turnstile abuse proof; it does not authorize token access or rotation. Database
reservation binds the challenge to the matching stored registration phone/event.
Only explicit eSMS success with a nonempty provider message ID allows Edge to
mark a challenge delivered. No arbitrary email recipient, development plaintext
code, request-supplied delivery flag or response challenge/code is supported.
SMS acceptance is not itself ownership: successful code redemption is the proof.

Verification HMACs the six-digit code with normalized phone and calls the
service-only verifier. It locks the phone/event, requires dedicated delivered,
unused, finite unexpired proof and fewer than three attempts; wrong code burns
an attempt atomically. Correct proof consumes every outstanding proof for that
phone/event and locks registration/secret before issuing credentials. Existing
valid token is returned unchanged; missing/null/infinite/expired token is renewed
to a fresh random UUID with400-day expiry. Exact expiry equality is invalid.
This preserves the existing retention default rather than inventing a shorter
policy. Public CAPTCHA/lookup never renews or invalidates a saved guest URL.

The alternate owner action verifies a real Auth.getUser session and supplies
only that verified user ID to a service-only DB routine. Database requires
registration.profile_id to equal auth.users.id with confirmed email or phone.
Caller-provided owner IDs/phone matches cannot substitute for this binding.
Ghost guests without an Auth user must use phone proof. The internal issuance
primitive is not executable even by service_role; proof-verifying definers own it.

Responses carrying credentials are restricted to verified code/owner actions;
all JSON responses use Cache-Control:no-store and Pragma:no-cache. No code,
token, provider payload or raw provider exception is logged by the adapter.

## Cost, retry and race semantics

A serialized global DB budget reserves before provider cost:50/day overall,
3/phone/15minutes,5/IP-hash/hour. Provider failure still consumes reservation and
never sets delivered_at. No match/budget exhaustion returns a uniform conditional
phone acknowledgement; reservations alone cannot revoke credentials. IP is canonicalized/bounded from CF-Connecting-IP, whose overwrite/provenance
contract has NOT been established on the public Supabase gateway. Treat per-IP
limits as advisory. Caller rotation cannot evade the atomic phone/global limits;
no forwarded-for fallback is trusted.

Proof consumption and credential issuance commit together. Concurrent proofs
serialize by phone/event and registration locks; one proof can be consumed once.
Different valid verified retries see the current valid token without rotation.
A response lost after commit requires a fresh owned proof/session; no unsafe
replay grace releases credentials using an already-consumed OTP. Registration,
capacity, payment status and payment orders are not inserted/modified by renewal.
Cancelled registrations remain manageable; reactivation business rules stay in
existing callers. Service-only cleanup deletes inactive proofs older than seven days and preserves
every active proof plus the complete rolling one-day budget ledger. It runs
opportunistically under the reservation lock and can be invoked by an operator;
no cron is scheduled. Low-traffic cleanup cadence remains an activation checklist
item rather than a claimed automatic seven-day SLA.

## Validation and remaining gates

Fifteen Edge/security tests cover wrong session identity, supplied identity ignored,
CAPTCHA-only request, CAPTCHA failure before provider cost, stored recipient,
provider failure/missing ID, verified digest delegation and credential response.
31 synthetic transactional pgTAP cases cover legacy/no proof, wrong phone/event,
owner mismatch/unconfirmed identity, missing delivery, valid renewal/retry,
three failed codes, replay, expiry, budgets, private grants and no duplicates.
The disposable-only race harness runs15 synchronized proof-consumption races
and15 final-phone plus15 final-global-budget-slot races. CI workflow includes it after replay tests.
Local Edge tests/lint pass; SQL/race execution requires replay CI (local Docker
unavailable). No production credentials or notifications were used.

Keep draft and do not activate until clean replay+race CI, owned staging eSMS
configuration/delivery, verified session/guest browser+native UI, expiry policy,
retention and user guidance are reviewed. No frontend route is added here; this
is backend prerequisite only, not an assertion of guest rollout readiness.
SQL consumer draft and all Edge consumers must still converge on central expiry
checks before M6 can close. Source-only provider mocks do not prove SMS delivery.

## Server HMAC custody and mutable registration binding

Phone/code and IP hashes now use domain-separated HMAC-SHA256. A new server-only
REGISTRATION_RENEWAL_HMAC_KEY must contain32cryptographically random bytes encoded
as64hex characters; no key is generated or printed by this patch. Missing/malformed
key fails phone request/verify closed before RPC/provider access. Configure through
reviewed Edge secret custody, never frontend/build environment. Rotating the key
invalidates outstanding five-minute challenges (owner-session recovery is separate);
plan a quiet-window rotation or explicit versioned keyring before routine rotation.
The plain6digit legacy OTP SHA256 helper is NOT used for renewal. A stolen challenge
database alone cannot cheaply enumerate codes without also compromising the pepper.

After phone proof selection, registration is locked and its phone/event rechecked
before proof consumption/issuance. Session ownership similarly locks the matching
registration before issuance. This closes a mutable-profile/phone TOCTOU window;
existing advisory and secret-row serialization remain. Invalid phone/event/null or
malformed digest inputs return no rows from service RPCs rather than exceptions.

## Bounded requests and diagnostics

The adapter caps streamed JSON at4096bytes and cancels stalled body reads after
3seconds. Turnstile fetch has a5second abort deadline. IPv4/IPv6 syntax is bounded
and canonicalized before HMAC to avoid unbounded attacker-controlled hash inputs;
this does not authenticate the header. Delivery-marker database failure logs only
a fixed generic code (no phone, IP, provider body or credential) and never grants
proof. SMS provider acceptance without a nonempty message ID remains unverified.
The fixed disposable race harness now exercises both phone and global final-slot
reservation with independent sessions. No real provider is invoked by SQL/tests.

The race harness additionally pauses a verifier behind a registration row lock,
changes its phone, then releases it and requires denial of the stale proof.

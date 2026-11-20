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

Verification hashes the six-digit code with normalized phone and calls the
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
phone acknowledgement; reservations alone cannot revoke credentials. IP comes
from gateway CF-Connecting-IP with no forwarded-for fallback; global and phone
budgets remain mandatory even if upstream IP provenance is imperfect.

Proof consumption and credential issuance commit together. Concurrent proofs
serialize by phone/event and registration locks; one proof can be consumed once.
Different valid verified retries see the current valid token without rotation.
A response lost after commit requires a fresh owned proof/session; no unsafe
replay grace releases credentials using an already-consumed OTP. Registration,
capacity, payment status and payment orders are not inserted/modified by renewal.
Cancelled registrations remain manageable; reactivation business rules stay in
existing callers. Challenges need a reviewed short retention/cleanup policy
before activation; this draft does not silently schedule production cleanup.

## Validation and remaining gates

Nine mocked Edge tests cover wrong session identity, supplied identity ignored,
CAPTCHA-only request, CAPTCHA failure before provider cost, stored recipient,
provider failure/missing ID, verified digest delegation and credential response.
23 synthetic transactional pgTAP cases cover legacy/no proof, wrong phone/event,
owner mismatch/unconfirmed identity, missing delivery, valid renewal/retry,
three failed codes, replay, expiry, budgets, private grants and no duplicates.
The disposable-only race harness runs15 synchronized proof-consumption races
and15 final-phone-budget-slot races. CI workflow includes it after replay tests.
Local Edge tests/lint pass; SQL/race execution requires replay CI (local Docker
unavailable). No production credentials or notifications were used.

Keep draft and do not activate until clean replay+race CI, owned staging eSMS
configuration/delivery, verified session/guest browser+native UI, expiry policy,
retention and user guidance are reviewed. No frontend route is added here; this
is backend prerequisite only, not an assertion of guest rollout readiness.
SQL consumer draft and all Edge consumers must still converge on central expiry
checks before M6 can close. Source-only provider mocks do not prove SMS delivery.

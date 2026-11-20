# Verified renewal UI — default OFF staged draft

Stacked on backend renewal PR1088 atdc81e941. No production flag, HMAC key,
provider secret, deployment or real SMS is configured by this change.

VITE_REGISTRATION_RENEWAL_ENABLED must equal the literal string true; unset,
false and numeric1 remain disabled. No URL/localStorage override exists. Existing
RecoveryRegistration behavior remains available when disabled; the new component
performs no context/backend requests. Event recovery CTA carries public event_id
only while enabled, including full/started events where new registration is closed.

Enabled entry validates event_id then fetches public event title/slug and renders
visible context using escaped React text. Missing/unavailable context instructs
opening recovery from the correct event or contacting organizer; no event guessing.
Signed-in choice queries registration by BOTH event_id and current profile_id;
caller-supplied registration/owner URL params are ignored. Backend still verifies
Auth.getUser and registration ownership independently.

Guest action uses only new renew-registration-token request/verify actions,
never legacy email/OTP verification. CAPTCHA request acknowledgement is explicitly
conditional, not a claim that SMS was sent. The normalized registered phone and
event remain fixed through six-digit verification; restarting clears code/CAPTCHA.
Provider/missing-key/unavailable/wrong/expired/used proof failures get safe generic
retry guidance, no raw backend messages or response errors are logged.

Successful proof validates UUID credential/registration, future finite expiry and
owner response binding. Credentials go only into existing device-local registration
storage (at most90days, bounded by server expiry), never routes, DOM links, analytics
or query cache. Persistence is read back before claiming restoration; unavailable
storage gets explicit guidance. Success returns through a normal encoded event
slug link. An in-flight owner response after sign-out/unmount is discarded. Both
EN and VI messages are present. Existing renewal responses are no-store; SDK POST
invocation is not placed in a caching query library or service-worker GET cache.

Validation:18new behavioral cases plus existing recovery case pass, TypeScript
and scoped lint pass. Prior full suite5345passes/69existing skips before the final
storage case, with existing83% statement gate unchanged. Final exact-head CI must
validate the assembled branch. Default-OFF/on synthetic builds must remain local
artifacts; do not upload an enabled build to production.

## Activation gates — still not ready

Require backend replay/role/race CI, approved server HMAC custody, owned staging
SMS and authenticated/guest real-browser/native journeys, retention/cleanup cadence,
analytics privacy PR1090 and private offline/cache boundary rollout. No real
notification was sent. No anonymous caller can activate renewal with CAPTCHA
alone. Native saved-link renewal UX is not implemented by this web component.
SQL consumer enforcement1086 and other Edge adapters remain separate drafts; this
UI is not M6 closure and does not authorize production enforcement by itself.

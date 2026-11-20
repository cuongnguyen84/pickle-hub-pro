# Social Event commit and privacy audit — 20 November 2026

Scope: source audit against remote main `30ce267f` (fetched before review), actual CreateSocialEvent, RegistrationModal, registrationApi, phone-otp-verify, EditSocialEvent and publication timestamp migration. No live registrations, publication actions, production analytics emission, deployment or schema change. This is source/behavioral evidence, not GA4 delivery verification.

## Concrete defect and scoped fix

RegistrationModal.extractFunctionErrorCode accepts any string from response JSON `code`. Its trackFailure previously forwarded that string verbatim as GA4 `failure_code`. The UI's translateErrorCode default did not sanitize telemetry. A malformed/unexpected upstream code could contain phone/email/token/free text, violating the documented allowlist and increasing dimension cardinality. No actual production PII transmission is claimed.

Added registrationAnalytics helper with a fixed allowlist drawn from the modal translation vocabulary and static error literals in phone-otp-send, phone-otp-verify and register_event_as_member. Unsupported/non-string codes become `unknown`; UI error translation and money-path calls remain unchanged. Failure stage is constrained to the three actual call sites. RegistrationModal delegates its failure emitter to this helper. No global journey schema/telemetry contract change.

Behavioral tests invoke the helper and mock its actual downstream journey emitter; approved error retains dimensions, email/phone/token/free-text/unrecognized/non-string values emit only `unknown`. Existing RegistrationModal money-path characterization suite also passes. Scoped result: **2 test files, 35 tests passed**, diff check clean.

## Commit ordering and count limitations

- OTP completion occurs only after awaiting verifyOtp with no transport error and `data.ok`; edge code awaits social_event_guest_register and requires outcome `registered` plus registration_id before returning success. Already-registered returns 409, not a new completion.
- Member completion occurs after awaiting register_event_as_member with no error and a returned row. Payment order creation happens afterward; registration completion does not mean payment completed.
- CreateSocialEvent counts successful awaited RPC results; publishes activation after at least one base event committed. Partial repeat batches emit a failure diagnostic plus one activation and suppress activation on resume. This matches the written journey contract; it is not a per-row publication counter.
- Completion dedup is journey/session-storage based. It removes the active journey before asynchronous emission, which suppresses same-journey rerenders/refetches in the normal storage path. It is not server receipt deduplication, cross-tab deduplication, or guaranteed delivery. Blocked/failing sessionStorage can also suppress or weaken measurement; do not equate GA4 counts with committed DB totals.
- EditSocialEvent does not use organizer journey emitters; manual and proxy registrations do not use player self-registration journey emitters. The player contract explicitly scopes self-registration. Draft→published edits must be measured using server-owned first_published_at rather than invented client publication events or created_at.
- Publication migration 20261120130000 preserves historical unknowns; NULL first_published_at does not establish never-published. No historical backfill inferred.

## Remaining acceptance evidence

AN-1/UX-3 remain open for matched-window real GA4 delivery/privacy review and reconciliation against committed registration rows plus first observed publication transitions. DB totals and client intent/journey denominators must be reported separately, with batch and proxy/manual scope stated. No event-before-commit bug or actual duplicate production event was established in this pass; no speculative success-emission change was made.

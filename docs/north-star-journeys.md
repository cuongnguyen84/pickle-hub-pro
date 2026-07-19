# North-star journeys and activation contract

Status: accepted for `BASE-01` on 2026-07-14. Instrumentation is owned by
`BASE-02`; this document fixes the event names and counting rules first.

## Product outcome

The shared outcome is a real player place on a real organizer event. The two
role-specific north stars are:

- **Player:** weekly newly activated players, where activation is the first
  successful self-registration for a published Social Event.
- **Organizer:** weekly newly activated organizers, where activation is the
  first successful publication of a Social Event they organize.

Drafts, modal opens, OTP sends, payment-order creation, proxy registrations,
and manual registrations are funnel diagnostics, not activation.

## Shared event contract

All journey events use GA4 snake_case names and include:

| Property | Values / rule |
|---|---|
| `journey_schema_version` | Integer `1` |
| `journey_id` | Random UUID created when the journey starts; kept only for the active browser journey |
| `event_id` | Internal Social Event UUID; required once one exists and omitted from organizer pre-commit events |
| `source_route` | Route pattern, never a URL containing query values or tokens |
| `locale` | `vi` or `en` |
| `auth_state` | `anonymous` or `authenticated` |
| `app_surface` | `web`, `capacitor_ios`, or `capacitor_android` |
| `device_class` | `mobile`, `tablet`, or `desktop` |
| `market_segment` | `vn`, `international`, or `unknown` |

Do not send phone numbers, email addresses, display names, free-form event
titles, magic tokens, registration URLs, bank data, raw error messages, or
profile/user IDs. Failure events send only an allow-listed `failure_code` and
`failure_stage`. A completion event is emitted once per successful server
commit; React rerenders and query refetches must not emit it again.

## Player journey

**Entry:** the player selects the enabled registration CTA on a published,
not-started Social Event with capacity at `/social/:slug` or
`/vi/social/:slug`.

**Completion:** either `phone-otp-verify` returns a committed registration or
`register_event_as_member` returns a committed registration. The response must
contain a registration ID before the client emits completion. Payment is a
separate downstream journey because free and pay-at-venue events are valid
registrations.

| Order | Event | Emit condition |
|---:|---|---|
| 1 | `player_registration_started` | Enabled CTA opens the modal; this is the intent denominator |
| 2 | `player_registration_verification_requested` | OTP request succeeds; OTP path only |
| 3 | `player_registration_submit_attempted` | Player submits a six-digit OTP or confirms the authenticated-member path |
| 4 | `player_registration_completed` | Registration commit succeeds; this is the player activation event |
| failure | `player_registration_failed` | An allow-listed client/server failure blocks progress |

Player-specific properties:

- `registration_method`: `otp` or `member`.
- `price_type`: `free` or `paid`.
- `requires_prepayment`: boolean.
- `slot_mode`: `none` or `required`.
- `otp_channel`: `zalo`, `sms`, `dev`, or `unknown`; only on OTP diagnostics.

The canonical product count is based on `event_registrations.registered_at`
with `registration_source = 'self'`. Exclude `proxy` and `manual` rows, retries
that return an existing registration, and reactivation of a previously
cancelled row. Cancellation does not rewrite historical activation; report the
share still active after 24 hours as a quality guardrail.

Primary funnel metric:

`unique journey_id completed within 30 minutes / unique journey_id started`

## Organizer journey

**Entry:** an authorized club organizer reaches
`/clb/:slug/social/moi` and the create wizard becomes usable.

**Completion:** `create_social_event_with_payment` commits at least the base
event with `status = 'published'`. Saving a draft is not activation. A weekly
repeat submit is one organizer journey even if it creates several event rows.

| Order | Event | Emit condition |
|---:|---|---|
| 1 | `organizer_event_creation_started` | Authorized create wizard is ready; this is the intent denominator |
| 2 | `organizer_event_details_completed` | Step 1 validates and advances to payment/settings |
| 3 | `organizer_event_submit_attempted` | Organizer chooses `publish` or `save_draft` |
| 4a | `organizer_event_published` | At least the base published event commits; this is the organizer activation event |
| 4b | `organizer_event_draft_saved` | At least the base draft commits; diagnostic only |
| failure | `organizer_event_publish_failed` | No base event commits; also emit as a diagnostic alongside `organizer_event_published` when a repeat batch is partial |

Organizer-specific properties:

- `submit_action`: `publish` or `save_draft`.
- `visibility`: `public` or `club_only`; both count as publication.
- `price_type`: `free` or `paid`.
- `requires_prepayment`: boolean.
- `slot_mode`: `none` or `configured`.
- `requested_event_count` and `created_event_count`: integers for weekly repeat.
- `batch_result`: `complete`, `partial`, or `failed`.

Primary funnel metric:

`unique journey_id published within 24 hours / unique journey_id started`

The canonical entity is `social_events.created_by`; an organizer activates on
their first transition to `status = 'published'`. The current table has no
`published_at`, so direct-publish rows can be reconstructed from `created_at`
but draft-to-published transitions cannot be timed reliably. `BASE-02` must add
a server-side publication timestamp or immutable transition event before the
database is used as the canonical organizer activation series.

## Livestream gate journey

Added 2026-07-20 by `livestream-gate-hardening`. A diagnostic conversion
journey, not a role activation: it measures whether the livestream login gate
produces accounts.

**Entry:** the gate overlay is shown to an anonymous viewer whose preview
window has ended, on any of the three surfaces (`home` hero, `watch` page,
third-party `embed`).

**Completion:** the existing `sign_up` point in `useAuth` fires for a freshly
created account while a `livestream_gate` journey is active in the session.
The completion inherits the `sign_up` age heuristic (account < 120s old), so
email-verify flows slower than 2 minutes are not attributed — a known
undercount, not a bug.

| Order | Event | Emit condition |
|---:|---|---|
| 1 | `live_gate_shown` | Gate overlay mounts; this is the intent denominator |
| 2 | `live_gate_signup_clicked` / `live_gate_login_clicked` | CTA click on the overlay |
| 3 | `livestream_gate_signup_completed` | `sign_up` fires with an active journey |

Journey-specific properties (allow-listed): `surface` (`home` | `watch` |
`embed`), `seconds_watched_session` (integer; 0 at gate time flags a viewer
blocked on arrival — the budget-consumed-elsewhere pathology), `method`
(auth provider, completion only).

## Measurement rules

- Report Vietnam (`market_segment = 'vn'`) as the primary view and keep
  `international` separate; never silently merge `unknown` into either.
- Report mobile, tablet, and desktop independently before an all-device total.
- Use client events for UX conversion and drop-off. Use committed database rows
  for product totals once the organizer publication timestamp gap is closed.
- A user can activate only once per role, but can complete many journeys.
- Funnel clocks use event time in UTC. Cohort labels use the user's locale and
  market segment at journey start.
- Bot, admin test, local development, and automated E2E traffic must be
  excluded through explicit environment/test flags, not user-agent guessing.

## Implementation anchors

- Player entry and modal wiring: `src/pages/SocialEventDetail.tsx`.
- Player server-commit branches: `src/components/social-events/RegistrationModal.tsx`.
- Organizer entry and atomic submit: `src/pages/CreateSocialEvent.tsx`.
- Existing GA4 wrapper and route tracking: `src/utils/ga.ts` and
  `src/hooks/usePageTracking.ts`.
- Canonical tables: `social_events` and `event_registrations`.

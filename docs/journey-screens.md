# Journey Screen Inventory (BASE-04)

> 2026-07-16. The 5–8 screens on the two north-star journeys
> (`docs/north-star-journeys.md`), with start point, completion point, and
> drop-off observation per journey. This list scopes DS-01 token application,
> A11Y-01/03/04, and UX-01/07 — those tasks touch THESE screens first.
>
> Drop-off numbers require the BASE-02 funnel events (not yet emitting).
> Columns marked *pending* fill in after two weeks of funnel data; the
> structural drop-off candidates below come from code reading, not analytics.

## Player journey — discovery → registered (4 screens)

| # | Screen | Route(s) | Component | Journey role |
|---|---|---|---|---|
| P1 | Event detail | `/social/:slug`, `/vi/social/:slug` | `pages/SocialEventDetail` | **Start**: enabled CTA tap = `player_registration_started` |
| P2 | Registration modal — identity | same route (modal step) | `components/social` RegistrationModal (phone/OTP hoặc member confirm) | `verification_requested` → `submit_attempted` |
| P3 | Registration modal — slot pick | same route (modal step, slot events only) | slot picker step | required-slot events only |
| P4 | Confirmation / QR payment step | same route (modal end state) | QRPaymentStep / success state | **Completion**: `player_registration_completed` (payment là journey riêng) |

Structural drop-off candidates (verify against funnel data):
- P2 OTP wait: Zalo/SMS latency + 3-attempt burn (`otp_too_many_attempts`).
- P1→P2 on full events: CTA state khi `event_full` — the atomic DB-01 gate
  now returns it more often at commit-time; the UI must pre-communicate
  capacity.
- P4 prepayment events: `pending_payment` rows auto-cancel — silent loss if
  the player closes before the QR step.

## Organizer journey — create → published (4 screens)

| # | Screen | Route(s) | Component | Journey role |
|---|---|---|---|---|
| O1 | Club events hub | `/clb/:slug` (events tab) | club dashboard | entry context (not counted) |
| O2 | Create wizard — details | `/clb/:slug/social/moi` step 1 | create wizard | **Start**: `organizer_event_creation_started`; `details_completed` on advance |
| O3 | Create wizard — payment/settings | same route step 2 | payment config + slots + repeat | most fields, most abandonment surface |
| O4 | Publish result | same route (submit) | submit + result state | **Completion**: `organizer_event_published`; `draft_saved` = diagnostic |

Structural drop-off candidates:
- O3 bank-config friction: payment fields are optional but read as required;
  progressive disclosure là UX-03 scope.
- O4 weekly-repeat partial (`batch_result=partial`) — hiện không có UI nhắc
  retry phần thiếu.

## Measurement per journey

| Journey | Start metric | Completion metric | Window | Drop-off (pending BASE-02) |
|---|---|---|---|---|
| Player | unique `journey_id` với `player_registration_started` | `player_registration_completed` | 30 min | per-step rates P1→P4 |
| Organizer | `organizer_event_creation_started` | `organizer_event_published` | 24 h | O2→O3→O4 rates |

Total: 8 screens. Anything outside this list is out of scope for the first
DS/A11Y/UX passes — expand only from traffic/risk evidence.

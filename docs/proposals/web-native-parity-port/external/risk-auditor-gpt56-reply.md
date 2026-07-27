# GPT-5.6 devil-advocate reply (model: gpt-5.6-sol, 2026-07-27)

## First correction: a feature-branch commit alone does nothing to production

Because the app is not distributed, ordinary users cannot execute the new client code. Production changes only when:

- the agent or Cuong runs write paths against the configured Supabase project;
- the agent deploys an Edge Function or migration; or
- Cuong invokes external services such as FCM or Mux while testing.

Git branch isolation does not isolate any of those effects.

## 1. The registration bypass is the sharpest known integrity failure

Your concern is correct, but it is worse than an advisory-lock race.

### Mechanism

A direct PostgREST insert into `event_registrations` bypasses:

- the advisory lock;
- the capacity count;
- event-open/closed checks;
- payment checks;
- slot/group validation;
- allowed-status validation.

The insert policy only checks `profile_id = auth.uid()`.

### Triggers

Either of these overbooks an event:

1. Native directly inserts into an already-full event.
2. One slot remains; web registration enters the locked RPC while native inserts directly. The native insert does not acquire the advisory lock, so both can commit.

### User-visible symptom

Both users receive successful registration. The organizer sees attendance above capacity and must reject somebody manually, potentially after payment.

The slots feature can also insert a user as confirmed into a closed or paid event without satisfying payment or slot capacity.

This is already a production API vulnerability: any authenticated user can call PostgREST directly today. The native feature merely gives it a convenient UI path. DB-01 is not an integrity boundary while direct INSERT remains allowed.

**Release requirement:** all registration, reactivation, recurrence-slot registration, and cancellation transitions must use guarded RPCs. Prefer revoking direct table writes or enforcing the invariant in a trigger/constraint; client discipline alone is not sufficient.

### Larger blast radius than one overbooking

Testing with Cuong’s admin account is the biggest immediate blast-radius problem. The global admin branch means a malformed or insufficiently filtered update/delete is authorized against every organizer’s rows.

Trigger: a new repository sends the wrong event ID, omits an `.eq(...)`, or tests deletion against a real event.

Symptom: real registrations disappear, payment configuration changes, or an event is modified. A Git revert does not restore those rows. Testing as admin also hides authorization failures that ordinary organizers will later receive as HTTP 403.

## 2. APNs/FCM cannot be completed or verified on this simulator setup

Absent an already-configured Apple/Firebase setup, the agent cannot complete:

- enabling Push Notifications for the exact App ID;
- obtaining a provisioning profile containing `aps-environment`;
- creating or using an APNs key/certificate;
- uploading that APNs credential to Firebase;
- registering `net.thepicklehub.app.dev` as the correct Firebase iOS app and obtaining its `GoogleService-Info.plist`;
- verifying sandbox-versus-production APNs routing on a signed physical-device build.

The release bundle ID, if different from `.dev`, requires its own App ID/Firebase configuration. Success for the dev bundle would not prove release delivery.

### Simulator limitation

The simulator can test notification presentation and can inject a payload with `simctl push`. That bypasses APNs, FCM, device-token registration, APNs credential validation, and token rotation. It is not an end-to-end push test.

### Production state from “trying anyway”

Calling `registerForRemoteNotifications` or requesting permission on the simulator does not inherently alter production. The authorization decision is simulator-local.

Concrete production damage occurs if the implementation:

- stores fabricated or unusable tokens in `push_tokens`; or
- invokes the real broadcast function while testing.

Invalid tokens that produce `400 INVALID_ARGUMENT`, sender mismatch, or APNs authentication errors will not be removed by pruning that only recognizes HTTP 404 or `UNREGISTERED`. They remain in the denominator and reduce the push SLO. Misconfigured APNs credentials can similarly make every iOS send fail without pruning the tokens.

A test admin broadcast is worse: up to 2,000 real users receive a test notification. That cannot be unsent.

Token rows are manually repairable, not irreversible. Delivered notifications are irreversible. No Apple-portal state leaks if the agent genuinely has no portal credentials.

## 3. Additional concrete production failures

### Backend deployment bypasses Git isolation

If the agent runs either of these against `ajvlcamxemgbxduhiqrl`:

- `supabase functions deploy`
- `supabase db push` / migration commands

the branch status is irrelevant. The production function or schema changes immediately.

A broken deployment of `send-push-notification` stops real broadcasts. A migration is durable until explicitly reversed. “Not merged” is not a rollback control for Supabase.

### Mux creates external, billable state

Trigger: testing “Create livestream” or uploading a video through the real Mux Edge Function.

Result:

- real Mux live streams, direct uploads, assets, and playback IDs are created;
- uploaded video can begin encoding/storage billing;
- published records can expose test streams to users.

A DB restore or Git revert does not delete Mux resources or refund incurred usage. They require separate Mux cleanup.

### Social-event tests modify real commerce and calendars

Concrete triggers and symptoms:

- Updating `event_payment_config` on an existing event shows users the wrong amount or payment destination.
- Testing registration creates a real attendee and may consume a real slot.
- Materializing weekly recurrence can create multiple visible test events.
- Testing “free perks” may mark real registrations as entitled without payment.

These writes persist after code rollback.

### Club invite testing contacts real users

Trigger: searching a real profile and tapping invite.

Symptom: that user receives a genuine club invitation/notification, and membership state may change. Deleting the row later does not undo the notification or confusion.

### Storage overwrite can be unrecoverable

If video or event media uses a deterministic object path with overwrite/upsert, testing can replace an existing production object. Because storage objects are outside the DB backup, the old object is unrecoverable unless bucket versioning or another copy exists.

Uploading under a unique path merely creates removable production garbage; it is not data loss.

### Auth throttling is conditional, not an automatic incident

A tight loop against password-token endpoints will usually throttle the agent’s source IP, so real Vietnamese users are unaffected.

A loop repeatedly requesting OTPs can consume recipient cooldowns, project/provider quotas, or SMS/email quota. Then users see HTTP 429 or receive no OTP. This is only a real concern if the autonomous test actually loops through OTP issuance; “eight hours” alone is not evidence.

### Realtime is mostly noise here

One simulator and a few channels do not threaten production. A demonstrated subscription leak plus an automated navigation/reconnect loop could exhaust Realtime channel or connection limits, causing live courtside updates to freeze until connections expire. Without such a loop or measured channel growth, drop this concern.

## 4. Concerns to drop

- The three-way tournament list and parent/multi-stage pages are production-safe if genuinely read-only.
- TV mode is safe if it only reads/subscribes and subscriptions are cleaned up.
- Bracket rendering is safe; tournament registration is not.
- Exhausted CI does not itself damage production. It only removes independent validation.
- Local simulator notification testing does not affect real users.
- Web availability, Vietnam LCP, cron health, and scoring lost-update SLOs are not implicated unless the agent also deploys backend changes.
- “Feature branch” is neither a risk nor a safeguard for live database writes, Edge Function deployment, FCM sends, or Mux calls.

The minimum safe boundary is: no production deploy credentials, no Mux/FCM invocation, mocked write repositories overnight, and morning testing with a non-admin account. Most importantly, fix the open `event_registrations` INSERT path at the database boundary before adding another client.
## Verdict: reject as described

The individual fixes are reasonable, but the obvious implementation introduces several concrete production regressions.

### 1. Two player refs: safe only if playback state is also separated

Giving both `<MuxPlayer>` instances refs and pausing both is safe by itself.

The remaining failure is the shared `isPlaying` callback:

- **Mechanism:** both mounted players call `onPlayStateChange`, even though one is CSS-hidden. The last callback wins.
- **Trigger:** visible mobile player is playing while the hidden desktop player reports paused, or pausing both emits callbacks in nondeterministic order.
- **Symptom:** the video visibly plays while `isPlaying === false`. View counting stops, presence may say the viewer is not watching, and any “re-pause when playing” logic can miss the visible player.

Do not derive one player’s state from two last-writer-wins callbacks. Either mount only the active responsive player or track the two states separately and explicitly select the visible player.

### 2. Continuous re-pause can briefly gate restored logged-in sessions

`shouldGate = isEnabled && !isAuthenticated` is unsafe while authentication is loading.

- **Mechanism:** settings can resolve before Supabase session restoration. At that moment `isEnabled=true` and `user=null`, so a returning logged-in user is temporarily classified as anonymous.
- **Trigger:** slow auth restoration on a device where settings load quickly, especially at Saturday peak.
- **Symptom:** a logged-in viewer’s live stream pauses and may show the login overlay. When auth resolves, the overlay disappears, but playback generally remains paused and requires manual restart.

The new continuous pause makes this race much more visible than the current implementation. Gate eligibility needs an explicit `authResolved` state; `user === null` is not enough.

There is also a two-player event race:

- **Mechanism:** the hidden player can report `playing=true` after both players were paused.
- **Trigger:** queued Mux/native media events around the gate transition.
- **Symptom:** repeated pause calls, control flicker, and inconsistent `isPlaying` state. It should settle, but metrics driven from that boolean will be wrong.

### 3. Persisted start time can consume previews without playback and can crash Safari sessions

A raw `Date.now()` start time changes the gate from viewing time to wall-clock time.

- **Mechanism:** elapsed time continues while paused, buffering, backgrounded, or before the player starts.
- **Trigger:** user opens the stream, watches two seconds, backgrounds Safari for a minute, then returns.
- **Symptom:** the user is immediately gated despite only watching two seconds.

If the homepage hero uses the same stream ID and gate key, this gets worse:

- **Mechanism:** the hero writes `pkl_preview_seen_<id>` before the user opens the watch page.
- **Trigger:** user leaves the homepage open for 15 seconds and then clicks the live stream.
- **Symptom:** the full watch page has no preview and immediately demands login.

Storage access must also be guarded:

- **Mechanism:** `localStorage.getItem` or `setItem` can throw `SecurityError` or `QuotaExceededError` in restricted/private iframe and Safari configurations.
- **Trigger:** opening the embed with blocked storage or private-mode restrictions.
- **Symptom:** an uncaught exception breaks the gate hook; depending on the error boundary, the player or entire route becomes blank.

Clock changes create deterministic bad behavior:

- Clock moved forward: immediate gate.
- Clock moved backward or a stored timestamp in the future: preview lasts until the wall clock catches up unless the value is validated and clamped.
- Malformed storage value: `NaN` can prevent expiry forever if not rejected.

Do not write the timestamp while settings or auth are unresolved. Otherwise a logged-in user caught in the auth race consumes the anonymous preview and is immediately gated after later logging out.

### 4. Embed login can become an unrecoverable gate

Opening login in a new tab is necessary but not sufficient.

- **Mechanism:** third-party iframe storage can be partitioned or blocked. The top-level `/login` tab writes a session that the embedded origin does not see.
- **Trigger:** Safari or another browser with third-party storage protection, on a partner site embedding `/embed/live/:id`.
- **Symptom:** the user successfully logs in in the new tab, returns to the iframe, and the iframe remains gated indefinitely, including after reload.

A storage event is not a reliable solution across partition boundaries. The embed needs a supported re-authentication/reload handshake or must clearly tell the user to open the stream in the new top-level tab.

Also verify the homepage:

- **Mechanism:** if the homepage hero is implemented using `EmbedLive`, this change gates it too.
- **Trigger:** anonymous visitor remains on the homepage for 15 seconds.
- **Symptom:** the hero becomes a login overlay, and—if it shares the persisted stream key—also consumes the preview for the full watch page.

That may be acceptable, but it must be explicitly included in the approved breaking change.

Finally, `applies_to` must still be honored for ended live events:

- **Mechanism:** reusing the live gate solely by route/component name gates a replay rendered through `WatchLive` or `EmbedLive`.
- **Trigger:** an event ends while the page remains mounted, or a user opens an archived event on the live route.
- **Symptom:** a replay is login-gated even when settings say the gate applies only to live broadcasts.

### 5. Shared view-counter change can zero plain-video counts

This is the largest metrics regression.

- **Mechanism:** the shared hook gains an `isPlaying` argument, but `WatchVideo.tsx` or `EmbedVideo.tsx` does not provide or correctly update it. An omitted value defaults false.
- **Trigger:** deployment without updating every shared-hook call site.
- **Symptom:** plain videos stop recording views entirely.

Even with all callers updated, interval implementation matters:

- **Mechanism:** an effect keyed on `isPlaying` creates a new 30-second interval every time playback resumes.
- **Trigger:** users play in multiple segments shorter than 30 seconds.
- **Symptom:** they accumulate more than 30 seconds of actual playback but never record a view because each pause resets the interval.

Use accumulated playing duration or retain remaining interval time across pauses if “every 30 seconds watched” is the intended metric.

For live pages, using the shared two-player `isPlaying` boolean causes undercounting:

- **Mechanism:** hidden paused player overwrites the visible playing player’s state.
- **Trigger:** mobile playback with the hidden desktop player mounted.
- **Symptom:** live view-count calls stop while the viewer is visibly watching.

There will also be an intentional dashboard step-change:

- **Mechanism:** paused, backgrounded, and gated tabs no longer generate a count every 30 seconds.
- **Trigger:** immediately after deployment.
- **Symptom:** reported view volume drops sharply despite unchanged traffic.

The owner must annotate the deployment in metrics. Otherwise this will look like a Saturday-night traffic or player outage.

### 6. `gated` must not be a subscription dependency

Do not reconnect presence when `gated` changes.

- **Mechanism:** putting `gated` in the subscribe effect dependencies releases and reacquires the same shared topic. Settings resolution, countdown expiry, and auth restoration can each cause a reconnect.
- **Trigger:** settings arrive, the preview expires, or a session restores while multiple hook consumers share the topic.
- **Symptom:** the old async subscribe/removal path races the replacement channel. Presence callbacks become attached to the wrong/stale channel or collide with an already-subscribed channel; the admin concurrent count sticks at 1 again.

This is the same failure class as the 2026-07-08 incident. The explicit stale-channel removal reduces one path but does not justify reactive channel recreation.

Acquire the channel based only on stable channel identity. Change the payload with `channel.track({...currentPayload, gated})` after subscription.

The refcount design creates another concrete ambiguity:

- **Mechanism:** two consumers sharing one client/channel can have different gate states, but one presence key can expose only one `gated` value. The last `track()` wins.
- **Trigger:** homepage hero and watch page are open simultaneously, or one consumer is gated while another is authenticated/ungated.
- **Symptom:** the admin list flips the same viewer between gated and watching depending on which component updated most recently.

Define whether presence represents a browser client, a route, or a player session. A single refcount-shared presence entry cannot accurately represent multiple simultaneous player states.

There is also deployment version skew:

- **Mechanism:** already-open SPA tabs continue publishing payloads without `gated`.
- **Trigger:** admin UI deploys filtering such as `payload.gated === false`.
- **Symptom:** all pre-deploy viewers disappear from the concurrent count until they refresh.

Treat missing `gated` as legacy ungated/unknown, not as excluded.

## Required before release

1. Add an explicit `authResolved` guard before starting, persisting, displaying, or enforcing the gate.
2. Separate the two players’ playback state or mount only one.
3. Wrap all storage operations, validate timestamps, clamp clock anomalies, and decide explicitly whether preview means wall time or watched time.
4. Verify homepage hero and replay behavior against `applies_to`.
5. Update and test every `useIntervalViewCounter` caller; preserve accumulated playback across pauses.
6. Update presence payload with `track()`, never by resubscribing on `gated`.
7. Make admin handling backward-compatible with payloads lacking `gated`.
8. Annotate the expected post-deploy view-count drop so it is not diagnosed as lost traffic.
## 1. Most likely production failure / wrong decision

The most likely bad outcome is shipping an incomplete telemetry “fix” and treating the resulting **web QuickTable singles conversion rate as the overall registration funnel**.

There are two concrete implementation traps:

1. **Changing only the JourneyKind does not fix the A→B re-mint.**  
   If the effect still calls `startJourney()` on the anonymous render and again after authentication/remount, QuickTable merely changes from:
   - `player_registration`: A → B  
   to:
   - `quicktable_registration`: A → B

   `auth_wall_viewed(A)` still cannot join `registration_complete(B)`.

2. **Removing `user?.id` from the effect dependency may also be insufficient.**  
   An OAuth trip through `/login` can unmount the registration screen. On return, a newly mounted effect runs even if its dependency is only `[tableId]`, and an unconditional `startJourney()` still overwrites A.

The safe implementation is a dedicated QuickTable namespace **plus persistent resume semantics**, for example:

- store `{ journeyId, tableId }` in `sessionStorage`;
- on entry, reuse it if it is for the same `tableId`;
- mint a new ID if absent or for a different table;
- clear it on completion or explicit abandonment.

Then verify in production-like navigation that an OAuth round-trip produces:

```text
auth_wall_viewed(A)
auth_wall_click(A)
registration_complete(A)
```

Even after that, D5 must be labelled **“QuickTable singles, instrumented web sessions”**. Default doubles, the other two surfaces, native clients, blocked GA, and failed client delivery are outside the measurement. Calling it overall registration conversion would be the costly analytical failure.

For the progress bar, the most likely outcome is simpler: changing `OpenRegistrationSection` changes nothing because it is dead code. If it is wired into `/tournaments`, the next concrete failure is `permission denied for table quick_table_registrations`: an RLS policy does not replace an SQL `GRANT SELECT`. If that failed query is coupled to list loading, users can lose the whole tournament list rather than merely see a missing bar.

## 2. Is global start-if-absent safe?

No. It couples the two surfaces through the shared `journey_player_registration_id` slot.

Concrete sequence:

1. Social modal calls `startJourney('player_registration')` and stores ID `S`.
2. User abandons it; no `completeJourney`, so `S` remains.
3. User later enters QuickTable in the same tab.
4. Start-if-absent sees `S` and does not mint a QuickTable ID.
5. QuickTable emits:
   - `auth_wall_viewed(S)`
   - `auth_wall_click(S)`
   - `registration_complete(S)`
6. `completeJourney` removes `S`.

Consequences:

- Social and QuickTable events are now attached to one nominal journey.
- QuickTable completion destroys the active Social journey state.
- If the user later resumes/completes Social, its tracking may no-op or start under a different ID.
- Any analysis grouping by `journey_id` without strict event-family filtering sees one cross-surface journey.
- Repeated reuse can collapse logically separate attempts into one distinct journey.

Because `kind` is absent from the GA payload, there is no clean dimension available later to repair this collision. Event names can separate some reports, but they do not undo the shared identity or lifecycle corruption.

Use a separate `quicktable_registration` kind. However, again, **the rename alone does not solve re-minting**; pair it with an idempotent same-table `ensure/resume` operation.

## 3. DB race migration

Do not ship this as an urgent standalone production migration.

The residual requires an extremely specific concurrency sequence on a path used once, and the damage is one recoverable `seed = NULL` team. A malformed replacement function can instead make every call to the RPC fail immediately, producing visible registration 500s. The downside of the deployment currently exceeds the expected downside of the race.

Put the status recheck into the next normally tested DB release, with at least:

- the exact production function signature preserved;
- owner, grants, `SECURITY DEFINER/INVOKER`, `search_path`, and return type verified;
- tests for open, closed, full, cancellation, and concurrent close/register;
- a rollback definition ready;
- post-deploy invocation of the RPC in a safe environment.

Also verify that the proposed fix actually serializes with closure. If the close/bracket transaction does **not** acquire the same advisory lock, checking status after acquiring the registration-only lock does not eliminate all races: closure can occur after the recheck and before insertion. A shared lock protocol or locking the tournament row and re-reading status is required for a real guarantee.

## 4. Native/web bias

Yes. The measured rate is:

> conversion among instrumented web users who reached the QuickTable singles surface and successfully sent GA events.

It is not:

> conversion among all users encountering registration friction.

Native users can differ materially in authentication state, OAuth friction, app deep-link behavior, device mix, and intent. Their complete absence can bias both the apparent wall exposure rate and completion rate. GA blocking/network loss adds further web selection bias.

For D5:

- report web singles numerator and denominator explicitly;
- report what fraction of eligible traffic is web versus native, if available from server logs or authenticated activity;
- do not combine default doubles or other uninstrumented surfaces into the denominator;
- do not extrapolate the measured rate to native without native telemetry or a clearly stated assumption.

If platform share is unknown, D5 does not have a product-wide funnel. It has a web-singles directional sample.
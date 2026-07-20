## Verdict

**UX-07 is the more dangerous change. Do not ship it as proposed.** It exposes anonymous users to registration paths with known database integrity failures. The predictable result is overbooked tournaments and spam registrations, not merely “risk.”

**UX-06 is also not safe as a simple `DELETE` → `UPDATE deleted_at` substitution.** It changes deletion semantics across 83 readers, child tables, RLS, registration functions, and SSR caching. For a solo-operated product with no prior deletion incident, building a cross-product undo system is the wrong first fix. Block destructive deletion when registrations or claimed payments exist instead.

---

# UX-07: concrete production failures

## 1. Doubles tournaments will overbook

**Mechanism:** The doubles registration RPC performs a non-serialized `count → capacity check → insert`. There is no advisory lock, row lock, or capacity constraint.

**Trigger:** Two guest registrations arrive concurrently for the final slot. Both transactions observe the same count below capacity, both pass, and both insert.

**User-visible symptom:** A tournament configured for N teams contains N+1 or more teams. The organizer cannot generate a valid bracket without manually rejecting someone who was told registration succeeded.

This is not hypothetical: the same race was already reproduced and fixed for social events. Opening registration to users who no longer need accounts increases the number and burstiness of calls into the unfixed path.

**Required fix before guest registration:** serialize registration per tournament inside the database, e.g. an advisory transaction lock followed by capacity re-check and insert in one transaction. Fix the member and guest paths together; creating a separate guest RPC while leaving the existing member RPC racy still leaves the invariant broken.

---

## 2. Quick Tables has no database capacity enforcement at all

**Mechanism:** Registration is a direct browser insert. Any displayed capacity or moderation rule is not enforced by Postgres.

**Trigger:** Many guests submit, or one person calls the Supabase REST endpoint repeatedly.

**User-visible symptom:** The organizer receives an arbitrary number of registrations and must manually reject them. If the UI presents registration as confirmed, players will believe they have places that do not exist.

If Quick Tables is intentionally an approval queue, label it explicitly as **“request to join,” not “registered.”** If it has a capacity, enforce that capacity in a locked RPC.

Do not enable guest registration by adding an `anon` INSERT policy to the existing table. That would permit callers to bypass the UI, Turnstile, OTP rate limits, and any frontend validation by calling PostgREST directly.

---

## 3. Mirroring the existing OTP call literally will fail for every tournament

**Mechanism:** The OTP sender requires an `event_id`, validates it as a UUID, and then requires a matching row in `social_events`.

**Trigger:** A tournament page calls it with either a tournament `share_id` or a tournament UUID.

**User-visible symptom:** The player enters a phone number and receives either “invalid event ID” or “event not found.” No OTP is sent, so the guest funnel is completely blocked.

The OTP service must be deliberately extended to support a typed target such as `(target_type, target_id)`, and the challenge must be bound to that exact target. It must not merely stop checking `social_events`.

---

## 4. A browser-direct guest path bypasses the existing abuse defenses

**Mechanism:** Turnstile, IP limits, phone limits, and the global SMS budget exist in the OTP Edge Function. They do not protect a direct Supabase table insert.

**Trigger:** Implementation grants `anon` INSERT so an OTP-verified browser can write registrations directly.

**User-visible symptom:** Fake registrations fill organizer lists despite no corresponding valid OTP flow. The SMS budget controls do nothing because the attacker never requests an SMS.

Final registration must go through a server-controlled RPC or Edge Function that verifies the OTP challenge and performs the insert. Anonymous direct INSERT should remain unavailable.

---

## 5. Missing grants will produce a production-only dead end

**Mechanism:** New guest tables, challenge tables, or RPCs are created without explicit `GRANT`/`REVOKE` statements. The management/editor test succeeds as superuser, while real `anon` or `authenticated` clients receive `42501`.

**Trigger:** First real guest attempts OTP verification or registration after deployment.

**User-visible symptom:** OTP may succeed, but the final registration fails with a generic error. Alternatively, every guest registration fails immediately while operator testing appeared successful.

Given this codebase’s repeated history, explicit privilege tests using the real `anon` and `authenticated` roles are a release requirement, not cleanup work.

---

## 6. There is no way to determine whether the simplified journey helped

This is not directly a registration outage, but it violates the stated house rule.

**Mechanism:** The tournament funnel has zero baseline instrumentation.

**Trigger:** UX-07 is released.

**Operator-visible symptom:** You can count registrations but cannot distinguish discovery, login-wall abandonment, OTP failure, capacity rejection, or registration completion. Any conversion claim is fabricated.

Instrument the current funnel before changing authentication requirements.

---

# UX-06: concrete production failures

## 1. Deleted tournaments remain publicly visible

**Mechanism:** `UPDATE deleted_at = now()` does not remove the row. Existing public `SELECT USING (true)` policies and existing queries return it unless every reader filters it.

**Trigger:** Organizer “deletes” a tournament after the soft-delete change.

**User-visible symptom:** The deletion toast succeeds, but the tournament remains in Community lists, remains reachable by its share link, or reappears after refresh.

There are approximately 83 SPA read sites plus SSR. A partial sweep guarantees inconsistent behavior: one format or page hides the row while another still exposes it.

---

## 2. Cascades no longer run, so child data remains independently active

**Mechanism:** `ON DELETE CASCADE` executes only on an actual `DELETE`. Updating `deleted_at` leaves matches, teams, registrations, and referees untouched.

**Trigger:** A tournament is soft-deleted while code still reads child tables directly or holds the tournament page open.

**User-visible symptom:** Registrations, teams, or matches from a “deleted” tournament still appear in dashboards and participant views. Notifications or organizer workflows can continue operating on them.

Retaining children is necessary for restore, but all child visibility and mutation must become conditional on the parent being active. Merely filtering the four parent tables is insufficient.

---

## 3. Users can register while the tournament is deleted

**Mechanism:** The soft-deleted parent row still exists, so foreign keys continue to accept child inserts. The doubles RPC and Quick Tables direct insert have no stated `deleted_at IS NULL` enforcement.

**Trigger:** A player has the page open when the organizer deletes it, uses a stale link, or submits through the API.

**User-visible symptom:** The organizer restores the tournament and discovers registrations created during the deletion window. Alternatively, a player sees “registration successful” for an event that has disappeared from the site.

Every registration transaction must lock/read the parent and reject registration unless it is active. A frontend check does not close this race.

---

## 4. Hiding deleted rows in RLS can make restore impossible

A tempting fix is changing public SELECT to:

```sql
USING (deleted_at IS NULL)
```

**Mechanism:** PostgreSQL UPDATE also depends on the row being visible under applicable policies. If the organizer cannot select the deleted row, a normal client-side UPDATE cannot target it for restoration.

**Trigger:** Organizer clicks Undo after the row has been hidden by RLS.

**User-visible symptom:** Restore affects zero rows or returns an authorization error; the UI claims the item cannot be found.

Adding an owner exception such as `deleted_at IS NULL OR created_by = auth.uid()` restores access, but then all old organizer-facing queries continue showing deleted tournaments unless they are separately filtered. A dedicated restore RPC with explicit authorization is safer than trying to make public RLS serve both active reads and tombstone management.

---

## 5. SSR and search previews remain stale for up to six hours

**Mechanism:** Tournament SSR is cached in KV by pathname, not by row state, for six hours.

**Trigger:** A cached tournament is deleted or restored without invalidating `pr:v30:${pathname}`.

**User-visible symptom:** Bots and link-preview crawlers continue seeing a deleted tournament for up to six hours. After a restore, they may continue seeing the deleted/not-found representation until expiry.

This cache staleness likely also affects hard deletion today, but a deletion/restore feature is incomplete unless both operations invalidate the exact SSR cache key.

---

## 6. Soft delete does not solve the paid-registration problem

**Mechanism:** The organizer can still hide a tournament containing registrations and claimed bank-transfer payments. There is no refund workflow.

**Trigger:** Organizer deletes a paid tournament, intentionally or accidentally.

**User-visible symptom:** Players who transferred money lose access to the active tournament page and receive no automated refund. Undo can make the row visible again, but it cannot undo messages, confusion, or manual payment handling.

If a later purge hard-deletes the row, the current cascade problem is merely delayed.

The correct invariant is: **do not allow deletion when registrations, claimed payments, completed matches, or other operational state exists.** Such tournaments should be cancellable/archivable with explicit participant communication, not “deleted.”

---

# What should be built instead

## For UX-06

Do not build a generic soft-delete layer across all four formats now.

Build one transactional deletion RPC per format, or a carefully typed shared RPC, that:

1. Confirms the caller owns the tournament.
2. Locks the tournament row.
3. Rejects deletion if registrations, claimed payments, completed matches, or other non-empty operational state exists.
4. Hard-deletes only genuinely empty drafts.
5. Invalidates the SSR KV key.
6. Returns a precise reason when deletion is refused.

For non-empty tournaments, add an explicit `cancelled` or `archived` lifecycle only after defining participant visibility and payment handling. That is a different product action from delete/undo.

## For UX-07

Do not ship until:

1. The doubles registration race is fixed with database serialization.
2. Quick Tables is explicitly either capacity-enforced registration or an approval queue.
3. Final guest registration is server-controlled; no anonymous direct inserts.
4. OTP challenges support and are bound to a typed tournament target.
5. All four registration paths reject inactive/deleted tournaments inside the transaction.
6. Explicit grants and real-role permission tests are included.
7. Funnel instrumentation is deployed before the UX change.

## Genuinely safe part

Adding a nullable `deleted_at` column with a `NULL` default to an existing table is generally harmless by itself. **Using that column as deletion semantics without updating all reads, writes, RLS, child behavior, and cache invalidation is not safe.**
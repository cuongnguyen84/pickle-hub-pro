## 1. How ARCH-02 can still lose money or strand a slot

The advisory locks protect **capacity accounting inside specific database transactions**. They do not make registration and payment one atomic operation.

The concrete refactor failure is **incorrect Supabase error propagation across the new hook boundary**:

```ts
const result = await supabase.rpc(...)
// Promise resolves as { data: null, error: ... }; it does not throw by default
```

If the extracted hook returns that object without explicitly throwing `error`, a caller using `mutateAsync()` or `try/catch` can treat a failed registration as success and continue to `create-payment-order` or `mark-payment-claimed`.

Trigger:

1. Registration/reactivation RPC returns `event_full`, an OTP/auth error, or a constraint error.
2. New hook fails to do `if (error) throw error` or changes the return shape.
3. Payment processing continues.

User-visible result:

- Payment is created or marked claimed.
- No active registration row exists.
- The UI may show payment success or leave the user in a paid-but-unregistered state.

The inverse partial failure is also possible:

1. Registration RPC commits and consumes the slot.
2. The hook misreads the extracted return shape or payment initiation fails.
3. UI reports registration failure.

Now the slot is held by a registration the user may not know exists. That is a stranded reservation, not database overbooking.

A UI-only extraction that preserves call order, parameters, return shape, and explicit `{error}` handling does **not** defeat the advisory locks. “React hooks might race” is not a specific failure by itself, and React Strict Mode does not double-run click handlers.

The required test is explicit: an RPC result of `{data: null, error: event_full}` must prove that neither payment-order creation nor payment claiming is called.

---

## 2. The missing member-path lock is already a live overbooking bug

Yes. It is independent of the refactor.

Mechanism: under normal Postgres `READ COMMITTED` behavior, two concurrent `register_event_as_member` transactions can both observe the same committed count.

Trigger with one slot remaining:

1. Registration A runs `SELECT COUNT(*)` and sees `max - 1`.
2. Registration B runs before A commits and also sees `max - 1`.
3. Both pass the capacity check.
4. Both insert distinct member registrations.
5. Both commit.

The event is now over capacity by one. With more concurrency, it can be over by more.

User-visible symptom:

- Both members receive successful registration.
- Organizer sees more active registrations than `max`.
- A later guest may receive `event_full` despite the platform having already accepted too many members.
- Someone must be manually removed/refunded or the event must accommodate the extra player.

`db-race.mjs` does not cover this path, so the current race test gives false confidence.

Fix this before or separately from ARCH-02 by taking the same event-scoped `pg_advisory_xact_lock` **before the count and insert**, then add the member path to the concurrent-session test. Merely extracting the RPC call into a hook does nothing to fix it.

---

## 3. How ARCH-03 can make the whole realtime channel silent

The concrete regression is consolidating another table onto the existing channel without ensuring that table is in `supabase_realtime`.

For example, the refactor changes the channel to bind:

- `team_match_matches`
- `team_match_games`
- `team_match_lineups` or another setup/event table

If that third table is not in the publication, Supabase can silently stop delivering changes for the **entire channel**, including the two valid tables.

The same failure can occur if a migration drops/recreates or renames one of the existing tables and fails to restore its publication membership. A dynamic/wrong table name can have the same effect depending on the Realtime server behavior.

What users see:

- Referee saves a score successfully; the database write is not lost.
- The referee may see the new score because the mutation updates or invalidates their local cache.
- Spectators receive no invalidation and continue seeing the old score.
- Edits from another referee/device also remain invisible.
- Reloading the page suddenly shows the correct score.

That is a scoring propagation failure, not necessarily a scoring-save failure.

If ARCH-03 only moves the two unchanged bindings and both remain in the publication, this particular concern is not real. The extraction alone does not silence Realtime. The failure requires an unpublished/invalid binding or broken subscription lifecycle.

Do not place unrelated tables on the same channel. Separate channels also prevent one bad publication binding from taking out all score propagation.

---

## 4. Ship separately; ARCH-03 has the higher refactor risk

Ship ARCH-02 and ARCH-03 as separate PRs and deployments. They have unrelated failure domains and different rollback signals:

- ARCH-02: registration/payment conversion, paid-without-registration, capacity.
- ARCH-03: score saving and realtime propagation.

Combining them makes an incident ambiguous and forces rollback of healthy registration changes to recover scoring, or vice versa.

ARCH-03 is the riskier **refactor**:

- Much larger untested hook/view surface.
- Realtime subscription lifecycle is timing-sensitive.
- No automated coverage.
- Known all-or-nothing channel failure mode.
- Two stale feature branches modify the same files, guaranteeing painful conflict resolution after a broad rewrite.

ARCH-02 has the higher financial consequence, but its most concrete capacity defect—the unlocked member RPC—is an existing database bug, not a consequence of moving calls out of JSX.

I would split ARCH-02 further if possible:

1. Add the member-path advisory lock and concurrency test.
2. Extract registration hooks without changing edge handlers.
3. Refactor edge handlers separately.

Do not mix a live concurrency fix, eight call-site rewires, and edge-handler template conversions into one review.

---

## 5. RED versus AMBER

Neither boundary refactor is inherently RED. AMBER is correct.

- Web changes can be rolled back through Cloudflare Pages.
- Edge handlers can be reverted and redeployed.
- ARCH-03 proposes no inherently irreversible data operation.
- An additive migration that serializes `register_event_as_member` is not production-breaking merely because there is no automatic down migration. If defective, it can be corrected with a forward migration or function replacement.

However, the member registration race is a **known live SLO defect** and should be treated as a release blocker for registration work. That does not make the UI refactor itself unrevertable; it means shipping ARCH-02 while knowingly leaving that RPC unlocked is operationally indefensible under a zero-lost-slot objective.

Final classification:

- **ARCH-02 refactor:** AMBER, after explicit Supabase error/return-shape tests; fix the member lock first.
- **ARCH-03 refactor:** AMBER, but higher likelihood of regression; require publication verification and a two-client realtime smoke test.
- **Combined deployment:** reject. It creates unnecessary rollback and diagnosis coupling.
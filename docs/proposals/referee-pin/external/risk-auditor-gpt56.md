<!-- =============================================================
VERBATIM PROMPT SENT TO GPT-5.6 (provider openai, gpt-5.6)
Saved by risk-auditor 2026-07-22. System + user brief below,
model reply follows after the marker.
============================================================= -->

## SYSTEM
You are a hostile staff SRE reviewing a change to a live product run by one person. Your job is to find the specific failure this change causes in production. Be concrete: name the mechanism, the trigger, the user-visible symptom. Reject generic risk language. If the change is genuinely safe, say so plainly and briefly.

## USER PROMPT (brief)
```markdown
# Change under review: "referee-PIN" self-enrollment for a pickleball tournament platform

## Product
ThePickleHub — a bilingual pickleball web app + native iOS app, ~2000 real users, run by ONE operator. Backend = Supabase (Postgres + RLS + edge functions). Web = React SPA on Cloudflare Pages. Native iOS = separate compiled binary that talks to the same Supabase directly with the public anon key.

## Existing referee model (already shipped, works)
There are 4 tournament "formats", each with its own set of tables:
- Parent tournament tables: `quick_tables`, `doubles_elimination_tournaments`, `flex_tournaments`, `team_matches`. These are PUBLICLY readable (RLS SELECT policy `USING (true)`, anon key can read every row).
- Referee join tables: `quick_table_referees`, `doubles_elimination_referees`, `team_match_referees`, `flex_tournament_referees`. Shape `{id, <fk>, user_id, created_at}`. RLS: only the tournament CREATOR (or admin) may INSERT/DELETE a referee row. SELECT is public.
- Being a referee = a `SECURITY DEFINER` function `is_<format>_referee(tournament_id, user_id)` returns true, which a separate RLS policy on the match/score tables consults to allow UPDATE of match scores. Referees can ONLY update match scores of that one tournament — not participants, not settings.

## The proposed feature
Organizer sets a short PIN (assume 4-6 digits/chars) per tournament, toggle on/off, editable in the setup wizard. Any LOGGED-IN user who types the correct PIN becomes a referee of that tournament (same powers as a manually-added referee). PIN "auto-expires when the tournament ends (a champion is crowned)". Manual add stays.

## Known constraints / prior incident on this exact codebase
1. Two months ago a "join secret" column (`invite_code`) on a publicly-readable table leaked to anon because RLS is ROW-level and cannot hide COLUMNS. Any caller did `select('invite_code')` and read every team's secret. Fix required column-level REVOKE + re-GRANT of every OTHER column.
2. That same fix had a trap: the installed native iOS binary does `select("*")` on some of these tables. Postgres requires SELECT privilege on EVERY referenced column, and `*` expands to all columns including a revoked one → the whole query returns error 42501. An installed native binary CANNOT be patched (no forced update) → column REVOKE on a table the native app `select("*")`s = every installed app breaks with no remediation. Verified: the native binary does `select("*")` on `doubles_elimination_tournaments`.
3. Doubles Elimination and Flex formats have NO standardized "completed"/champion column (status is a free-form string; only a team-level final_placement=1 implies a winner). Quick Table and Team Match do have a `completed` enum status.
4. Reliability policy: a lost/corrupted tournament bracket slot is a named INCIDENT (zero-tolerance), not a tolerable error rate.
5. There is an existing OTP rate-limit pattern (3 per 15 min per identity, 5 per IP) used for phone OTP.

## Your job
Find the specific way this breaks in production for real users. Name the mechanism, the trigger, and what a user or the operator sees. Cover at minimum: (a) how a stranger becomes referee of a live tournament and corrupts scores; (b) where the PIN can leak; (c) the native-app breakage angle; (d) the "auto-expire" gap for 2 of 4 formats; (e) whether an edge function / RPC is needed and how it can be abused. If some risk is overblown, say so plainly. Reject generic "there may be performance implications" language.
```

## ─────────── GPT-5.6 REPLY (verbatim) ───────────

## Verdict: block the naïve implementation

If this is implemented by adding `referee_pin` to the public tournament rows and exposing a client-side join flow, a stranger can obtain or guess the PIN, enroll as a legitimate referee, and then use the existing score-update RLS to alter live results. In elimination formats, those score writes can advance the wrong winner and corrupt bracket slots—your named incident condition.

### 1. Exact score-corruption path

**Mechanism**

1. Attacker obtains a public tournament ID from the publicly readable parent tables.
2. Attacker obtains the PIN through the parent row leak or guesses the 4–6 character PIN.
3. A privileged join endpoint inserts the attacker’s `auth.uid()` into the appropriate referee join table.
4. Existing `is_<format>_referee(...)` now returns true.
5. Existing match/score RLS authorizes the attacker’s updates.

**Trigger**

A tournament has PIN enrollment enabled and either:

- the PIN/verifier is exposed on a public relation, or
- the join endpoint lacks OTP-grade attempt limits.

**Visible result**

The attacker changes scores in a live match. Users see incorrect scores, an incorrect winner, and potentially incorrect advancement/bracket slots. The operator sees an apparently valid referee write; RLS does not distinguish guessed-PIN referees from manually appointed referees.

A person intentionally given the PIN becoming a referee is not a vulnerability—that is the feature. The failure is making the PIN publicly retrievable or cheaply guessable.

---

## 2. Do not put the PIN on any public parent table

RLS cannot hide the PIN column while allowing public access to the same rows. You already proved this in production.

These are all unsafe on a publicly readable parent table:

- Plaintext `referee_pin`
- A reversible encrypted PIN if the client can access the decryption path
- An unsalted SHA hash
- Even a salted ordinary hash exposed publicly: a 4-digit PIN has only 10,000 possibilities and can be cracked offline; six digits is still only 1,000,000

A caller can explicitly request the column through PostgREST. Hiding it from the normal frontend response or omitting it from TypeScript types does nothing.

Also do not send the PIN in a URL, query string, route, or GET request. That puts it into browser history and commonly into proxy/request logs. Use a POST body and ensure application logs do not serialize it.

### Safe storage shape

Use a separate non-public table, for example:

```text
tournament_referee_enrollment
- format
- tournament_id
- pin_hash
- enabled
- created_at
- updated_at
```

It must have no `SELECT` privilege or permissive SELECT policy for `anon` or ordinary `authenticated` users. Only narrow management and enrollment functions should touch it.

Use a password-style hash such as Argon2/bcrypt, or an HMAC with a server-held pepper. Because the PIN space is tiny, storage secrecy and online rate limiting are still mandatory.

---

## 3. The native iOS breakage is deterministic, not hypothetical

For `doubles_elimination_tournaments`, the shipped iOS binary does:

```sql
select("*")
```

If you add the PIN to that table and protect it using the previous column-privilege workaround, you must remove table-wide SELECT and grant only allowed columns. Then `*` expands to include the denied PIN column, and Postgres rejects the entire query with `42501`.

**Trigger:** deploying column-level protection for a PIN column on `doubles_elimination_tournaments`.

**User-visible symptom:** every installed version using `select("*")` fails to load doubles-elimination tournaments. There is no server-side way to repair that compiled query and no forced-update path.

Leaving the column readable avoids the app outage but leaks the PIN. That is not a valid tradeoff.

Adding an unrelated column by itself is not necessarily an iOS break; the confirmed break is the column REVOKE combined with the installed `select("*")`. A separate private table avoids both problems and is the correct compatibility boundary.

---

## 4. Raw client insertion must remain forbidden

Do not add an INSERT RLS policy like “authenticated users may insert themselves” and expect the client to prove it knows the PIN. RLS cannot safely validate a client-supplied secret unless the database has a protected verifier and a controlled function call.

You need either:

- a narrow Postgres RPC/`SECURITY DEFINER` function, preferably, or
- an edge function that authenticates the caller and invokes a narrow database operation.

The operation must atomically:

1. Require `auth.uid()` to be non-null.
2. Resolve the format through an allowlist, not arbitrary table names.
3. Lock/read the private enrollment row.
4. Check `enabled`.
5. Check the format-specific completion predicate.
6. Enforce and record rate limits.
7. Verify the PIN.
8. Insert `auth.uid()`—not a body-supplied `user_id`—into the correct referee table.
9. Return a generic failure without returning the stored verifier.

Atomicity matters. If an edge function first verifies the PIN and then separately inserts with a service-role client, this race exists:

- organizer disables enrollment or crowns the champion after verification;
- the delayed service-role insert still runs;
- the attacker becomes a referee after enrollment was supposed to close.

A transactional RPC prevents that check/insert race.

### `SECURITY DEFINER` requirements

A definer function must have:

- a fixed safe `search_path`,
- schema-qualified table names,
- no arbitrary SQL/table-name interpolation,
- explicit authenticated-user enforcement,
- execution revoked from `PUBLIC`/`anon` and granted only as intended,
- no caller-supplied `user_id`,
- a uniqueness constraint on `(tournament_id, user_id)` in each referee table.

Remember that functions commonly have `EXECUTE` granted to `PUBLIC` unless explicitly revoked.

### Edge-function abuse mode

An edge function using the service-role key bypasses all RLS. If it trusts any of these request fields, it becomes a privilege-escalation endpoint:

- `user_id`
- referee-table name
- arbitrary tournament format/table
- “enabled” or “completed” state supplied by the client

The authenticated UID must come from the verified JWT, and the server must derive every table and state decision itself. Ideally, the edge function calls one narrow transactional RPC rather than performing service-role inserts directly.

---

## 5. A short PIN without rate limiting is an online referee-creation oracle

A four-digit PIN has only 10,000 values. Public tournament IDs make the target set enumerable. An unrestricted endpoint lets an authenticated account try all PINs until one succeeds.

Apply at least the existing OTP policy:

- 3 attempts per 15 minutes per authenticated identity
- 5 attempts per 15 minutes per authoritative ingress IP

Count failed guesses, and preferably successful attempts as well to prevent endpoint probing. Store counters server-side; never trust a client IP header the caller can set.

Also decide whether limits are global as well as per tournament. A purely per-tournament limit permits password spraying: one common guess such as `1234` against every public live tournament. A global identity/IP budget prevents that.

Rate limiting does not make a leaked PIN safe. It only addresses online guessing. Organizers should also be warned against common PINs, or the system should generate random six-character codes rather than accept `1234`.

---

## 6. “Auto-expire” is undefined for two formats as currently modeled

Quick Table and Team Match have a canonical completed enum, so enrollment can reject joins once that state is reached.

Doubles Elimination and Flex do not have an equivalent standardized tournament completion field. Comparing a free-form `status` string to `"completed"` will fail as soon as existing rows use another spelling, language, capitalization, or lifecycle value.

**Trigger:** a Doubles or Flex tournament crowns a winner without setting the exact string expected by the enrollment endpoint.

**Visible result:** the tournament appears finished, but the PIN endpoint continues accepting new referees. Someone with a previously shared or guessed PIN can join after the event and alter scores.

`final_placement = 1` may be usable as the format-specific “champion crowned” predicate, but it must be deliberately implemented and transactionally checked. Better is a canonical completion timestamp/state for every format, set in the same transaction that crowns the champion.

Also clarify the requirement:

- If only the **PIN enrollment** expires, existing PIN-enrolled referees remain referees after completion.
- If their **score authority** must expire too, changing only the join endpoint is insufficient. The score-update RLS/`is_<format>_referee` path must also reject updates after completion, or the referee rows must be revoked.
- Do not accidentally disable manually appointed referees if only PIN-derived roles are intended to expire. The current join tables do not record how the referee was added, so add an enrollment source if that distinction matters.

---

## Required safe design

1. Keep all existing public parent schemas compatible with the installed iOS binary.
2. Store PIN verifiers in a separate private table.
3. Manage PINs through creator/admin-only RPCs.
4. Join through one narrow transactional RPC using `auth.uid()`.
5. Apply identity and IP rate limits and audit attempts.
6. Add explicit completion predicates for all four formats.
7. Decide whether completion closes enrollment only or also revokes referee powers.
8. Audit score changes with referee UID and timestamp so the operator can identify and reverse malicious writes.

Without those controls, this feature creates a direct public path from a leaked/guessed short PIN to authorized live-score and bracket corruption.
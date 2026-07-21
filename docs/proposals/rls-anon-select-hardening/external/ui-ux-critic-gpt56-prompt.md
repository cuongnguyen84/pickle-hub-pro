# Brief: UX impact of a column-level SELECT lockdown on a pickleball team-tournament app

## Product context
ThePickleHub — bilingual (Vietnamese-PRIMARY, ~95% VN users, English secondary) mobile-first
pickleball platform. React + shadcn/ui web + a native iOS/Android shell. Users mostly arrive
from a Facebook deep link to ONE page (a specific tournament), on a mid-tier Android on 4G,
one-handed, court-side. Design system "The Line": dark, mono uppercase micro-labels, serif team
names, status pills (green=confirmed, gold=pending, red=live).

## The change (backend security fix, but has real UX fallout)
Table `team_match_teams` currently has RLS `SELECT USING(true)` (fully public rows) AND no column
grants, so the anon API key running `select('*')` returns EVERY column — including 3 sensitive ones
that leak: `invite_code` (a team join secret), `captain_user_id` (PII), and `payment_status`
(unpaid | claimed | confirmed — the team's fee-payment state).

The fix mirrors an existing "profiles PII lockdown" migration: `REVOKE SELECT ... FROM anon,
authenticated`, then `GRANT SELECT (safe_col)` back for only the safe columns
(id, tournament_id, team_name, status, seed, group_id, created_at, ...). Sensitive columns get NO
grant. Legitimate reads of the sensitive columns move to `SECURITY DEFINER` RPCs that check
captain / team-member / organizer.

KEY POSTGRES BEHAVIOR: column privileges are NOT row-aware. If a client runs `select('*')` and
lacks privilege on even ONE column, the ENTIRE query errors (`42501 permission denied for column`).
So EVERY `select('*')` on this table breaks — for anon AND for the logged-in captain reading their
OWN team — until it's narrowed to explicit safe columns or routed through an RPC.

## Surfaces affected (current behavior)
1. **Public tournament page** `/tools/team-match/:id` (public by default). Fetches teams via
   `select('*')`. Renders a team list (names + status pills), standings, matches. Currently shows
   NO sensitive column in the UI to anyone. After the fix, the `select('*')` errors → teams come
   back undefined → team list/standings could go blank with no message.
2. **Captain's "invite code" copy button** — in the team detail sheet, a captain sees a "Copy
   invite code: ABC123" button. IMPORTANT: we audited and there is NO route or input anywhere that
   consumes a `team_match_teams` invite code — the only `/join/:code` route reads a DIFFERENT table
   (quick-table partner invites). So this copy button currently copies a code that leads nowhere.
3. **Native app team list** fetches `payment_status` for ALL viewers (even anon), though no viewer
   UI displays it. After the fix this select errors and the native list fails to decode → blank.
4. **Organizer views** — (a) a delete-confirmation dialog that counts "N teams have paid, deleting
   will lose that" by selecting `payment_status`; (b) an organizer-only payment roster showing each
   team's paid/unpaid chip with a "confirm payment received" button. Both break (column not granted)
   until routed through an organizer-scoped RPC.
5. **Captain's own payment status** — captain sees their own team's "you've paid / awaiting
   confirmation" state, currently read from the same `select('*')` list. Breaks; needs RPC.

## Constraints
- Mobile-first 390px. VI copy must be natural Vietnamese, not translated-English. VI runs ~30%
  longer than EN and breaks EN-width buttons.
- Court-side user, 4G, one glance. Empty/loading/error/offline states matter more than the happy path.
- Perf budget tight (p75 LCP <= 2.5s). Prefer not adding round trips on first paint.

## What I need from you (be concrete, name the element and the exact fix)
1. The invite-code copy button: given it leads nowhere for this table, do we (a) delete it,
   (b) keep it via an RPC, or (c) repurpose it? Your call + reason.
2. Public page degrade: exact empty/error copy (VI + EN) if a team list can't load, and whether to
   block the whole page or degrade per-section.
3. Native: should a viewer ever see a team's payment_status ("đã đóng phí") as social proof, or hide
   it entirely? Your call.
4. Organizer payment surfaces: acceptable to add one RPC round trip? Any UX regression to watch.
5. Any error/empty/offline copy strings (VI + EN) you'd write for these.
Keep it specific. No generic design platitudes.

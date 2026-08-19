# B14 — `delete-account` reports success while none of its cleanup runs

> **Status:** OPEN · **Severity:** 🟠 medium today, 🔴 high the moment somebody
> "fixes" it the obvious way · **Owner:** platform, not Shop
> **Found:** 2026-08-13, while working out what account deletion does to a shop
> owner (B12). **Not fixed here, deliberately** — see §5.

---

## 1. What happens

`supabase/functions/delete-account/index.ts` walks a list of thirteen tables,
deleting the caller's rows, then deletes the auth user. Called for real against
a live stack, with a real user JWT, it returns **HTTP 200**:

```json
{"success":true,"message":"Account deleted successfully","warnings":[
 "notifications: permission denied for table notifications",
 "comments: permission denied for table comments",
 "likes: permission denied for table likes",
 "follows: column follows.follower_user_id does not exist",
 "quick_tables: permission denied for table quick_tables",
 "team_match_roster: permission denied for table team_match_roster",
 "team_match_tournaments: permission denied for table team_match_tournaments",
 "doubles_elimination_tournaments: permission denied for table doubles_elimination_tournaments",
 "partner_invitations: Could not find the table 'public.partner_invitations' in the schema cache",
 "partner_invitations: Could not find the table 'public.partner_invitations' in the schema cache",
 "user_roles: permission denied for table user_roles",
 "organization_members: Could not find the table 'public.organization_members' in the schema cache",
 "profiles: permission denied for table profiles"]}
```

**Thirteen steps, thirteen failures, one success response.** Nothing in the
client reads `warnings`: `useDeleteAccount` looks at `response.error` only.

The account *is* deleted — entirely through `ON DELETE CASCADE` from
`auth.users`. The explicit cleanup has been decorative for as long as the
grants have been this way.

Reproduced by `scripts/shop-account-deletion-b12.test.mjs`, which asserts the
above as **characterisation, not approval**, and says so at the assertion.

---

## 2. Three separate causes wearing one coat

| Cause | Tables | Note |
|---|---|---|
| **Missing `service_role` grant** (10) | `notifications`, `comments`, `likes`, `quick_tables`, `team_match_roster`, `team_match_tournaments`, `doubles_elimination_tournaments`, `user_roles`, `profiles` | `service_role` bypasses RLS but **not** GRANT. Every Shop table has the grant (`20260811160000`); these are all **pre-Shop** tables, so this list was in neither of the repo's two grants sweeps |
| **Table does not exist** (2) | `partner_invitations`, `organization_members` | Listed twice and once respectively; dropped or never created |
| **Column renamed** (1) | `follows.follower_user_id` | The column is now something else |

Affected function: `delete-account` (the only caller).
Affected surface: `useDeleteAccount` → `DeleteAccountDialog` (`/account`).

---

## 3. Why it is not "high" today

Nothing is lost. The FK graph does the work the loop claims to do:

| Data | Reality on account deletion |
|---|---|
| `profiles`, `comments`, `likes`, `follows`, `notifications`, `user_roles`, `doubles_elimination_tournaments` | CASCADE — genuinely deleted |
| `quick_tables`, `team_match_tournaments`, `team_match_roster` | **SET NULL** — the tournament survives, unlinked |
| Shop domain (`shop_applications`, `legal_acceptances`, `shop_members`, `shop_pilot_members`) | CASCADE — genuinely deleted |
| Moderation history (`*_events.actor_user_id`, `audit_logs.actor_id`) | SET NULL — kept, anonymised |
| `shops` | RESTRICT — see [B12](../proposals/shop-closed-pilot/account-deletion-b12.md) |

The user-facing consequence is a **copy** bug, now fixed: the dialog promised
to delete "the tournaments you created", which SET NULL never did.

---

## 4. Why it becomes high the moment it is "fixed"

The loop runs **before** `auth.admin.deleteUser`, with no transaction around
any of it. It is harmless only because every step fails.

Grant the ten missing permissions as a standalone patch and, that same day:

1. a deletion that is going to fail at the last step — a shop owner, before
   B12's check existed; any future RESTRICT — first destroys the profile,
   roles, comments and avatar;
2. the account survives, signed in, with no profile row and no screen that
   knows what to do about it;
3. and `quick_tables` / `team_match_tournaments` start being **hard deleted**
   instead of unlinked, which is a different product decision that nobody has
   taken.

> 🔴 **Do not grant the missing `service_role` permissions as an isolated fix.**
> The grants are not the bug; the bug is a multi-step delete with no ordering
> guarantee and a success response that does not depend on its own steps.

B12's owner check is now the first thing `delete-account` does, which contains
the worst version of (1) for the case we know about. It does not contain the
general shape.

---

## 5. What a real fix looks like (not scheduled here)

Roughly, and in this order:

1. **Decide the policy per table** — deleted, unlinked, or retained-anonymised.
   `SET NULL` on tournaments is probably right; the copy should describe it,
   which it now does.
2. **Make the endpoint's success depend on its own work.** A step that fails is
   a failed deletion, not a warning nobody reads.
3. **Do it in one transaction, or make it resumable.** An RPC in Postgres can
   have the first; an edge function calling PostgREST then GoTrue cannot.
4. **Only then** grant exactly the permissions that survive step 1, table by
   table, with a test per table.
5. Delete the two tables that no longer exist and fix the renamed column
   before anything else, since those are dead code regardless.

**Precondition for opening self-service deletion more widely** (beyond the
closed pilot's manual offboarding): steps 1–4 done.

---

## 6. Registry

- `CLAUDE.md` → **Known Bugs (Not Fixed)** carries a one-line pointer here.
- No GitHub issue was created: pushing is not authorised in this checkpoint.
- Related: [B12 — shop-owner offboarding](../proposals/shop-closed-pilot/account-deletion-b12.md)
  (closed with option C) · [B13 — media reconcile](../proposals/shop-closed-pilot/account-deletion-b12.md#6--b13)
  (fixed, migration `20260814110000`).

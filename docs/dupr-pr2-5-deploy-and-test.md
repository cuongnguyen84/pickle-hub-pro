# DUPR RaaS PR2-5 — deploy + test runbook

Companion to `docs/PR1-deploy-and-test.md`. Operator runs these steps in
order against the **UAT** project (`ajvlcamxemgbxduhiqrl`) before recording
the partnership demo.

> **Don't auto-deploy.** Per `CLAUDE.md`, migrations apply manually via SQL
> Editor and edge functions deploy manually via CLI. Confirm each step
> before moving on.

---

## 0. Environment + secrets sanity

All required secrets are already set on UAT (per `secrets.local.md`). Verify:

```bash
# Should print: DUPR_ENV, DUPR_CLIENT_ID, DUPR_CLIENT_KEY, DUPR_CLIENT_SECRET
SUPABASE_ACCESS_TOKEN=<sbp_...> \
  npx supabase secrets list --project-ref ajvlcamxemgbxduhiqrl 2>&1 | grep -E '^DUPR_'
```

Confirm `DUPR_ENV=uat` so all clients route to `uat.mydupr.com` and
`api.uat.dupr.gg`.

---

## 1. Apply migrations (SQL Editor → New query)

Run in this order. Each script ends with a verification SELECT — paste +
inspect before proceeding to the next.

### 1.1 `20260520010000_dupr_pr4_matches_sync_columns.sql`

Adds 4 columns to `matches`: `dupr_sync_status`, `dupr_sync_error`,
`dupr_sync_attempted_at`, `dupr_hashed_match_code`.

Verification:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'matches'
  AND column_name IN ('dupr_sync_status', 'dupr_sync_error',
                      'dupr_sync_attempted_at', 'dupr_hashed_match_code')
ORDER BY column_name;
-- Expected: 4 rows, all nullable.
```

### 1.2 `20260520020000_dupr_pr5_organizations_club_link.sql`

Adds 5 columns to `organizations`, partial unique index on `dupr_club_id`,
RPC `user_can_admin_organization(uuid)`.

Verification:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'organizations'
  AND column_name LIKE 'dupr_%'
ORDER BY column_name;
-- Expected: 5 rows.

SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'user_can_admin_organization';
-- Expected: 1 row.

SELECT indexname
FROM pg_indexes
WHERE tablename = 'organizations'
  AND indexname = 'organizations_dupr_club_id_unique';
-- Expected: 1 row.
```

---

## 2. Deploy edge functions

```bash
export SUPABASE_ACCESS_TOKEN=<sbp_...>
PROJECT_REF=ajvlcamxemgbxduhiqrl

# New functions for PR2-5
for fn in \
  dupr-entitlements \
  dupr-refresh-user-token \
  dupr-webhook \
  dupr-webhook-register \
  dupr-webhook-test-fire \
  dupr-match-submit \
  dupr-clubs \
  dupr-org-link-club \
  dupr-org-unlink-club ; do
  npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done
```

Confirm:

```bash
npx supabase functions list --project-ref "$PROJECT_REF" \
  | grep -E '^(dupr-entitlements|dupr-refresh-user-token|dupr-webhook|dupr-webhook-register|dupr-webhook-test-fire|dupr-match-submit|dupr-clubs|dupr-org-link-club|dupr-org-unlink-club)'
```

Expected 9 rows.

---

## 3. End-to-end demo per PR

The demo uses the test users from `secrets.local.md`:

* **testuser101** (`164bf347-a896-41e8-b351-4bb0416193f5`) — DUPR id `YGONMK`, DIRECTOR of test club `7628571463`.
* **testuser103** (`99db7401-9eaf-4c49-a094-8581216bf606`) — DUPR id `XJYKO7`, no club.

Helpers for the curl examples:

```bash
SECRET=$(curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/ajvlcamxemgbxduhiqrl/api-keys?reveal=true" \
  | jq -r '.[] | select(.name=="default" and .type=="secret") | .api_key')
BASE=https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1
```

For per-user calls you also need a USER_JWT for the test user. Mint one
ad hoc via Auth admin (use the password-reset cmd from `secrets.local.md`
section "Quick smoke tests" then sign in via the SPA preview).

### 3.1 PR2 — user gating via entitlements

```bash
# As testuser101 (SSO-connected): cache-bypass, force refresh
curl -sS -X POST -H "Authorization: Bearer $USER_JWT" \
  "$BASE/dupr-entitlements?force=1" | jq

# Expected:
# {
#   "display_name": "...",
#   "status": "ACTIVE",
#   "entitlements": { "tournaments": ["BASIC_L1", ...] },
#   "fetched_at": "2026-05-20T...",
#   "expires_at": "2026-05-21T...",
#   "cached": false
# }
```

Run again without `force=1` → should return `cached: true` and the same
timestamps. After 24h, next call refreshes.

Verify DB row:

```sql
SELECT user_id, display_name, status,
       entitlements ? 'tournaments' AS has_tournaments,
       fetched_at, expires_at
FROM public.dupr_user_entitlements
WHERE user_id = '164bf347-a896-41e8-b351-4bb0416193f5';
```

Refresh-token helper (only fires the refresh flow — does not return the
new access token to the client):

```bash
curl -sS -X POST -H "Authorization: Bearer $USER_JWT" \
  "$BASE/dupr-refresh-user-token" | jq

# Expected: { "refreshed_at": "...", "ok": true }
```

UI verification: open `https://dupr-uat-review.pickle-hub-pro.pages.dev/`
as testuser101, navigate to "Create match" wizard, toggle "Submit to DUPR".
The toggle should be enabled (BASIC_L1 present). Sign in as a NON-connected
user — toggle should be disabled with the warning copy.

### 3.2 PR3 — rating webhook subscribe + receive

The webhook URL is already registered (per `secrets.local.md`). Re-register
is a no-op:

```bash
curl -sS -X POST -H "Authorization: Bearer $SECRET" \
  "$BASE/dupr-webhook-register" | jq
# Expected: { "registered": true, "environment": "uat",
#             "webhookUrl": "https://.../functions/v1/dupr-webhook",
#             "topics": ["RATING"], "dupr_response": {...} }
```

Confirm a user is subscribed (PR1 SSO callback already does this; the
column is on `dupr_user_tokens`):

```sql
SELECT user_id, dupr_id, webhook_subscribed_at, revoked_at
FROM public.dupr_user_tokens
WHERE user_id = '164bf347-a896-41e8-b351-4bb0416193f5';
-- Expected: webhook_subscribed_at IS NOT NULL, revoked_at IS NULL.
```

Fire a synthetic RATING event to our own receiver (operator-only):

```bash
curl -sS -X POST -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"164bf347-a896-41e8-b351-4bb0416193f5","singles":4.27,"doubles":4.41}' \
  "$BASE/dupr-webhook-test-fire" | jq
# Expected: { "fired": true, "payload": {...}, "receiver": { "status": 200, "body": { "status": "ok", "dupr_id": "YGONMK", "singles": 4.27, "doubles": 4.41 } } }
```

Verify side effects:

```sql
-- Receiver persisted the raw event
SELECT id, topic, dupr_id, processed_at, processing_error
FROM public.dupr_webhook_events
WHERE dupr_id = 'YGONMK'
ORDER BY received_at DESC
LIMIT 1;

-- profiles.dupr_singles/dupr_doubles updated
SELECT id, dupr_id, dupr_singles, dupr_doubles, dupr_synced_at
FROM public.profiles
WHERE id = '164bf347-a896-41e8-b351-4bb0416193f5';

-- history appended with source='dupr_webhook'
SELECT recorded_at, source, dupr_singles, dupr_doubles
FROM public.dupr_rating_history
WHERE profile_id = '164bf347-a896-41e8-b351-4bb0416193f5'
ORDER BY recorded_at DESC
LIMIT 3;
```

Disconnect flow already calls `unsubscribeRating` (PR1 update). Verify:

```bash
curl -sS -X POST -H "Authorization: Bearer $USER_JWT" \
  "$BASE/dupr-disconnect" | jq
# Then re-connect via SSO so webhook_subscribed_at re-populates.
```

### 3.3 PR4 — match upload, update, delete

Create a real `matches` row in the SPA wizard with `submit_to_dupr=true`,
verify both teams (the existing `match-confirm` flow). Once
`verification_status = 'verified'`, fire DUPR submission:

```bash
# MATCH_ID = the uuid of the row in `matches`
MATCH_ID=...
curl -sS -X POST -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "action":"create",
    "internal_source":"match",
    "internal_match_id":"'"$MATCH_ID"'",
    "match_date":"2026-05-20",
    "format":"DOUBLES",
    "match_type":"SIDEOUT",
    "event":"ThePickleHub demo",
    "team_a":{ "player1":"YGONMK","player2":"XJYKO7","game1":11,"game2":11 },
    "team_b":{ "player1":"<duprId>","player2":"<duprId>","game1":7,"game2":9 }
  }' "$BASE/dupr-match-submit" | jq
# Expected: { "created": true, "match_code": "...", "hashed_match_code": "...",
#             "identifier": "tph:match:<MATCH_ID>", "match_source": "PARTNER" }
```

Verify the mirror onto `matches`:

```sql
SELECT id, dupr_match_id, dupr_hashed_match_code, dupr_submitted_at,
       dupr_sync_status, dupr_sync_error
FROM public.matches
WHERE id = '<MATCH_ID>';
-- Expected: dupr_sync_status = 'submitted', dupr_match_id NOT NULL.
```

Update flow (only changed score):

```bash
curl -sS -X POST -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "action":"update",
    "internal_source":"match",
    "internal_match_id":"'"$MATCH_ID"'",
    "team_a":{ "player1":"YGONMK","player2":"XJYKO7","game1":11,"game2":11,"game3":11 },
    "team_b":{ "player1":"<duprId>","player2":"<duprId>","game1":7,"game2":11,"game3":5 }
  }' "$BASE/dupr-match-submit" | jq
# Expected: { "updated": true, "match_code": "..." }
```

Delete flow:

```bash
curl -sS -X POST -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "action":"delete",
    "internal_source":"match",
    "internal_match_id":"'"$MATCH_ID"'"
  }' "$BASE/dupr-match-submit" | jq
# Expected: { "deleted": true, "match_code": "..." }
# matches.dupr_sync_status flips to 'superseded'; submitted_to_dupr → false.
```

UI verification: drop the `MatchDuprStatus` component on the match detail
page (paste the import + usage shown in
`src/components/social/match/MatchDuprStatus.tsx`). It will render a green
"Submitted to DUPR" badge with the match code + a "View on DUPR" link.

### 3.4 PR5 — club integration

List the caller's DUPR clubs (used by the linking dialog):

```bash
curl -sS -X POST -H "Authorization: Bearer $USER_JWT" \
  "$BASE/dupr-clubs?force=1" | jq
# Expected: { "clubs": [{ "club_id": 7628571463, "club_name": "The Pickle Hub Test Club", "role": "DIRECTOR" }], "cached": false }
```

Link the test club to an existing org. Find an org id first:

```sql
SELECT id, name FROM public.organizations ORDER BY created_at LIMIT 5;
```

Then:

```bash
ORG_ID=<from-above>
curl -sS -X POST -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id":"'"$ORG_ID"'",
    "dupr_club_id":"7628571463"
  }' "$BASE/dupr-org-link-club" | jq
# Expected: { "organization": { id, name, slug, dupr_club_id, dupr_club_name, dupr_club_role: "DIRECTOR", dupr_linked_at, dupr_linked_by } }
```

If the caller doesn't own the org (no admin role + no `profiles.organization_id = ORG_ID`), expect 403 `not_org_admin`.
If the caller isn't DIRECTOR/ORGANIZER on DUPR side, expect 403 `insufficient_role`.
If another org has already claimed the club, expect 409 `club_already_linked`.

Verify on DB:

```sql
SELECT id, name, dupr_club_id, dupr_club_name, dupr_club_role,
       dupr_linked_at, dupr_linked_by
FROM public.organizations
WHERE id = '<ORG_ID>';
```

Re-submit the match from §3.3 — this time `match_source` should be `CLUB`:

```sql
-- Make the recorded_by belong to the org first if needed
UPDATE public.profiles SET organization_id = '<ORG_ID>'
WHERE id = '164bf347-a896-41e8-b351-4bb0416193f5';
```

Then re-fire the create payload from §3.3 — response should include
`"match_source": "CLUB"`, and DUPR's `/match/v1.0/create` should accept it
with `clubId: 7628571463`. Inspect `dupr_match_submissions.raw_request` to
confirm `matchSource: "CLUB"` + `clubId`:

```sql
SELECT raw_request -> 'matchSource' AS source,
       raw_request -> 'clubId'      AS club_id
FROM public.dupr_match_submissions
ORDER BY submitted_at DESC LIMIT 1;
```

Unlink:

```bash
curl -sS -X POST -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"organization_id":"'"$ORG_ID"'"}' \
  "$BASE/dupr-org-unlink-club" | jq
# Expected: { "organization": { ... dupr_club_id: null ... } }
```

UI verification: paste `<OrganizationDuprClubCard organizationId={...} />`
onto `OrganizationDetail.tsx`. Logged in as testuser101, click "Link DUPR
Club" → pick the test club → confirm. Card updates inline.

---

## 4. Rollback notes

* Migrations are additive — to rollback PR4 columns:
  `ALTER TABLE public.matches DROP COLUMN dupr_sync_status, DROP COLUMN dupr_sync_error, DROP COLUMN dupr_sync_attempted_at, DROP COLUMN dupr_hashed_match_code;`
* For PR5 unlinking is a UI op (preferred); to drop the columns:
  `ALTER TABLE public.organizations DROP COLUMN dupr_club_id, DROP COLUMN dupr_club_name, DROP COLUMN dupr_club_role, DROP COLUMN dupr_linked_at, DROP COLUMN dupr_linked_by;`
* Edge functions: redeploy a previous version via the dashboard or
  `npx supabase functions deploy <name> --project-ref ... --no-verify-jwt`
  pointing at the prior git ref.

---

## 4.bis — 5-video screen-record guide (single page /dupr)

After deploying §1-§2, open `https://dupr-uat-review.pickle-hub-pro.pages.dev/dupr` signed in as **testuser101** (`164bf347-...`). The page renders 7 sections mapped 1:1 to the 5 DUPR videos. Record each video by scrolling to the right section and performing the action below.

### Video 1 — SSO connection (PR1)

Section **"1. Connection (SSO)"**.

- Show `Pill: SSO connected` + `DUPR ID: YGONMK` + Singles/Doubles.
- Click `Disconnect`. Page flips to `Not connected`. Connect button appears.
- Click `Connect`. The DUPR iframe opens, user enters credentials, postMessage fires, page now shows `SSO connected` again with `Method: sso`.
- (Optional) open the DUPR profile in a new tab to show round-trip.

### Video 2 — Entitlements (PR2)

Section **"2. Entitlements (User Gating)"**.

- Show three pills: `BASIC_L1` (green), `PREMIUM_L1`, `VERIFIED_L1`.
- Click the `RefreshCw` button. The pills repaint, fetched-at timestamp ticks. The JSON entitlements block updates.
- (Optional) navigate to `/match` → CreateTab. Show that the form is reachable because BASIC_L1 is present. Sign out and back in as testuser103 (no entitlement) — toggle disabled with the bilingual warning copy.

### Video 3 — Rating webhook (PR3)

Section **"3. Webhook (RATING events)"**.

- Show `Pill: Subscribed (RATING)` + Subscribed-at timestamp.
- Show `Live singles` + `Live doubles` from `profiles`.
- Set `Singles=4.27 / Doubles=4.41`. Click `Fire test webhook`.
- The JSON response shows `receiver: { status: 200, body: { status: "ok", singles: 4.27, doubles: 4.41 } }`.
- The "Live singles/doubles" + "Last 5 events" table refresh — the new event is at the top with status `OK`.
- This proves: subscription registered (PR1 SSO callback wired it), receiver validates clientId, persists to `dupr_webhook_events`, updates `profiles.dupr_singles/doubles`, appends `dupr_rating_history`.

### Video 4 — Match create / update / delete (PR4)

Section **"4a. Submit match"** + **"4b. Submitted matches"**.

- 4a: leave defaults (Format=SINGLES, ClubID empty → PARTNER source, internal_match_id auto). Set Team A player1 = `YGONMK`, Team B player1 = `XJYKO7`. Click **Submit match to DUPR**.
- Response JSON shows `created: true, match_code: "...", hashed_match_code: "...", identifier: "tph:uat-dashboard:demo-..."`.
- Scroll to 4b. New row at the top with `Status: ACTIVE` + the match code.
- Click **Delete** on that row. Confirm. Response: `{ deleted: true, match_code: "..." }`. Row status flips to `DELETED`.
- (Optional) For Update flow: re-submit a slightly different score using the same internal_id — the system will reject with `match_not_found` (since identifier is fresh). To show update, use a previously-submitted ID and call via curl per §3.3.

### Video 5 — Club integration (PR5)

Sections **"5a. Your DUPR clubs"** + **"5b. Link DUPR Club ↔ Organization"**.

- 5a: table shows `The Pickle Hub Test Club / DIRECTOR / 7628571463 / Open on DUPR`. This is the user's DUPR-side membership.
- 5b: pick an organization from the dropdown. The `OrganizationDuprClubCard` appears.
- Click **Link DUPR Club**. Dialog opens with the eligible clubs (DIRECTOR/ORGANIZER only — the test club).
- Pick the club, click **Link**. Card updates inline showing `The Pickle Hub Test Club / DIRECTOR / linked-at timestamp`.
- (Optional) scroll back to 4a, run another submit — now check the response in 4b: `match_source: "CLUB"` because the function derived `clubId` from the linked org.
- Click **Unlink** on 5b card. Card returns to unlinked state.

> **Pre-demo sanity:** sign in as `thecuong@gmail.com` (admin) or set
> `profiles.organization_id` for testuser101 to point to an org you want to
> demo on, otherwise the 5b dropdown will be empty.

---

## 5. Known caveats during the demo

* The DUPR UAT environment occasionally returns `clientId` as the numeric
  `DUPR_CLIENT_ID` instead of `DUPR_CLIENT_KEY`. `dupr-webhook` accepts
  either; no action required.
* `dupr-refresh-user-token` deliberately does NOT echo the new access token
  to the SPA. The hardening migration (20260516050000) revoked column-level
  grants — only service_role can read tokens. The function reports `ok: true`
  on success.
* PR5 ownership gate is intentionally permissive (admin OR org member with
  admin/creator role). A future `organization_members` table can tighten this
  without re-deploy.
* Match → organization lookup currently uses the submitter's
  `profiles.organization_id` (not the parent tournament). When
  `parent_tournaments.organization_id` lands, update
  `resolveOrgClubForMatch` in `dupr-match-submit/index.ts` to walk through
  the tournament.

---

## 6. Branch + PR open

```bash
cd /Users/cuongmit/pickle-hub-pro
git checkout main && git pull
git checkout -b feat/dupr-raas-pr2-5

# Stage all changes
git add docs/dupr-pr2-5-audit.md \
        docs/dupr-pr2-5-deploy-and-test.md \
        supabase/migrations/20260520010000_dupr_pr4_matches_sync_columns.sql \
        supabase/migrations/20260520020000_dupr_pr5_organizations_club_link.sql \
        supabase/functions/dupr-refresh-user-token/index.ts \
        supabase/functions/dupr-webhook-test-fire/index.ts \
        supabase/functions/dupr-org-link-club/index.ts \
        supabase/functions/dupr-org-unlink-club/index.ts \
        supabase/functions/dupr-match-submit/index.ts \
        supabase/config.toml \
        src/components/social/match/MatchConfirmation.tsx \
        src/components/social/match/MatchDuprStatus.tsx \
        src/components/organization/OrganizationDuprClubCard.tsx \
        src/hooks/useOrganizationDuprClub.ts \
        src/pages/DuprDashboard.tsx

git commit -m "feat(dupr): PR2-5 — entitlements gating, webhook hooks, match sync mirror, org club linking

- Add matches.dupr_sync_status/error/attempted_at/hashed_match_code (PR4)
- Add organizations.dupr_club_* + user_can_admin_organization() (PR5)
- New edge fns: dupr-refresh-user-token, dupr-webhook-test-fire,
                dupr-org-link-club, dupr-org-unlink-club
- Update dupr-match-submit to mirror state on matches + inherit club_id
  from organization
- Gate MatchConfirmation 'Submit to DUPR' toggle on BASIC_L1 entitlement
- Register all 9 PR2-5 functions in config.toml

See docs/dupr-pr2-5-audit.md for the pre-implementation audit and
docs/dupr-pr2-5-deploy-and-test.md for the runbook."

git push -u origin feat/dupr-raas-pr2-5

# Open the PR
gh pr create --base main --head feat/dupr-raas-pr2-5 \
  --title "DUPR RaaS: PR2-5 (entitlements + webhook + match sync + clubs)" \
  --body-file - <<'EOF'
## Summary

Closes the gap between PR1 (SSO foundation, already merged) and a full
DUPR partnership demo. One consolidated branch for PR2-5 per
docs/dupr-pr2-5-audit.md.

### PR2 — user gating via entitlements
- Migration: relies on existing dupr_user_entitlements table from
  20260516010000.
- New helper edge fn: `dupr-refresh-user-token`.
- Wires `useDuprEntitlements` into MatchConfirmation 'Submit to DUPR'
  toggle (BASIC_L1 gate + bilingual error copy).

### PR3 — rating webhook subscribe + receive
- No new schema (re-uses dupr_user_tokens.webhook_subscribed_at and
  dupr_webhook_events from 20260516020000).
- SSO callback already calls `subscribeRating` (PR1 already wired).
- Disconnect already calls `unsubscribeRating` (PR1 already wired).
- New demo helper: `dupr-webhook-test-fire` (admin-only synthetic event).

### PR4 — match upload, update, delete
- New migration: `20260520010000_dupr_pr4_matches_sync_columns.sql` adds
  `dupr_sync_status / dupr_sync_error / dupr_sync_attempted_at /
  dupr_hashed_match_code` to `matches`.
- `dupr-match-submit` (existing single-fn dispatcher) now mirrors all
  state onto the `matches` row when `internal_source === 'match'`, so
  the UI doesn't need to JOIN the audit table.
- New `<MatchDuprStatus />` component for the match detail page with
  status badge + retry button.

### PR5 — club integration
- New migration: `20260520020000_dupr_pr5_organizations_club_link.sql`
  adds `dupr_club_id / dupr_club_name / dupr_club_role / dupr_linked_at
  / dupr_linked_by` to `organizations`, plus partial unique index +
  `user_can_admin_organization()` RPC.
- New edge fns: `dupr-org-link-club`, `dupr-org-unlink-club`.
- `dupr-match-submit` now derives `clubId` from the submitter's
  `profiles.organization_id → organizations.dupr_club_id` and uses
  `matchSource=CLUB` when present (with role re-verification).
- New `<OrganizationDuprClubCard />` + `useOrganizationDuprClub` hook.

### config.toml
Registered 9 functions: `dupr-entitlements`, `dupr-refresh-user-token`,
`dupr-webhook`, `dupr-webhook-register`, `dupr-webhook-test-fire`,
`dupr-match-submit`, `dupr-clubs`, `dupr-org-link-club`,
`dupr-org-unlink-club` — all `verify_jwt = false` per the ES256/HS256
workaround.

## Open questions for operator sign-off

1. **Organization ownership model** — the link/unlink functions use
   "admin OR (org member with admin/creator role)". Confirm this is OK
   for UAT demo, or sign off on adding `organization_members` first.
2. **Match → org lookup** — currently uses
   `profiles.organization_id` of the submitter. Once
   `parent_tournaments.organization_id` exists, switch to that.
3. **Webhook HMAC** — DUPR UAT didn't return a signing secret. Confirm
   prod expectation; HMAC verification will be added in a follow-up if
   DUPR provides one.
4. **Single-function vs three for match CRUD** — kept the `{action}`
   dispatcher rather than splitting. Confirm OK.

## How to test

See `docs/dupr-pr2-5-deploy-and-test.md` for the full runbook with curl
examples per requirement.

## Out of scope

- Token encryption (separate pre-prod PR).
- Removing legacy `dupr-link / dupr-sync / dupr-parser / dupr-validation`.
- Cron jobs for entitlement / club refresh (caller-driven only).
- Migrating `pending_reconnect` users automatically.
EOF
```

# DUPR RaaS PR2-PR5 — Pre-implementation audit

**Branch target:** `feat/dupr-raas-pr2-5` (consolidated; off `main`).
**Audit date:** 2026-05-20.
**Auditor:** Claude (Cowork mode).

This audit answers the prompt's required questions before any new code is written. **TL;DR:** PR2, PR3, PR4 are ~80% present in source from prior sprint work but never wired into the UI and never listed in `supabase/config.toml`. PR5 (organization → DUPR club linking) is the largest real gap — schema, functions, and UI all missing.

---

## 0. Audit scope

The prompt asks for one consolidated branch implementing PR2-5. Source already contains migrations `20260516010000`-`20260516060000` and edge functions `dupr-entitlements`, `dupr-webhook`, `dupr-webhook-register`, `dupr-match-submit`, `dupr-clubs`, `dupr-disconnect`. The work needed is therefore:

1. Close the gaps below (PR2-5).
2. Register every new function in `supabase/config.toml` (currently only PR1 functions are listed).
3. Wire `MatchConfirmation.tsx` so the "Submit to DUPR" toggle actually invokes `dupr-match-submit`.
4. Build PR5 from scratch — schema + functions + UI.
5. Add a demo helper (`dupr-webhook-test-fire`) so the partnership reviewer can see a RATING event flow end-to-end without waiting for DUPR to actually push.

---

## 1. PR2 — User gating via entitlements

### What exists

- `supabase/migrations/20260516010000_dupr_entitlements.sql` creates `dupr_user_entitlements` (separate table, JSONB column, 24h TTL).
- `supabase/migrations/20260516050000_dupr_security_hardening.sql` defines two RPCs: `dupr_user_has_entitlement(text,text)` (caller-pinned to `auth.uid()`) and `dupr_user_has_entitlement_for(uuid,text,text)` (service-role only).
- `supabase/functions/dupr-entitlements/index.ts` (162 lines) — POSTs to DUPR `POST /subscription/active` with the per-user access token, merges across active subscriptions, persists cache.
- `src/hooks/useDuprEntitlements.ts` — React Query hook returning `{ hasBasic, hasPremium, hasVerified, raw, loading, refresh }`. Self-reads `dupr_user_entitlements` via RLS first, falls back to the edge function.
- `src/components/dupr/DuprEntitlementGate.tsx` — gating wrapper component (already imported by `MatchNew.tsx`).

### What's missing

| Gap | File / where |
|---|---|
| `dupr-entitlements` not registered in `supabase/config.toml` | `supabase/config.toml` |
| No `dupr-refresh-user-token` helper function (prompt asks for it) | new function |
| `MatchConfirmation.tsx` still says "Phase 1 only stores the flag" and does not gate by BASIC_L1 | `src/components/social/match/MatchConfirmation.tsx` lines 264-275 |

### Design decision vs. prompt

- Prompt wanted columns `profiles.dupr_entitlements jsonb` + `profiles.dupr_entitlements_fetched_at timestamptz`.
- Implementation uses a separate `dupr_user_entitlements` table with a per-resource entitlements JSONB.
- **Decision:** keep the separate table. Rationale: (a) cleaner cache invalidation, (b) avoids 1500+ row schema churn on `profiles`, (c) the existing RPC + RLS layer is already locked down. Document this divergence in the PR description.

### Risk

- DUPR endpoint `POST /subscription/active` is used (matches UAT spec); not the GET shape the prompt sketched. Confirm at UAT before partnership demo (we have one in `secrets.local.md` — testuser101 with `BASIC_L1` entitlement).
- Hook always reads `dupr_user_entitlements` first; if that row was inserted at SSO time but never refreshed, a user who lost entitlements upstream could still pass gating until `expires_at`. That's the documented 24h cache contract — acceptable per DUPR docs.

---

## 2. PR3 — Rating webhook subscribe + receive

### What exists

- `supabase/migrations/20260516020000_dupr_webhooks.sql` adds `webhook_subscribed_at` column on `dupr_user_tokens` (not a separate `dupr_webhook_subscriptions` table as the prompt sketched) and creates `dupr_webhook_events` for audit.
- `supabase/functions/dupr-webhook/index.ts` (228 lines) — public receiver. Validates `clientId` against `DUPR_CLIENT_KEY` OR `DUPR_CLIENT_ID`, persists raw event, updates `profiles.dupr_singles/doubles` + `dupr_rating_history`. Acknowledges `REGISTRATION` + `RATING_SEED` handshake events.
- `supabase/functions/dupr-webhook-register/index.ts` — admin-triggered POST to `/v1.0/webhook`. Service-role bearer required.
- `supabase/functions/_shared/dupr-client.ts` exposes `subscribeRating` + `unsubscribeRating` helpers.
- `dupr-sso-callback/index.ts` already calls `subscribeRating` at the end of a successful SSO flow (lines 209-227) and persists `webhook_subscribed_at`.
- `dupr-disconnect/index.ts` already calls `unsubscribeRating` before clearing local state (lines 45-62).

### What's missing

| Gap | File / where |
|---|---|
| `dupr-webhook`, `dupr-webhook-register` not registered in `supabase/config.toml` | `supabase/config.toml` |
| No demo helper `dupr-webhook-test-fire` (prompt asks for one) so reviewer can see a RATING event flow without waiting for DUPR | new function |
| No signature verification — DUPR UAT does not provide a HMAC secret per testing | accept; documented in audit |

### Design decision vs. prompt

- Prompt wanted a separate `dupr_webhook_subscriptions` table.
- Implementation tracks the subscription via a single `webhook_subscribed_at` column on `dupr_user_tokens`. NULL means unsubscribed/disconnected.
- **Decision:** keep the column approach. Rationale: avoids a 1:1 JOIN in every code path that already touches `dupr_user_tokens`; DUPR's subscribe endpoint is idempotent so no row-vs-state drift.

### Risk

- The webhook URL `https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/dupr-webhook` is already registered with DUPR UAT (per `secrets.local.md`). If we re-register inside this PR, it's a no-op per docs but we should log it.
- `dupr-webhook` reads `DUPR_CLIENT_KEY` or `DUPR_CLIENT_ID` and rejects on mismatch. Verified secrets are set in UAT.

---

## 3. PR4 — Match upload, update, delete

### What exists

- `supabase/migrations/20260516030000_dupr_match_submissions.sql` creates `dupr_match_submissions` (separate tracking table with matchCode, hashedMatchCode, identifier, env, raw_request/response, deleted_at).
- `supabase/functions/dupr-match-submit/index.ts` (485 lines) — single function dispatching on `action: "create"|"update"|"delete"`. Implements role gate (admin/creator), BASIC_L1 entitlement gate via `dupr_user_has_entitlement_for`, club-role gate via `dupr_user_can_submit_club_matches_for`. Builds DUPR `matchSource: PARTNER|CLUB` payload.
- `matches` table already has columns `dupr_match_id text`, `dupr_submitted_at timestamptz`, `submitted_to_dupr boolean` (confirmed via `src/integrations/supabase/types.ts:1902-1972`).
- `match_participants` already has `dupr_rating_before numeric`, `dupr_rating_after numeric`.

### What's missing

| Gap | File / where |
|---|---|
| `matches` lacks `dupr_sync_status`, `dupr_sync_error`, `dupr_sync_attempted_at`, `dupr_hashed_match_code` columns (prompt requires; UI status display needs them) | new migration |
| `dupr-match-submit` does not update the `matches` row (only `dupr_match_submissions`). The prompt explicitly says "use existing matches.dupr_match_id / dupr_submitted_at — don't add parallel columns" | edge function update |
| `MatchConfirmation.tsx` toggle is still flag-only (line 267-268: "Phase 1 chỉ ghi flag — chưa thực sự gửi DUPR.") | wire to edge fn |
| No `MatchDuprStatus` component — prompt requires one for the match detail page with status badge + retry button | new component |
| `dupr-match-submit` not registered in `supabase/config.toml` | `supabase/config.toml` |
| `dupr-match-submit` accepts a client-supplied `club_id`. Per PR5, it should derive `club_id` from the match's parent tournament's organization | edge function update |

### Design decision vs. prompt

- Prompt wanted 3 separate functions (`dupr-submit-match`, `dupr-update-match`, `dupr-delete-match`).
- Implementation uses one function with an `action` dispatcher.
- **Decision:** keep the single function — same auth/gating logic; one place to maintain. Update its docstring + comments. The prompt's spirit (create/update/delete supported) is met.
- The `dupr_match_submissions` table stays as an audit trail BUT we will also mirror the matchCode + status onto the `matches` row so the UI doesn't need a JOIN.

### Risk

- `submit-match-score/index.ts` is the function that transitions a match to `verification_status='completed'`. PR4 wiring must NOT call DUPR from inside `submit-match-score` (that's a trusted server flow); the call comes from the client after both teams confirm, via `dupr-match-submit`. Re-read `submit-match-score` confirms it only updates score + verification state; no DUPR coupling.
- The 4-player rule for doubles: existing `ensureAllPlayersBasic` collects player1+player2 of each team. Singles bypasses player2. Correct.

---

## 4. PR5 — Club integration

### What exists

- `supabase/migrations/20260516040000_dupr_user_clubs.sql` + `20260516060000_dupr_user_clubs_meta.sql` cache the user's DUPR club memberships per-user (24h TTL).
- `supabase/functions/dupr-clubs/index.ts` returns the user's club list filtered by `DIRECTOR | ORGANIZER | PLAYER`. UI can already render eligible clubs.
- `src/hooks/useDuprClubs.ts` exposes `submitterClubs` (DIRECTOR + ORGANIZER only) and `canSubmitForClub(clubId)`.

### What's missing

- **Schema:** `organizations` table has no DUPR columns. Per prompt: add `dupr_club_id text, dupr_club_name text, dupr_club_role text, dupr_linked_at timestamptz, dupr_linked_by uuid` plus FK to `profiles`.
- **Linking edge fn:** no function to actually persist a chosen club onto an organization row.
- **Unlink edge fn:** same.
- **dupr-clubs** does not need rewriting (already returns the eligible list).
- **dupr-match-submit:** currently accepts a client-supplied `club_id`. Per PR5, it must look up the match's parent (tournament / social event) → organization → `dupr_club_id` and inject that instead of trusting the client.
- **UI:** no DUPR Club card on the organization page.
- **Ownership model:** `organizations` has NO owner column. The current schema only links a profile to an organization via `profiles.organization_id`. This is ambiguous — anyone with `profiles.organization_id = X` is "in" the org but has no role differentiation.

### Decision on ownership (proposed; flagged in PR description for sign-off)

For UAT demo purposes I will gate `dupr-link-club-to-org` and `dupr-unlink-club-from-org` on:

1. Caller has `user_roles.role = 'admin'`, OR
2. Caller has `profiles.organization_id = <organization_id>` AND `user_roles.role IN ('admin','creator')`.

This is a conservative gate that doesn't require a schema change for the ownership model — operator can sign off / propose a proper `organization_members` table in a follow-up. The new migration ALSO adds an idempotent helper RPC `user_can_admin_organization(uuid)` that future migrations can override once the ownership model is formalized.

### Risk

- If the operator wants strict "only the org creator can link", we need to either (a) add a `created_by` column to `organizations` (data backfill required for the 5-10 existing orgs), or (b) use a new `organization_members` table. Both are out of the demo scope per prompt's "don't change without sign-off". Flag in PR description.
- The match → organization → club lookup chain currently goes: `matches.parent_tournament_id` → `parent_tournaments.organization_id` (no such column today). I need to confirm whether the match table → tournament → organization path exists at all, and if not, gate the CLUB branch on `match_participants` first player's org for the demo (best-effort) and document.

---

## 5. Other items the prompt asked about specifically

| Question | Answer |
|---|---|
| Does `matches.dupr_submitted_at` already exist? | **Yes** (types.ts line 1903). |
| Does `MatchConfirmation.tsx` toggle currently call any DUPR edge function? | **No** (lines 263-276 only mutate local state). |
| Existing webhook receiver to model after? | `mux-webhook/index.ts` (similar public-receiver pattern). |
| `organizations` RLS — admin-only updates? | Unknown — no explicit RLS migration found. New migration will GRANT UPDATE on the new DUPR columns to authenticated and rely on a CHECK via the new RPC. |
| `useOrganization` / `useUserOrganization` hook? | Not found. New `useOrganizationDuprClub` will be added with a thin select + invalidation. |

---

## 6. Final deliverable plan for this branch

Migrations (4 new files, ascending timestamps; each ends with `NOTIFY pgrst, 'reload schema';`):

1. `20260520010000_dupr_pr4_matches_sync_columns.sql` — add `dupr_sync_status / dupr_sync_error / dupr_sync_attempted_at / dupr_hashed_match_code` to `matches`.
2. `20260520020000_dupr_pr5_organizations_club_link.sql` — add `dupr_club_id / dupr_club_name / dupr_club_role / dupr_linked_at / dupr_linked_by` to `organizations`. Adds RPC `user_can_admin_organization(uuid)`.

Edge functions (4 new):

1. `dupr-refresh-user-token` — refreshes a per-user access token; PR2 helper.
2. `dupr-webhook-test-fire` — admin-only synthetic RATING event POST to our own receiver; PR3 demo helper.
3. `dupr-org-link-club` — verifies caller can admin org + caller is DIRECTOR/ORGANIZER of the proposed club, then writes the 5 columns on `organizations`.
4. `dupr-org-unlink-club` — nulls the 5 columns.

Edge function edits (3 existing):

1. `dupr-match-submit/index.ts` — additionally mirror state onto `matches` row (`dupr_match_id`, `dupr_submitted_at`, `dupr_sync_status='submitted'|'failed'`, `dupr_hashed_match_code`, `dupr_sync_error`, `dupr_sync_attempted_at`). For CLUB source, look up the org club via `matches.parent_tournament_id → parent_tournaments.organization_id → organizations.dupr_club_id`. If the linked club exists and the submitter holds DIRECTOR/ORGANIZER, use it; otherwise fall back to PARTNER source.
2. `dupr-sso-callback/index.ts` — already calls `subscribeRating`. No change required; documented.
3. `dupr-disconnect/index.ts` — already calls `unsubscribeRating`. No change required; documented.

Frontend (3 new):

1. `src/components/social/match/MatchDuprStatus.tsx` — status badge + retry.
2. `src/components/organization/OrganizationDuprClubCard.tsx` — link / unlink UI for org page.
3. `src/hooks/useOrganizationDuprClub.ts` — read + mutate the org row.

Frontend edits (2):

1. `src/components/social/match/MatchConfirmation.tsx` — replace the "Phase 1" comment with a gated DUPR submit; show submission state inline.
2. `src/pages/DuprDashboard.tsx` — add WebhookSection (PR3) + OrgLinkSection (PR5), renumber sections so /dupr renders a single-page walkthrough for all five videos: SSO → entitlements → webhook → match submit → club link.

Config (1):

1. `supabase/config.toml` — append `[functions.dupr-entitlements]`, `[functions.dupr-webhook]`, `[functions.dupr-webhook-register]`, `[functions.dupr-match-submit]`, `[functions.dupr-clubs]`, plus the four new functions, all with `verify_jwt = false`.

Docs (2):

1. This file.
2. `docs/dupr-pr2-5-deploy-and-test.md` — apply-migrations + deploy-functions runbook with verification SQL + curl examples per function.

---

## 7. Out of scope (per prompt) — explicit list

- Encryption of `dupr_user_tokens.access_token / refresh_token`. Stays plaintext for UAT.
- Removing legacy `dupr-link`, `dupr-sync`, `_shared/dupr-parser.ts`, `_shared/dupr-validation.ts`.
- Changing prerender worker, sitemap, Cloudflare Pages config.
- Migrating manual users — `pending_reconnect` stays as-is.
- Cron jobs for entitlement / club refresh — caller-driven only.

---

## 8. Questions raised for PR description / operator sign-off

1. **Organization ownership model** — confirm whether the proposed "user_roles.admin OR (profiles.organization_id matches AND user_roles.creator)" gate is acceptable for UAT demo, or whether a proper `organization_members` table should land first.
2. **Match → organization lookup** — confirm the chain `matches.parent_tournament_id → parent_tournaments.organization_id` once that column exists; otherwise demo CLUB-source via the submitter's organization.
3. **Webhook HMAC** — DUPR UAT did not provide a signing secret. Confirm prod expectation before partnership. If a secret is provided we will add HMAC verification in a follow-up; for UAT demo `clientId` matching is the contract.
4. **Single function vs. three for match CRUD** — implementation uses a `{action}` dispatcher rather than three named functions. Confirm OK for the demo.

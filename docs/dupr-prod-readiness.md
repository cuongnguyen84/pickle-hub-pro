# DUPR RaaS — Production readiness audit + rollout plan

**Date:** 2026-05-24
**Trigger:** DUPR Tech sent production keys after partnership review approval.
**Status:** UAT integration verified end-to-end on `feat/dupr-raas-pr2-5` preview. Below is the gap list to flip the switch to production.

---

## TL;DR — 6 things must happen, in order

1. **Encrypt user tokens** before any real user SSO connects in prod (or accept plaintext for soft launch).
2. **Set 4 Supabase secrets** on the production project with prod DUPR keys.
3. **Set `VITE_DUPR_ENV=prod`** in Cloudflare Pages production env vars and trigger a build.
4. **Re-register webhook** with prod DUPR (one-time POST after secret swap).
5. **Backfill missing migration** that captures hotfix `GRANT EXECUTE ... TO service_role` so DB state matches source.
6. **Merge `feat/dupr-raas-pr2-5` → `dupr-uat-review` → `main`** (PR #140 + a new PR to main).

Everything else is optional polish/cleanup.

---

## 1. Code audit — hardcoded UAT?

✅ **Clean.** Every host/URL switches via env:

| File | How it switches |
|---|---|
| `supabase/functions/_shared/dupr-client.ts` | `getDuprEnv()` reads `DUPR_ENV`; defaults to `uat` |
| `supabase/functions/match-proposal/index.ts` | Same pattern, 2 call sites |
| `src/pages/DuprDashboard.tsx` | `import.meta.env.VITE_DUPR_ENV` |
| `src/components/dupr/DuprSsoModal.tsx` | `import.meta.env.VITE_DUPR_ENV` |

Just need to set the env vars in prod and rebuild.

---

## 2. Secrets to set in Supabase (production)

Production keys received from DUPR Tech. Set via:

```bash
SUPABASE_ACCESS_TOKEN=<owner-token>
PROJECT_REF=ajvlcamxemgbxduhiqrl

# Replace placeholders with the keys DUPR emailed
npx supabase secrets set --project-ref "$PROJECT_REF" \
  DUPR_ENV=prod \
  DUPR_CLIENT_ID=<prod-numeric-id> \
  DUPR_CLIENT_KEY=<prod-client-key> \
  DUPR_CLIENT_SECRET=<prod-client-secret>
```

After setting, every dupr-* edge function will start routing to `prod.mydupr.com/api` and `api.dupr.gg`.

> ⚠️ **Wipe partner token cache** after secret swap so we mint a fresh token with new creds:
> ```sql
> DELETE FROM public.dupr_partner_tokens WHERE environment = 'uat';
> -- prod row will be created lazily on first dupr-partner-token call
> ```

---

## 3. Frontend env (Cloudflare Pages)

The frontend uses `VITE_DUPR_ENV` which is bundled at build time. Setting via Cloudflare:

1. Dashboard → Pages → `pickle-hub-pro` → Settings → Environment variables
2. Add `VITE_DUPR_ENV=prod` under **Production** environment
3. Trigger a new deploy (or wait for next commit to `main`)

After build, SSO modal will open `dashboard.dupr.com` instead of `uat.dupr.gg`.

---

## 4. Webhook URL — re-register with prod

The webhook receiver URL stays the same (same Supabase project):
`https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/dupr-webhook`

But DUPR's prod environment has its own webhook registry. After setting prod secrets, run once:

```bash
SECRET=<service-role-key>
curl -sS -X POST -H "Authorization: Bearer $SECRET" \
  https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/dupr-webhook-register | jq
# Expected: registered: true, environment: "prod", dupr_response.status: "SUCCESS"
```

Receiver already validates `clientId` against `DUPR_CLIENT_KEY` — automatically rejects UAT events once prod keys are set.

---

## 5. Token encryption (HIGH priority, currently plaintext)

**Current state:** `dupr_user_tokens.access_token + refresh_token` are stored as plaintext. Comments in `dupr-sso-callback/index.ts` line 187 and `20260515000000_dupr_raas_sso.sql` line 19 mark this as TODO for prod.

**Risk:** If the database is leaked, attackers can act on behalf of any SSO-connected user against DUPR's API for the lifetime of the refresh token (30 days per DUPR docs).

**Mitigation options:**

| Option | Effort | Strength |
|---|---|---|
| **A — pgcrypto sym encrypt** | ~1 day | Single shared key in Supabase Vault. Decent. |
| **B — Supabase Vault** | ~half day | Native solution. Best. |
| **C — Soft launch in plaintext, encrypt within 30 days** | 0 day | Tolerable for low-volume soft launch. Document risk. |

Recommend **B** for proper prod. Migration sketch:

```sql
-- Add column for encrypted values; migrate live; drop plain after backfill
ALTER TABLE public.dupr_user_tokens
  ADD COLUMN access_token_enc text,
  ADD COLUMN refresh_token_enc text;

-- Edge function dupr-sso-callback rewrite to use vault.create_secret() instead
-- of plain INSERT. dupr-user-client.ts getUserAccessToken() rewrites to decrypt.
```

If choosing Option C (soft launch), document publicly in the prod-deploy notes that token encryption is a known followup.

---

## 6. DB cleanup — UAT data on shared project

The same Supabase project (`ajvlcamxemgbxduhiqrl`) is used for UAT + prod (we're flipping env, not project). Current DUPR-related rows:

| Table | Rows | Action for prod |
|---|---|---|
| `dupr_partner_tokens` | 1 (UAT cached) | **Delete** before secret swap, will mint fresh prod row |
| `dupr_user_tokens` | 9 (test users) | **Keep or delete** — revoked rows are harmless; live ones for testusers point to UAT DUPR account that won't exist in prod |
| `dupr_user_entitlements` | 3 (test users manual-inserted) | **Delete** — will auto-repopulate from prod DUPR on first user fetch |
| `dupr_user_clubs` | 1 (UAT test club) | **Delete** — club id 7628571463 is UAT-only |
| `dupr_match_submissions` | 9 (UAT test matches) | **Keep** for audit, mark as legacy. Or move to a `_uat_archive` schema. |
| `dupr_webhook_events` | 79 (UAT webhook fires) | **Keep** — append-only audit, no harm |
| `organizations.dupr_club_id` | 1 (PB Academy linked to UAT club) | **Unlink** — UAT club id won't exist on prod |
| `profiles.dupr_id` | 7 (test users) | **Keep** — UAT users will need to re-SSO to prod DUPR |

Cleanup SQL (run BEFORE flipping env):

```sql
BEGIN;

-- Force partner token re-mint on next call
DELETE FROM public.dupr_partner_tokens;

-- Clear stale UAT entitlement + club caches
DELETE FROM public.dupr_user_entitlements;
DELETE FROM public.dupr_user_clubs;
DELETE FROM public.dupr_user_clubs_meta;

-- Unlink test orgs from UAT clubs
UPDATE public.organizations
SET dupr_club_id = NULL, dupr_club_name = NULL, dupr_club_role = NULL,
    dupr_linked_at = NULL, dupr_linked_by = NULL
WHERE dupr_club_id IS NOT NULL;

-- Revoke test-user SSO links so they're forced to re-SSO with prod creds
UPDATE public.dupr_user_tokens
SET revoked_at = now(), webhook_subscribed_at = NULL
WHERE revoked_at IS NULL;

-- Clear DUPR identifiers from test profiles (forces re-SSO)
UPDATE public.profiles
SET dupr_id = NULL, dupr_singles = NULL, dupr_doubles = NULL,
    dupr_profile_url = NULL, dupr_connected_via = NULL, dupr_synced_at = NULL
WHERE id IN (SELECT user_id FROM public.dupr_user_tokens);

COMMIT;
```

`dupr_match_submissions` and `dupr_webhook_events` rows stay (audit trail). If they look bad in prod analytics, archive them via:

```sql
CREATE SCHEMA IF NOT EXISTS _archive_uat;
ALTER TABLE public.dupr_match_submissions SET SCHEMA _archive_uat;
ALTER TABLE public.dupr_webhook_events SET SCHEMA _archive_uat;
-- Then re-create the prod tables (re-apply 20260516020000_dupr_webhooks.sql + 20260516030000_dupr_match_submissions.sql)
```

---

## 7. Migration drift — hotfix not yet committed

During UAT debug, em ran a one-off:

```sql
GRANT EXECUTE ON FUNCTION public.dupr_user_has_entitlement_for(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dupr_user_can_submit_club_matches_for(uuid, bigint) TO service_role;
```

That GRANT is in the live DB but not in any migration file. If someone runs `supabase db reset` in dev they'll hit the same bug we already fixed.

**Fix:** add migration `20260524010000_dupr_grant_service_role.sql`:

```sql
-- Hotfix: GRANT EXECUTE on entitlement + club helpers to service_role.
-- Originally migration 20260516050000 REVOKE'd from public/anon/authenticated
-- assuming default-privileges would keep service_role's EXECUTE — but
-- default-privileges only apply to NEW objects, so service_role had 0
-- EXECUTE on these existing functions. Edge function dupr-match-submit
-- silently received error from RPC and marked every player as missing
-- BASIC_L1. Fix by explicit GRANT.

GRANT EXECUTE ON FUNCTION public.dupr_user_has_entitlement_for(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dupr_user_can_submit_club_matches_for(uuid, bigint) TO service_role;

NOTIFY pgrst, 'reload schema';
```

---

## 8. Legacy code — clean up after prod stable

These exist from the pre-RaaS pivot and can be removed once prod is verified (recommend ~30 days post-launch):

- `supabase/functions/dupr-link/` — old manual DUPR linking
- `supabase/functions/dupr-sync/` — old scraper-based sync
- `supabase/functions/_shared/dupr-parser.ts` + `dupr-validation.ts` — used by dupr-sync
- `src/components/dupr/DuprReconnectBanner.tsx` — pending_reconnect UI; keep until pending_reconnect users are migrated

---

## 9. DuprDashboard `/dupr` page — keep public or restrict?

Currently `/dupr` is reachable to any logged-in user. Has the demo dashboard with all 7 sections. For prod:

- **Option A:** Keep at `/dupr` accessible to all logged-in users — useful for users to self-test their SSO/entitlement state.
- **Option B:** Move to `/admin/dupr` admin-only — section 4a/4b/6 are operator-grade tooling, not end-user UX.
- **Option C:** Split — keep section 1 (Connection) + 2 (Entitlements) + 5a (Clubs) at `/dupr` for users; move 3, 4a, 4b, 5b, 6 to `/admin/dupr`.

Recommend **C** post-launch. For initial soft launch keep at `/dupr` for transparency with DUPR reviewer if they re-audit.

---

## 10. PR + branch merge plan

| Branch | Contents | Target | Action |
|---|---|---|---|
| `feat/dupr-raas-pr2-5` | PR2-5 + PR7 fixes (this work) | `dupr-uat-review` | PR #140 — review + merge after recording is verified |
| `dupr-uat-review` | PR1 + all PR2-5 + PR7 | `main` | **New PR needed** — full RaaS rollup to main |
| `main` | Production code | (deploys to thepicklehub.net) | Cloudflare auto-rebuilds with `VITE_DUPR_ENV=prod` after merge |

**Suggested sequence:**

1. Merge PR #140 (`feat/dupr-raas-pr2-5` → `dupr-uat-review`) — keeps preview deploy clean.
2. Apply hotfix migration `20260524010000_dupr_grant_service_role.sql` on the same Supabase project.
3. Open new PR `dupr-uat-review` → `main`. Title: "DUPR RaaS partnership integration — prod rollout (PR1-PR7)".
4. Before merging to `main`:
   - Set Cloudflare env var `VITE_DUPR_ENV=prod`
   - Set Supabase secrets (DUPR_ENV=prod + 3 prod keys)
   - Run cleanup SQL §6
5. Merge to `main`. Cloudflare auto-deploys.
6. POST `/functions/v1/dupr-webhook-register` to register webhook with prod DUPR.
7. Manual smoke test on `https://thepicklehub.net/dupr` with a real user account (your own).

---

## 11. Smoke test plan post-deploy

Run AFTER all secrets are flipped + cleanup SQL applied + deploy done:

```bash
# 1. Partner token mints from prod
curl -sS -X POST -H "Authorization: Bearer $SECRET" \
  https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/dupr-partner-token \
  | jq '{environment, has_token: ((.access_token // "") | length > 100)}'
# Expect: { "environment": "prod", "has_token": true }

# 2. Webhook URL still 200
curl -sS https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/dupr-webhook
# Expect: {"status":"ok"}

# 3. /dupr page loads (anonymous fetch — should redirect to sign-in)
curl -sI https://thepicklehub.net/dupr | head -5
# Expect: HTTP/2 200 (SPA shell)

# 4. SSO modal points to dashboard.dupr.com (check after rebuild)
# Manual UI check: open thepicklehub.net/dupr, click Connect, iframe should
# go to dashboard.dupr.com/login-external-app/<base64-prod-client-key>
```

After confirming all 4: anh có thể ping DUPR Tech rằng prod đã live, kèm test account để họ verify lần cuối.

---

## 12. Open follow-ups (not blocking prod)

| # | Issue | Priority |
|---|---|---|
| FIX-1 | Token encryption (§5) | High — within 30 days |
| FIX-2 | DUPR club URL pattern `/club/<id>` returns 404 on uat.dupr.gg + dashboard.dupr.com | Low — cosmetic deep-link |
| FIX-3 | `/dupr` page split between user-facing + admin-only (§9) | Med — UX polish |
| FIX-4 | Legacy code cleanup (§8) | Low — post-launch cleanup |
| FIX-5 | `dupr-event-eligibility` currently uses mock events in `/dupr` section 6 — wire into real tournaments table with `dupr_tier_required` column | Med — when offering real Premium tournaments |
| FIX-6 | Entitlement cache TTL doesn't auto-refresh server-side — only on client React Query trigger. Add cron `dupr-refresh-stale-entitlements` for high-volume scenarios | Low — premature optimization |

---

## 13. Communication to DUPR Tech post-launch

Draft email:

> Subject: ThePickleHub — DUPR RaaS production live
>
> Hi DUPR team,
>
> All 5 requirements + the 2 follow-ups (Update Match UI, DUPR+ event gating) are now live on production at https://thepicklehub.net using the prod keys you provided.
>
> Test account for verification:
> - Email: <prod test user>
> - DUPR ID: <linked via SSO post-launch>
>
> One-stop dashboard for verifying integration health: https://thepicklehub.net/dupr
>
> Open items we'll address within 30 days:
> - User token encryption (currently plaintext in DB)
> - Webhook HMAC verification (if DUPR provides a secret in prod responses)
>
> Thanks for the partnership.
>
> Cuong / ThePickleHub

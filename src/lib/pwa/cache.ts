/**
 * Auth-sensitive Cache Storage hygiene.
 *
 * The service worker used to cache all Supabase `/rest/` responses with a
 * URL-keyed NetworkFirst strategy (5 min). Those responses are per-user —
 * gated by RLS + the bearer token — so on a shared device a network timeout
 * could serve account A's cached data to account B. We switched `/rest/` to
 * NetworkOnly (see vite.config.ts), but two things still need active cleanup:
 *
 *   1. The legacy `supabase-rest` cache written by the OLD sw persists in
 *      Cache Storage until explicitly deleted — purge it on app boot.
 *   2. On sign-out (manual, token expiry, revoke, or a sign-out in another
 *      tab) any auth-scoped cache must be dropped immediately.
 */

// Cache names that may contain per-user (RLS/bearer) data and must never
// survive an auth change. `supabase-rest` is legacy — no longer written, but
// still evicted here for users whose browser holds the old cache.
const AUTH_SENSITIVE_CACHES = ["supabase-rest"] as const;

export async function purgeAuthSensitiveCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    await Promise.all(AUTH_SENSITIVE_CACHES.map((name) => caches.delete(name)));
  } catch {
    // Cache Storage may be unavailable (private mode, quota, sandboxed
    // origin). Best-effort — a failure here must not block auth flows.
  }
}

export const __AUTH_SENSITIVE_CACHES = AUTH_SENSITIVE_CACHES;

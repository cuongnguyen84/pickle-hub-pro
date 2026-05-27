// ============================================================================
// dupr/staleness — pure helpers for DUPR rating freshness checks
// ----------------------------------------------------------------------------
// Kept in a separate module from DuprChip so the component file is
// component-only (avoids react-refresh/only-export-components warning).
// ============================================================================

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** True if `synced_at` is older than 30 days. Null is treated as fresh
 *  (unknown synced_at should not show a stale marker — likely a manual
 *  rating entry or pre-SSO row). */
export function isDuprStale(syncedAt: string | null | undefined): boolean {
  if (!syncedAt) return false;
  return Date.now() - new Date(syncedAt).getTime() > THIRTY_DAYS_MS;
}

// ============================================================================
// myRegistration.ts — localStorage helper for the player-side "my
// registration" lookup (PR58).
// ----------------------------------------------------------------------------
// The /dang-ky/:magic_token page is the only way a guest can come back
// to cancel or check status after registering. The magic_token is only
// returned once (from phone-otp-verify) so we have to persist it on the
// device. This module owns the storage key + payload shape so callers
// (RegistrationModal writes, SocialEventDetail reads) stay in sync.
//
// Read also tries the legacy `tph-event-magic:` key from earlier PR2/
// PR49 builds so a user who registered before this PR ships still sees
// the banner on the public event page.
// ============================================================================

const KEY_PREFIX = "pickle-hub:registration:";
const LEGACY_KEY_PREFIX = "tph-event-magic:";

export interface StoredRegistration {
  magic_token: string;
  registration_id?: string;
  reference_code?: string | null;
  display_name?: string | null;
  registered_at?: string;
  /** ISO 8601; we expire the entry after 90 days to keep storage tidy. */
  expires_at?: string;
}

/**
 * Persist a registration for the given event. Errors (private-mode
 * Safari, quota) are swallowed — the registration itself already
 * succeeded; we just lose the convenience handle.
 */
export function saveMyRegistration(eventId: string, payload: StoredRegistration): void {
  try {
    localStorage.setItem(
      `${KEY_PREFIX}${eventId}`,
      JSON.stringify({
        ...payload,
        expires_at:
          payload.expires_at ??
          new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    );
  } catch {
    // non-fatal
  }
}

/**
 * Look up the stored registration for an event. Returns null when:
 *   - localStorage is unavailable
 *   - no entry exists under either the new or legacy key
 *   - the entry has expired
 *   - the entry is malformed JSON
 *
 * Reads both the new and legacy key prefixes so a user who registered
 * before this PR shipped still gets the banner.
 */
export function readMyRegistration(eventId: string): StoredRegistration | null {
  try {
    const raw =
      localStorage.getItem(`${KEY_PREFIX}${eventId}`) ??
      localStorage.getItem(`${LEGACY_KEY_PREFIX}${eventId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredRegistration> & { token?: string };
    // Legacy shape used `token` instead of `magic_token`.
    const magic_token = parsed.magic_token ?? parsed.token;
    if (!magic_token) return null;
    if (parsed.expires_at && new Date(parsed.expires_at).getTime() <= Date.now()) {
      return null;
    }
    return {
      magic_token,
      registration_id: parsed.registration_id,
      reference_code: parsed.reference_code,
      display_name: parsed.display_name,
      registered_at: parsed.registered_at,
      expires_at: parsed.expires_at,
    };
  } catch {
    return null;
  }
}

/** Drop the stored entry — call after a confirmed cancel so the banner
 *  on the public event page disappears. (Reactivate keeps it.) */
export function clearMyRegistration(eventId: string): void {
  try {
    localStorage.removeItem(`${KEY_PREFIX}${eventId}`);
    localStorage.removeItem(`${LEGACY_KEY_PREFIX}${eventId}`);
  } catch {
    // non-fatal
  }
}

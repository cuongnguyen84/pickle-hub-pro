/**
 * W1.2b — Shared mutation-error helpers, extracted from useQuickTableMutations.
 *
 * Why this exists: every tournament mutation hook has the same shape — wrap a
 * Supabase call in try/catch, swallow on failure. Before this util those
 * catches were empty `} catch {}` blocks that hid genuine errors. The
 * GRANT-drift incident (POST /forum_likes 403 silently swallowed, UI showed
 * success) is the canonical example.
 *
 * The util keeps every hook's logging + permission-error UX consistent
 * without forcing each hook to copy-paste the same 6 lines.
 */

import { toast } from "sonner";

/**
 * Pull a Postgres error code off any thrown value. Supabase returns
 * `{ code, message, details, hint }` on failed queries; we use this to
 * surface specific user-facing messages for known cases (RLS deny =
 * 42501) instead of a single generic toast that hides the cause.
 */
export function pgErrorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error) {
    const c = (error as { code?: unknown }).code;
    if (typeof c === "string") return c;
  }
  return null;
}

/**
 * 42501 = insufficient_privilege. Either RLS rejected the row or the
 * GRANT is missing (see CLAUDE.md "Supabase GRANT convention" note).
 * Worth distinguishing because the user-facing fix differs: "you don't
 * own this row" vs "the API needs a server-side fix".
 */
export function isPermissionDenied(error: unknown): boolean {
  return pgErrorCode(error) === "42501";
}

/**
 * Log a mutation error with a consistent prefix so it's instantly
 * greppable in the browser console + Sentry. Pair this with a
 * user-facing toast — the log captures the technical error, the toast
 * tells the user something happened.
 */
export function logMutationError(hookName: string, action: string, error: unknown): void {
  console.error(`[${hookName}] ${action}:`, error);
}

/**
 * Convenience: log + toast in one call. The default toast text is
 * generic; pass `permissionDeniedMsg` to use a specific message when
 * the error is a 42501 RLS deny.
 *
 * Example:
 *   handleMutationError('useRegistration', 'submit', err, {
 *     genericMsg: 'Không thể đăng ký',
 *     permissionDeniedMsg: 'Bạn không có quyền đăng ký giải này',
 *   });
 */
export function handleMutationError(
  hookName: string,
  action: string,
  error: unknown,
  opts: { genericMsg?: string; permissionDeniedMsg?: string } = {},
): void {
  logMutationError(hookName, action, error);
  const { genericMsg, permissionDeniedMsg } = opts;
  if (isPermissionDenied(error) && permissionDeniedMsg) {
    toast.error(permissionDeniedMsg);
  } else if (genericMsg) {
    toast.error(genericMsg);
  }
}

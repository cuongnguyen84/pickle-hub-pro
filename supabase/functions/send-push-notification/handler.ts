// ============================================================================
// send-push-notification core — Deno-free so it can be unit-tested under
// vitest (same pattern as dupr-webhook/handler.ts).
// ----------------------------------------------------------------------------
// Recipients are resolved HERE with the service-role store because push_tokens
// RLS only shows a caller their own rows: the old client-resolved "broadcast"
// silently delivered to the admin's own devices only (known bug #1).
// `broadcast: true` targets every registered token; `dry_run: true` returns
// the token/user counts without sending, for the admin confirm dialog.
// FCM sends run in bounded concurrent chunks, and tokens FCM reports as
// UNREGISTERED are pruned so dead devices stop inflating failure counts.
// ============================================================================

export interface PushPayload {
  broadcast?: boolean;
  user_ids?: string[];
  title?: string;
  body?: string;
  data?: Record<string, string>;
  dry_run?: boolean;
}

export interface PushTokenRow {
  id: string;
  user_id: string;
  token: string;
}

/** Narrow persistence surface — real impl wraps supabase-js, tests fake it. */
export interface PushStore {
  /** Page through push_tokens; userIds=null means all rows (broadcast). */
  fetchTokensPage(
    userIds: string[] | null,
    from: number,
    to: number,
  ): Promise<{ rows: PushTokenRow[]; error: string | null }>;
  deleteTokens(ids: string[]): Promise<{ error: string | null }>;
}

export type FcmSendResult =
  | { ok: true }
  | { ok: false; unregistered: boolean; message: string };

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

/** PostgREST caps selects at 1000 rows — page past it or broadcasts truncate. */
export const TOKEN_PAGE_SIZE = 1000;
export const FCM_CHUNK_SIZE = 50;

export async function fetchAllTokens(
  store: PushStore,
  userIds: string[] | null,
): Promise<{ rows: PushTokenRow[]; error: string | null }> {
  const rows: PushTokenRow[] = [];
  for (let from = 0; ; from += TOKEN_PAGE_SIZE) {
    const page = await store.fetchTokensPage(
      userIds,
      from,
      from + TOKEN_PAGE_SIZE - 1,
    );
    if (page.error) return { rows: [], error: page.error };
    rows.push(...page.rows);
    if (page.rows.length < TOKEN_PAGE_SIZE) return { rows, error: null };
  }
}

export async function processPush(
  payload: PushPayload,
  store: PushStore,
  sendFcm: (token: string) => Promise<FcmSendResult>,
): Promise<HandlerResult> {
  const { broadcast, user_ids, title, dry_run } = payload;

  if (!title || (!broadcast && !user_ids?.length)) {
    return {
      status: 400,
      body: { error: "title and either broadcast or user_ids are required" },
    };
  }

  const { rows: tokens, error } = await fetchAllTokens(
    store,
    broadcast ? null : user_ids!,
  );
  if (error) {
    return { status: 500, body: { error: "Failed to fetch tokens" } };
  }

  const totalUsers = new Set(tokens.map((t) => t.user_id)).size;

  if (dry_run) {
    return {
      status: 200,
      body: { dry_run: true, total_tokens: tokens.length, total_users: totalUsers },
    };
  }

  if (!tokens.length) {
    return {
      status: 200,
      body: { sent: 0, total_tokens: 0, message: "No push tokens found for users" },
    };
  }

  let sent = 0;
  const errors: string[] = [];
  const unregisteredIds: string[] = [];

  for (let i = 0; i < tokens.length; i += FCM_CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + FCM_CHUNK_SIZE);
    const results = await Promise.allSettled(chunk.map((t) => sendFcm(t.token)));
    results.forEach((result, j) => {
      const row = chunk[j];
      const label = `Token ${row.token.substring(0, 10)}...`;
      if (result.status === "rejected") {
        const reason = result.reason;
        errors.push(
          `${label}: ${reason instanceof Error ? reason.message : String(reason)}`,
        );
        return;
      }
      if (result.value.ok) {
        sent++;
        return;
      }
      if (result.value.unregistered) unregisteredIds.push(row.id);
      errors.push(`${label}: ${result.value.message}`);
    });
  }

  let pruned = 0;
  if (unregisteredIds.length) {
    const del = await store.deleteTokens(unregisteredIds);
    if (del.error) errors.push(`Prune failed: ${del.error}`);
    else pruned = unregisteredIds.length;
  }

  return {
    status: 200,
    body: {
      sent,
      total_tokens: tokens.length,
      total_users: totalUsers,
      pruned,
      errors: errors.length ? errors : undefined,
    },
  };
}

/**
 * Referee helpers — shared logic across the 4 tournament referee tables.
 *
 * The 4 referee tables (quick_table_referees, doubles_elimination_referees,
 * team_match_referees, flex_tournament_referees) all share the same row
 * shape:
 *
 *   { id: uuid, <fk_column>: uuid, user_id: uuid, created_at: timestamptz }
 *
 * The differences are surgical:
 *   - Table name
 *   - FK column name (`table_id` for quick_table; `tournament_id` for the
 *     other three)
 *   - Whether the hook also exposes a `userRole` object (Quick Table and
 *     Team Match do; Doubles Elimination does not)
 *
 * This module extracts the genuinely shared parts (fetch + profile join,
 * lookup-by-email, existence check, insert, delete) and leaves the small
 * wrappers (userRole, useEffect wiring, toast strings) to the per-feature
 * hooks. Toast strings are intentionally NOT moved here — W3.1 handles
 * toast i18n separately and the strings live verbatim in the hooks.
 *
 * NOTE on typing: the supabase-js client types each table strictly, so the
 * helpers accept the table name as a string literal and cast through
 * `as any` at the boundary. This is the same pragmatic escape hatch the
 * existing hooks use (each hook hardcodes its own table name). We keep
 * the public helper API strongly typed so callers can't pass bad columns.
 */

import { supabase } from '@/integrations/supabase/client';

// ─── Types ──────────────────────────────────────────────────────────────

/** All 4 referee table names supported by the shared helpers. */
export type RefereeTableName =
  | 'quick_table_referees'
  | 'doubles_elimination_referees'
  | 'team_match_referees'
  | 'flex_tournament_referees';

/** FK column on a referee table pointing at its parent (table or tournament). */
export type RefereeFkColumn = 'table_id' | 'tournament_id';

/** Raw row shape shared by every referee table. */
export interface RefereeRowBase {
  id: string;
  user_id: string;
  created_at: string;
}

/** Enriched row returned to UI — adds display_name from public_profiles. */
export interface EnrichedReferee extends RefereeRowBase {
  display_name?: string;
  email?: string;
  // FK is preserved with its original column name (table_id or tournament_id)
  // via index signature so callers can pick whichever is relevant.
  [key: string]: string | undefined;
}

/** Outcome of an addReferee attempt — hook decides how to surface to user. */
export type AddRefereeResult =
  | { ok: true; displayName: string | null; userId: string }
  | { ok: false; reason: 'not-found' | 'already-exists' | 'error'; error?: unknown };

/** Outcome of a removeReferee attempt. */
export type RemoveRefereeResult =
  | { ok: true }
  | { ok: false; error: unknown };

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Look up a user by email via the SECURITY DEFINER RPC. Returns the profile
 * row (id + display_name + avatar_url) or null when no match.
 */
export async function lookupUserByEmail(
  email: string
): Promise<{ user_id: string; display_name: string | null; avatar_url: string | null } | null> {
  const trimmed = email.toLowerCase().trim();
  const { data, error } = await supabase.rpc('lookup_user_by_email', {
    lookup_email: trimmed,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

/**
 * Fetch referees for the given parent (tournament/table), then enrich each
 * row with display_name from public_profiles in a single batched query.
 */
export async function fetchRefereesWithProfiles(
  table: RefereeTableName,
  fkColumn: RefereeFkColumn,
  parentId: string
): Promise<EnrichedReferee[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from(table) as any)
    .select('*')
    .eq(fkColumn, parentId);

  if (error) throw error;

  const rows = (data ?? []) as RefereeRowBase[];
  const userIds = rows.map((r) => r.user_id).filter(Boolean);

  if (userIds.length === 0) return rows.map((r) => ({ ...r }));

  const { data: profilesData } = await supabase
    .from('public_profiles')
    .select('id, display_name')
    .in('id', userIds);

  const profileMap = new Map<string, { display_name: string | null }>(
    (profilesData ?? []).map((p) => [p.id, { display_name: p.display_name }])
  );

  return rows.map((r) => ({
    ...r,
    display_name: profileMap.get(r.user_id)?.display_name || undefined,
  }));
}

/**
 * Check whether a given user is already a referee on the given parent.
 * Used for the "already a referee" guard before insert, and for hook
 * userRole detection.
 */
export async function isExistingReferee(
  table: RefereeTableName,
  fkColumn: RefereeFkColumn,
  parentId: string,
  userId: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from(table) as any)
    .select('id')
    .eq(fkColumn, parentId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

/**
 * Add a referee by email: lookup → existence check → insert.
 * Returns a structured result; the calling hook decides toast wording.
 */
export async function addRefereeByEmailHelper(
  table: RefereeTableName,
  fkColumn: RefereeFkColumn,
  parentId: string,
  email: string
): Promise<AddRefereeResult> {
  try {
    const profile = await lookupUserByEmail(email);
    if (!profile) return { ok: false, reason: 'not-found' };

    const alreadyReferee = await isExistingReferee(table, fkColumn, parentId, profile.user_id);
    if (alreadyReferee) return { ok: false, reason: 'already-exists' };

    const insertRow = { [fkColumn]: parentId, user_id: profile.user_id };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase.from(table) as any).insert(insertRow);
    if (insertError) throw insertError;

    return { ok: true, displayName: profile.display_name, userId: profile.user_id };
  } catch (error) {
    return { ok: false, reason: 'error', error };
  }
}

/**
 * Delete a referee row by id. Hook owns the toast strings.
 */
export async function removeRefereeHelper(
  table: RefereeTableName,
  refereeId: string
): Promise<RemoveRefereeResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from(table) as any).delete().eq('id', refereeId);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

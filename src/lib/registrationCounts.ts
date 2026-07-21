// Approved-registration counts for the /tournaments social-proof badge.
// Kept out of useTournamentData (the react-query hook module) because these are
// pure, batched, reusable data helpers — same split as regBadge.ts (the display
// decision). Approved-only on purpose: pending is self-serve and never
// auto-resolves, so counting it would inflate / be gameable.

import { supabase } from "@/integrations/supabase/client";

/**
 * One batched count query per registration table (singles vs doubles), NOT a
 * per-card fan-out. Returns each table with `registered_count`. A count-query
 * error degrades to `undefined` (no badge) rather than throwing — the list must
 * render even if counts fail.
 */
export async function attachQuickTableApprovedCounts<T extends { id: string; is_doubles?: boolean }>(
  tables: T[],
): Promise<(T & { registered_count?: number })[]> {
  const singlesIds = tables.filter((t) => !t.is_doubles).map((t) => t.id);
  const doublesIds = tables.filter((t) => t.is_doubles).map((t) => t.id);
  const empty = { data: [] as { table_id: string }[] };
  const [singles, doubles] = await Promise.all([
    singlesIds.length
      ? supabase.from("quick_table_registrations").select("table_id").in("table_id", singlesIds).eq("status", "approved")
      : Promise.resolve(empty),
    doublesIds.length
      ? supabase.from("quick_table_teams").select("table_id").in("table_id", doublesIds).eq("team_status", "approved")
      : Promise.resolve(empty),
  ]);
  const counts = new Map<string, number>();
  for (const r of singles.data ?? []) counts.set(r.table_id, (counts.get(r.table_id) ?? 0) + 1);
  for (const r of doubles.data ?? []) counts.set(r.table_id, (counts.get(r.table_id) ?? 0) + 1);
  return tables.map((t) => ({ ...t, registered_count: counts.get(t.id) }));
}

/** One batched count of approved teams keyed by tournament_id. Degrades to
 *  undefined on error (no badge), never throws. */
export async function attachTeamMatchApprovedCounts<T extends { id: string }>(
  rows: T[],
): Promise<(T & { registered_count?: number })[]> {
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return rows.map((r) => ({ ...r }));
  const { data } = await supabase
    .from("team_match_teams")
    .select("tournament_id")
    .in("tournament_id", ids)
    .eq("status", "approved");
  const counts = new Map<string, number>();
  for (const r of data ?? []) counts.set(r.tournament_id, (counts.get(r.tournament_id) ?? 0) + 1);
  return rows.map((r) => ({ ...r, registered_count: counts.get(r.id) }));
}

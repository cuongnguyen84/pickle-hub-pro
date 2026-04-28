/**
 * Returns a millisecond + random suffix safe to use inside a Supabase
 * realtime channel name.
 *
 * Why not just Date.now()?
 *   When two useEffect bodies fire in the same millisecond — React
 *   StrictMode double-invoke, fast reconnect after CHANNEL_ERROR,
 *   navigation burst — `supabase.channel(name)` returns the SAME
 *   internal instance for identical names. The second `.on('postgres_
 *   changes', ...)` then throws "cannot add postgres_changes callbacks
 *   after subscribe()".
 *
 * Format: "<ms>-<9 base36 chars>". Collision odds inside a single tick
 * drop from ~certain (under burst load) to ~1 in 10^14.
 */
export function uniqueChannelSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

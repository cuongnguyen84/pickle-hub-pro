// Single source of truth for MLP DUPR registration gating (doubles-only).
// A captain is eligible when the tournament doesn't require DUPR, or their
// verified doubles rating is connected and within the per-gender cap.
export function isDuprEligible(params: {
  requireDupr: boolean;
  connected: boolean;
  rating: number | null;
  /** Upper bound for the captain's gender. null = no cap. */
  max: number | null;
}): boolean {
  const { requireDupr, connected, rating, max } = params;
  if (!requireDupr) return true;
  if (!connected || rating == null) return false;
  return max == null || rating <= max;
}

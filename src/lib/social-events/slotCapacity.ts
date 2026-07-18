// ============================================================================
// slotCapacity.ts — ARCH-02 increment 4: the one place slot capacity math
// lives. RegistrationModal previously computed taken/remaining/full three
// times with two different "full" expressions (`taken >= capacity` in the
// send-OTP gate, `remaining === 0` in both slot pickers) — equivalent for
// taken >= 0, but one drift away from an overbooking display bug.
// ============================================================================

export interface SlotAvailability {
  taken: number;
  remaining: number;
  full: boolean;
}

export function slotAvailability(
  capacity: number,
  taken: number | undefined,
): SlotAvailability {
  const t = taken ?? 0;
  const remaining = Math.max(0, capacity - t);
  return { taken: t, remaining, full: remaining === 0 };
}

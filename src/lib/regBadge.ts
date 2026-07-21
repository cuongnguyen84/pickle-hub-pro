// Social-proof registration badge — shared threshold + eligibility so the card
// display logic and its tests read from ONE source. Approved-only counts live in
// useTournamentData (attach*ApprovedCounts); this decides when to show them.

// Below this many APPROVED registrations the count is hidden: "1 người đã đăng
// ký" reads as a dead event and works AGAINST the social proof we want. Tune
// after reading prod numbers (D3 telemetry).
export const REG_BADGE_MIN = 4;

type BadgeRow = {
  status: string;
  requires_registration?: boolean;
  registered_count?: number;
};

/**
 * The count to display, or null to hide the badge. Single source of truth for
 * badge eligibility + threshold. A badge shows ONLY when the row is
 * registration-open — QuickTable `setup` + `requires_registration`, or Team
 * Match `status='registration'` — AND has ≥ REG_BADGE_MIN approved. Anything
 * else (already playing, ad-hoc table, below threshold) hides it so "đã đăng ký"
 * never appears where it is semantically wrong.
 */
export function regBadgeCount(
  t: BadgeRow,
  fmt: "quick-tables" | "team-match" | (string & {}),
): number | null {
  const eligible =
    fmt === "quick-tables"
      ? !!t.requires_registration && t.status === "setup"
      : fmt === "team-match"
        ? t.status === "registration"
        : false;
  const n = t.registered_count ?? 0;
  return eligible && n >= REG_BADGE_MIN ? n : null;
}

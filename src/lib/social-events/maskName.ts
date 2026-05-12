// ============================================================================
// maskName — public-roster display masking for guest registrations
// ----------------------------------------------------------------------------
// VN-friendly pattern: first word + initial of the remainder. Keeps the
// most recognizable identity bit (first/family name in VN order) while
// hiding the rest. Matches the discourse register of CLB Zalo groups
// where people refer to each other by first name + initial.
//
// Examples:
//   "Nguyễn Văn An"     → "Nguyễn V."
//   "Test User 1"       → "Test U."
//   "Cường"             → "Cường"     (single word stays)
//   "Lý"                → "Lý"        (single word stays, even if short)
//   ""                  → "Khách"     (empty → "Guest")
//   "  "                → "Khách"
// ============================================================================

export function maskName(name: string | null | undefined): string {
  if (name == null) return "Khách";
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Khách";

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0];
  }

  // First word stays full; remaining words collapse to first-letter
  // initials joined into a single dot-terminated token. For most VN
  // names (2–3 words) this produces "First L." or "First M.L." — both
  // read naturally in roster lists.
  const first = parts[0];
  const initials = parts
    .slice(1)
    .map((p) => (p[0] ? p[0].toUpperCase() : ""))
    .filter(Boolean)
    .join("");
  if (initials.length === 0) return first;
  return `${first} ${initials}.`;
}

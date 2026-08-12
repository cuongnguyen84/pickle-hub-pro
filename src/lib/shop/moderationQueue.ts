// ============================================================================
// How long a product has been waiting, in words.
// ----------------------------------------------------------------------------
// The number comes from the server (product_moderation_queue computes it from
// submitted_at) so every screen agrees on what "waiting" means. This turns it
// into something a moderator reads at a glance.
//
// Deliberately coarse: "3 ngày" is the decision-relevant fact, and "3 ngày 4
// giờ 12 phút" is noise in a table cell.
// ============================================================================

export function waitingLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const mins = Math.floor(seconds / 60);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ`;
  const days = Math.floor(hours / 24);
  return `${days} ngày`;
}

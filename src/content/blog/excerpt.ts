/** Ticker trail: ≤90 chars, ellipsis past that. Idempotent. */
export function truncateExcerpt(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (trimmed.length <= 90) return trimmed;
  return `${trimmed.slice(0, 87).trimEnd()}…`;
}

/**
 * Verified badge (2026-11-24): the OUTLINE rosette seal - serrated
 * ring, check inside, NO fill - which is the shape Cuong picked from
 * his sample (22:02 24/11). The solid fill shipped in #1137 was the
 * wrong sample. Color: the strong dark-mode green (#b5e853, the
 * --tl-green value on dark) for the ring AND the check, fixed for
 * BOTH themes - light mode must not pale it (its own --tl-green,
 * #516c1b, is not used here).
 */
export function VerifiedBadge({
  size = 16,
  label,
}: {
  size?: number;
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={label ?? "Verified"}
      style={{ flex: "0 0 auto", display: "inline-block", verticalAlign: "middle" }}
    >
      <path
        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
        fill="none"
        stroke="#b5e853"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        fill="none"
        stroke="#b5e853"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

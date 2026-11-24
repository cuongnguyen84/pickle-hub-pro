/**
 * Verified badge (2026-11-24): a SOLID seal in the dark theme's green
 * (#b5e853, the --tl-green value on dark) with the on-green ink
 * (#101803) for the check. Cuong's call: the badge must read the same
 * in light mode as in dark - the old outline icon in the light theme's
 * --tl-green (#516c1b) looked washed out on pale surfaces, so the
 * badge no longer inherits the theme variable at all.
 *
 * Shape (Cuong, 21:58 24/11): back to the OLD sample's scalloped seal
 * (serrated round rosette, bold check in the middle) - only the shape
 * reverted; the solid colors above stay for both themes.
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
        fill="#b5e853"
      />
      <path
        d="m9 12 2 2 4-4"
        fill="none"
        stroke="#101803"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Verified badge (2026-11-24): a SOLID seal in the dark theme's green
 * (#b5e853, the --tl-green value on dark) with the on-green ink
 * (#101803) for the check. Cuong's call: the badge must read the same
 * in light mode as in dark - the old outline icon in the light theme's
 * --tl-green (#516c1b) looked washed out on pale surfaces, so the
 * badge no longer inherits the theme variable at all.
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
      <circle cx="12" cy="12" r="10" fill="#b5e853" />
      <path
        d="m8.2 12.3 2.5 2.5 5.1-5.4"
        fill="none"
        stroke="#101803"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Deterministic generated-cover palettes for profiles without an
 * uploaded cover photo (2026-11-24 redesign). The same username
 * always maps to the same two-tone gradient, so a generated cover
 * looks designed per person rather than like a shared placeholder.
 */
const PALETTES: Array<[string, string]> = [
  ["#0b3d2e", "#00b56b"],
  ["#10243e", "#2f7fd0"],
  ["#3d2b0b", "#d09a2f"],
  ["#2b103e", "#7a4fd0"],
  ["#0e3a3a", "#2fb5a8"],
  ["#401622", "#d04f6a"],
];

export function coverPalette(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTES[h % PALETTES.length];
}

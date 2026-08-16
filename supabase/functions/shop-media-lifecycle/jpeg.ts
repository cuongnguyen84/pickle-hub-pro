// ============================================================================
// JPEG segment inspection — Deno-free, unit-tested from vitest.
// ----------------------------------------------------------------------------
// The iOS Safari fallback path: a canvas that cannot encode WebP produces a
// JPEG instead, and a canvas-encoded JPEG carries no APP1 segment. A file that
// still has one was not re-encoded — it was renamed, or produced by a tool
// that preserves metadata — and APP1 (Exif or XMP) is where GPS rides.
//
// Mirrors webp.ts: the verdict, not an exception, and the same three reasons.
// ============================================================================

export type JpegVerdict =
  | { ok: true; width: number; height: number }
  | { ok: false; reason: "not_jpeg" | "metadata_present" | "truncated" };

/**
 * Walk the marker segments up to the scan. Returns the image size when the
 * file is a metadata-free JPEG, otherwise says which check failed.
 */
export function inspectJpeg(bytes: Uint8Array): JpegVerdict {
  if (bytes.length < 4) return { ok: false, reason: "truncated" };
  // SOI: every JPEG starts FF D8.
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return { ok: false, reason: "not_jpeg" };

  let width = 0;
  let height = 0;
  let at = 2;

  while (at < bytes.length) {
    if (bytes[at] !== 0xff) return { ok: false, reason: "not_jpeg" };
    // FF FF … are fill bytes before a marker.
    let m = at + 1;
    while (m < bytes.length && bytes[m] === 0xff) m += 1;
    if (m >= bytes.length) return { ok: false, reason: "truncated" };
    const marker = bytes[m];

    // Markers that carry no length: SOI (never repeats but harmless), TEM, RSTn.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at = m + 1;
      continue;
    }
    // EOI before any SOS: a "JPEG" with no scan data. No encoder emits this;
    // whatever it is, it is not a photo.
    if (marker === 0xd9) return { ok: false, reason: "not_jpeg" };

    if (m + 2 >= bytes.length) return { ok: false, reason: "truncated" };
    const len = (bytes[m + 1] << 8) | bytes[m + 2];
    if (len < 2) return { ok: false, reason: "not_jpeg" };
    if (m + 1 + len > bytes.length) return { ok: false, reason: "truncated" };

    // APP1 — Exif or XMP, either way a canvas never writes one, and either way
    // it can carry the seller's coordinates.
    if (marker === 0xe1) return { ok: false, reason: "metadata_present" };

    // SOF0–SOF15 except DHT (C4), JPG (C8) and DAC (CC): height then width,
    // big-endian, after the one-byte precision.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (len >= 7) {
        height = (bytes[m + 4] << 8) | bytes[m + 5];
        width = (bytes[m + 6] << 8) | bytes[m + 7];
      }
    }

    // SOS: entropy-coded data follows, which is not segment-structured, so the
    // walk ends here. DELIBERATE blind spot: an APP1 crafted BETWEEN scans of
    // a progressive JPEG would not be seen. Every real encoder and every
    // metadata-preserving tool writes APP1 before SOF; only a hand-crafted
    // file hides it mid-scan, and its author would be leaking their own
    // coordinates. Same looseness as webp.ts, which trusts the declared chunk
    // structure without walking the VP8 bitstream.
    if (marker === 0xda) break;

    at = m + 1 + len;
  }

  if (width === 0 || height === 0) return { ok: false, reason: "not_jpeg" };
  return { ok: true, width, height };
}

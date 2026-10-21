// ============================================================================
// WebP container inspection — Deno-free, unit-tested from vitest.
// ----------------------------------------------------------------------------
// The client says it re-encoded the seller's photo through a canvas, which
// drops EXIF. Postgres can check the MIME type and the byte size against the
// storage catalogue, but it cannot look inside the file. This does.
//
// A canvas-encoded WebP is a plain RIFF container with VP8/VP8L payload and no
// metadata chunks. A file that still carries EXIF or XMP was not re-encoded —
// it was renamed, or produced by a tool that preserves metadata, and it may be
// carrying the GPS coordinates of the seller's home.
// ============================================================================

export type WebpVerdict =
  | { ok: true; width: number; height: number }
  | { ok: false; reason: "not_webp" | "metadata_present" | "truncated" };

const fourCC = (b: Uint8Array, at: number) =>
  String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);

const u32le = (b: Uint8Array, at: number) =>
  b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24);

/**
 * Walk the RIFF chunk list. Returns the image size when the file is a WebP
 * with no metadata chunk, otherwise says which check failed.
 */
export function inspectWebp(bytes: Uint8Array): WebpVerdict {
  if (bytes.length < 16) return { ok: false, reason: "truncated" };
  if (fourCC(bytes, 0) !== "RIFF" || fourCC(bytes, 8) !== "WEBP") {
    return { ok: false, reason: "not_webp" };
  }

  let width = 0;
  let height = 0;
  let at = 12;

  while (at + 8 <= bytes.length) {
    const id = fourCC(bytes, at);
    const size = u32le(bytes, at + 4) >>> 0;
    const body = at + 8;
    if (body + size > bytes.length) return { ok: false, reason: "truncated" };

    // EXIF is the one that can carry GPS. XMP can carry location too, and
    // ICCP is harmless but signals the file was not produced by a canvas —
    // treat any metadata chunk as "not re-encoded" rather than guessing.
    if (id === "EXIF" || id === "XMP ") return { ok: false, reason: "metadata_present" };

    if (id === "VP8X" && size >= 10) {
      width = 1 + ((bytes[body + 4] | (bytes[body + 5] << 8) | (bytes[body + 6] << 16)) & 0xffffff);
      height = 1 + ((bytes[body + 7] | (bytes[body + 8] << 8) | (bytes[body + 9] << 16)) & 0xffffff);
    } else if (id === "VP8 " && size >= 10) {
      // Lossy keyframe header: 3-byte tag, 3-byte start code, then 14-bit dims.
      width = (bytes[body + 6] | (bytes[body + 7] << 8)) & 0x3fff;
      height = (bytes[body + 8] | (bytes[body + 9] << 8)) & 0x3fff;
    } else if (id === "VP8L" && size >= 5) {
      const bits = u32le(bytes, body + 1) >>> 0;
      width = (bits & 0x3fff) + 1;
      height = ((bits >> 14) & 0x3fff) + 1;
    }

    // Chunks are padded to an even length.
    at = body + size + (size % 2);
  }

  if (width === 0 || height === 0) return { ok: false, reason: "not_webp" };
  return { ok: true, width, height };
}

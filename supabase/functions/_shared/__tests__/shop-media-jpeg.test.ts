/**
 * The APP1 check that stands between a seller's home coordinates and a public
 * CDN, for the iOS Safari fallback path. A canvas-encoded JPEG never carries
 * an APP1 segment; a file that does was renamed, not re-encoded.
 */
import { describe, expect, it } from "vitest";
import { inspectJpeg } from "../../shop-media-lifecycle/jpeg.ts";

/** One marker segment: FF <marker> <len_be16> <payload>. */
function seg(marker: number, payload: number[]): number[] {
  const len = payload.length + 2;
  return [0xff, marker, (len >> 8) & 0xff, len & 0xff, ...payload];
}

/** SOF0 payload: precision, height be16, width be16, 1 grey component. */
function sof0(width: number, height: number): number[] {
  return seg(0xc0, [
    8,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    1, 0x11, 0x11, 0,
  ]);
}

/** Minimal canvas-shaped JPEG: SOI, DQT, SOF0, SOS + a little scan data. */
function jpeg(width: number, height: number, extra: number[] = []): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8, // SOI
    ...extra,
    ...seg(0xdb, Array(65).fill(1)), // DQT
    ...sof0(width, height),
    ...seg(0xda, [1, 1, 0, 0, 63, 0]), // SOS — scan data follows
    0x12, 0x34, 0x56,
    0xff, 0xd9, // EOI
  ]);
}

describe("inspectJpeg", () => {
  it("accepts a canvas-shaped JPEG and reads its dimensions", () => {
    expect(inspectJpeg(jpeg(1200, 900))).toEqual({ ok: true, width: 1200, height: 900 });
  });

  it("rejects a file that still carries APP1 — Exif or XMP, it was never re-encoded", () => {
    const withExif = jpeg(800, 600, seg(0xe1, [..."Exif"].map((c) => c.charCodeAt(0)).concat([0, 0])));
    expect(inspectJpeg(withExif)).toEqual({ ok: false, reason: "metadata_present" });
  });

  it("rejects a truncated upload rather than guessing", () => {
    const cut = jpeg(100, 100).slice(0, 8); // mid-DQT: segment runs past the buffer
    expect(inspectJpeg(cut)).toEqual({ ok: false, reason: "truncated" });
  });

  it("rejects something that is not a JPEG at all", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(inspectJpeg(png)).toEqual({ ok: false, reason: "not_jpeg" });
  });

  it("rejects a JPEG with no SOF — there are no dimensions to trust", () => {
    const noSof = new Uint8Array([0xff, 0xd8, ...seg(0xdb, Array(65).fill(1)), 0xff, 0xd9]);
    expect(inspectJpeg(noSof)).toEqual({ ok: false, reason: "not_jpeg" });
  });

  it("rejects EOI before any scan, even with a valid SOF — no scan data, no photo", () => {
    const noScan = new Uint8Array([0xff, 0xd8, ...sof0(800, 600), 0xff, 0xd9]);
    expect(inspectJpeg(noScan)).toEqual({ ok: false, reason: "not_jpeg" });
  });

  it("skips fill bytes before a marker, as a real encoder may emit", () => {
    const filled = new Uint8Array([
      0xff, 0xd8,
      0xff, // fill byte before the DQT marker
      ...Array.from(jpeg(64, 32).slice(2)),
    ]);
    expect(inspectJpeg(filled)).toEqual({ ok: true, width: 64, height: 32 });
  });
});

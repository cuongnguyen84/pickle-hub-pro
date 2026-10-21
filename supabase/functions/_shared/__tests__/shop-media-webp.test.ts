/**
 * The EXIF check that stands between a seller's home coordinates and a public
 * CDN. Postgres can only see the declared MIME type; this sees the bytes.
 */
import { describe, expect, it } from "vitest";
import { inspectWebp } from "../../shop-media-lifecycle/webp.ts";

/** Minimal RIFF/WEBP builder: header + the chunks you ask for. */
function webp(chunks: Array<{ id: string; body: number[] }>): Uint8Array {
  const parts: number[] = [];
  for (const c of chunks) {
    const size = c.body.length;
    parts.push(...[...c.id].map((ch) => ch.charCodeAt(0)));
    parts.push(size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >> 24) & 0xff);
    parts.push(...c.body);
    if (size % 2) parts.push(0);
  }
  const riffSize = 4 + parts.length;
  return new Uint8Array([
    ...[..."RIFF"].map((c) => c.charCodeAt(0)),
    riffSize & 0xff, (riffSize >> 8) & 0xff, (riffSize >> 16) & 0xff, (riffSize >> 24) & 0xff,
    ...[..."WEBP"].map((c) => c.charCodeAt(0)),
    ...parts,
  ]);
}

/** VP8L payload whose 32 bits after the signature encode width/height - 1. */
function vp8l(width: number, height: number): { id: string; body: number[] } {
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  return {
    id: "VP8L",
    body: [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >> 24) & 0xff],
  };
}

describe("inspectWebp", () => {
  it("accepts a canvas-shaped WebP and reads its dimensions", () => {
    expect(inspectWebp(webp([vp8l(1200, 900)]))).toEqual({ ok: true, width: 1200, height: 900 });
  });

  it("rejects a file that still carries EXIF — it was never re-encoded", () => {
    const withExif = webp([vp8l(800, 600), { id: "EXIF", body: [1, 2, 3, 4] }]);
    expect(inspectWebp(withExif)).toEqual({ ok: false, reason: "metadata_present" });
  });

  it("rejects XMP too, which can carry location just as happily", () => {
    const withXmp = webp([vp8l(800, 600), { id: "XMP ", body: [9, 9] }]);
    expect(inspectWebp(withXmp)).toEqual({ ok: false, reason: "metadata_present" });
  });

  it("rejects a JPEG that was merely renamed to .webp", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3, 4, 5]);
    expect(inspectWebp(jpeg)).toEqual({ ok: false, reason: "not_webp" });
  });

  it("rejects a truncated upload rather than guessing", () => {
    const short = webp([vp8l(100, 100)]).slice(0, 10);
    expect(inspectWebp(short)).toEqual({ ok: false, reason: "truncated" });
  });

  it("rejects a chunk claiming more bytes than the file holds", () => {
    const lying = webp([vp8l(100, 100)]);
    lying[16] = 0xff;
    lying[17] = 0xff;
    expect(inspectWebp(lying)).toEqual({ ok: false, reason: "truncated" });
  });
});

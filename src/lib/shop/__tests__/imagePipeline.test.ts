/**
 * The browser image pipeline.
 *
 * Two halves are testable without a browser and are tested here: what the bytes
 * are (signature sniffing) and how big the output should be. The half that
 * needs a real canvas — decode, orientation, WebP encode, EXIF removal — is
 * proven in scripts/shop-media-integration.test.mjs against a real image and a
 * real Storage upload, because a jsdom canvas encodes nothing and a test that
 * mocks toBlob proves only that the mock was called.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HEIC_MESSAGE,
  IMAGE_LIMITS,
  runQueue,
  sniffImageType,
  targetSize,
} from "../imagePipeline";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => Array.from(text).map((c) => c.charCodeAt(0));

describe("the limits are the server's limits", () => {
  it("matches shop_media_limits() in the migration", () => {
    // A client that allows what the server refuses wastes the seller's upload;
    // a client stricter than the server blocks a photo that would have been
    // accepted. Both are the same defect, so the numbers are compared.
    const sql = readFileSync(
      resolve(__dirname, "../../../../supabase/migrations/20260811140000_shop_phase2a_media_lifecycle.sql"),
      "utf8",
    );
    const block = sql.slice(sql.indexOf("FUNCTION public.shop_media_limits"), sql.indexOf("GRANT EXECUTE ON FUNCTION public.shop_media_limits"));
    expect(block).toContain(`'max_input_bytes',        ${IMAGE_LIMITS.maxInputBytes}`);
    expect(block).toContain(`'max_rendition_bytes',    ${IMAGE_LIMITS.maxRenditionBytes}`);
    expect(block).toContain(`'max_dimension',          ${IMAGE_LIMITS.maxDimension}`);
    expect(block).toContain(`'max_per_product',        ${IMAGE_LIMITS.maxPerProduct}`);
    expect(block).toContain(`'rendition_content_type', '${IMAGE_LIMITS.renditionType}'`);
    for (const type of IMAGE_LIMITS.inputTypes) expect(block).toContain(`'${type}'`);
  });
});

describe("sniffImageType — the bytes, not the filename", () => {
  it("recognises JPEG", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
  });

  it("recognises PNG", () => {
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
  });

  it("recognises WebP, which needs both RIFF and WEBP", () => {
    expect(sniffImageType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))).toBe("image/webp");
    // RIFF alone is a container — WAV is RIFF too, and is not an image.
    expect(sniffImageType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")))).toBe("unknown");
  });

  it.each(["heic", "heix", "hevc", "mif1", "msf1"])("recognises the %s brand as HEIC", (brand) => {
    expect(sniffImageType(bytes(0, 0, 0, 0x18, ...ascii("ftyp"), ...ascii(brand)))).toBe("image/heic");
  });

  it("does not call every ISO-BMFF file HEIC — an mp4 is not a photo", () => {
    expect(sniffImageType(bytes(0, 0, 0, 0x18, ...ascii("ftyp"), ...ascii("isom")))).toBe("unknown");
  });

  it("catches the case it is really here for: a HEIC named .jpg", () => {
    // The OS reports image/jpeg from the extension. Only the signature knows.
    const heicBytes = bytes(0, 0, 0, 0x18, ...ascii("ftyp"), ...ascii("heic"));
    expect(sniffImageType(heicBytes)).toBe("image/heic");
  });

  it("returns unknown for something that is not an image at all", () => {
    expect(sniffImageType(bytes(...ascii("%PDF-1.7")))).toBe("unknown");
    expect(sniffImageType(bytes())).toBe("unknown");
  });
});

describe("the HEIC message", () => {
  it("says what to choose instead, and how to stop it happening again", () => {
    expect(HEIC_MESSAGE).toContain("HEIC");
    expect(HEIC_MESSAGE).toContain("JPEG");
    expect(HEIC_MESSAGE).toMatch(/Tương thích nhất/);
  });
});

describe("targetSize", () => {
  it("never upscales — a small photo stays small", () => {
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(targetSize(100, 100)).toEqual({ width: 100, height: 100 });
  });

  it("caps the longest edge and keeps the aspect ratio", () => {
    expect(targetSize(4000, 3000)).toEqual({ width: 2048, height: 1536 });
    expect(targetSize(3000, 4000)).toEqual({ width: 1536, height: 2048 });
  });

  it("leaves an image exactly at the cap alone", () => {
    expect(targetSize(2048, 1024)).toEqual({ width: 2048, height: 1024 });
  });

  it("accepts a smaller cap for a logo, where 2048px is pointless weight", () => {
    expect(targetSize(4000, 4000, 512)).toEqual({ width: 512, height: 512 });
  });
});

describe("runQueue", () => {
  it("never runs more than the concurrency at once", async () => {
    // Eight 8 MB photos decoded together is several hundred MB of bitmap, which
    // on a mid-range Android is a tab that disappears.
    let inFlight = 0;
    let peak = 0;
    await runQueue(
      Array.from({ length: 9 }, (_, i) => i),
      async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await Promise.resolve();
        await Promise.resolve();
        inFlight--;
      },
      2,
    );
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("runs every item exactly once, in order of start", async () => {
    const seen: number[] = [];
    await runQueue([10, 20, 30], async (item) => {
      seen.push(item);
    }, 1);
    expect(seen).toEqual([10, 20, 30]);
  });

  it("handles an empty list without hanging", async () => {
    await expect(runQueue([], async () => {}, 3)).resolves.toBeUndefined();
  });

  it("passes the index, so a caller can address its own slot", async () => {
    const pairs: [unknown, number][] = [];
    await runQueue(["a", "b"], async (item, index) => {
      pairs.push([item, index]);
    }, 1);
    expect(pairs).toEqual([["a", 0], ["b", 1]]);
  });
});

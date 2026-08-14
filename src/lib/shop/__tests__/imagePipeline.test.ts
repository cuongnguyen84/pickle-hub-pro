// @vitest-environment jsdom
// ============================================================================
// The image pipeline is a privacy boundary, not a resizer
// ----------------------------------------------------------------------------
// Everything a seller uploads goes through here first, and three of the things
// it does are the reason the server can be strict later:
//
//   · it decides what a file IS from its bytes, not from its name or the type
//     the OS reported — an iPhone photo called .jpg that is HEIC inside is the
//     case this exists for;
//   · it re-encodes through a canvas, which is what drops EXIF, and with it
//     the GPS coordinates of the seller's home;
//   · it refuses, in the seller's language, instead of uploading something the
//     server will reject after they have already waited.
//
// jsdom has no image decoder, so `createImageBitmap` and `toBlob` are stubbed —
// but nothing else is. The sniffing, the size policy, the quality ladder, the
// abort handling and the bitmap release are the real functions.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  IMAGE_LIMITS,
  HEIC_MESSAGE,
  ImageRejected,
  processImage,
  readHead,
  runQueue,
  sniffImageType,
  targetSize,
} from "../imagePipeline";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => Array.from(text).map((c) => c.charCodeAt(0));

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
const WEBP = bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"));
const HEIC = bytes(0, 0, 0, 0x18, ...ascii("ftyp"), ...ascii("heic"));

const fileOf = (head: Uint8Array, size = head.length, type = "image/jpeg") => {
  const blob = new Blob([head.slice().buffer as ArrayBuffer], { type });
  // File.size has to be the claimed size for the too-big path; the bytes only
  // need to be readable for the sniff.
  Object.defineProperty(blob, "size", { value: size });
  return blob as Blob;
};

/** Stand in for the decoder. Records whether the bitmap was released. */
const stubBitmap = (width: number, height: number) => {
  const close = vi.fn();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width, height, close })),
  );
  return { close };
};

/** Stand in for the encoder. `sizes` is walked as the quality ladder steps. */
const stubCanvas = (sizes: number[], type: string = IMAGE_LIMITS.renditionType) => {
  const drawImage = vi.fn();
  let call = 0;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    cb: BlobCallback,
  ) {
    const size = sizes[Math.min(call, sizes.length - 1)];
    call += 1;
    if (size < 0) return cb(null);
    const blob = new Blob(["x"], { type });
    Object.defineProperty(blob, "size", { value: size });
    cb(blob);
  });
  return { drawImage, calls: () => call };
};

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("sniffImageType — the bytes, not the claim", () => {
  it.each([
    ["JPEG", JPEG, "image/jpeg"],
    ["PNG", PNG, "image/png"],
    ["WebP", WEBP, "image/webp"],
    ["HEIC", HEIC, "image/heic"],
  ])("recognises %s", (_name, head, expected) => {
    expect(sniffImageType(head)).toBe(expected);
  });

  it.each([["heix"], ["hevc"], ["mif1"], ["msf1"]])(
    "recognises the %s brand a phone also produces",
    (brand) => {
      expect(sniffImageType(bytes(0, 0, 0, 0x18, ...ascii("ftyp"), ...ascii(brand)))).toBe("image/heic");
    },
  );

  it("does not mistake another ISO-BMFF container for a photo", () => {
    // mp4 is ftyp too. Calling it HEIC would show a seller the iPhone advice
    // for a video they picked by accident.
    expect(sniffImageType(bytes(0, 0, 0, 0x18, ...ascii("ftyp"), ...ascii("mp42")))).toBe("unknown");
  });

  it("returns unknown for a truncated header rather than guessing", () => {
    expect(sniffImageType(bytes(0xff, 0xd8))).toBe("unknown");
    expect(sniffImageType(new Uint8Array())).toBe("unknown");
  });

  it("is not fooled by RIFF that is not WebP", () => {
    expect(sniffImageType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("AVI ")))).toBe("unknown");
  });

  it("reads only the head it was asked for", async () => {
    const head = await readHead(fileOf(JPEG, JPEG.length), 4);
    expect(Array.from(head)).toEqual([0xff, 0xd8, 0xff, 0xe0]);
  });
});

describe("targetSize — cap the longest edge, never enlarge", () => {
  it("leaves an image that already fits alone", () => {
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("does not upscale a small photo into a bigger, worse file", () => {
    expect(targetSize(100, 50, 2048)).toEqual({ width: 100, height: 50 });
  });

  it("keeps the aspect ratio when it caps", () => {
    expect(targetSize(4096, 2048)).toEqual({ width: 2048, height: 1024 });
    expect(targetSize(2048, 4096)).toEqual({ width: 1024, height: 2048 });
  });

  it("caps on the longest edge, not on width", () => {
    const { width, height } = targetSize(1000, 3000, 1500);
    expect(Math.max(width, height)).toBe(1500);
    expect(width).toBe(500);
  });
});

describe("processImage — what a seller is allowed to send", () => {
  it("refuses a file over the input limit before decoding anything", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    await expect(
      processImage(fileOf(JPEG, IMAGE_LIMITS.maxInputBytes + 1)),
    ).rejects.toBeInstanceOf(ImageRejected);
    // The point of checking size first: a 40 MB photo must not be decoded to
    // find out it is too big.
    expect(decode).not.toHaveBeenCalled();
  });

  it("refuses HEIC with the iPhone setting, not a generic error", async () => {
    await expect(processImage(fileOf(HEIC, 1000))).rejects.toThrow(HEIC_MESSAGE);
  });

  it("refuses a file whose bytes are not an image, whatever it is named", async () => {
    const notAnImage = fileOf(bytes(...ascii("%PDF-1.7")), 1000, "image/jpeg");
    await expect(processImage(notAnImage)).rejects.toThrow(/không phải ảnh/i);
  });

  it("re-encodes to WebP and reports what the source really was", async () => {
    stubBitmap(1200, 900);
    stubCanvas([500_000]);
    const out = await processImage(fileOf(PNG, 4000));
    expect(out.blob.type).toBe(IMAGE_LIMITS.renditionType);
    expect(out.sourceType).toBe("image/png");
    expect(out).toMatchObject({ width: 1200, height: 900 });
  });

  it("steps the quality down until it fits instead of failing just over", async () => {
    stubBitmap(1000, 1000);
    const canvas = stubCanvas([
      IMAGE_LIMITS.maxRenditionBytes + 1, // 0.82 — 1 byte over
      IMAGE_LIMITS.maxRenditionBytes + 1, // 0.70
      IMAGE_LIMITS.maxRenditionBytes - 1, // 0.60 — fits
    ]);
    const out = await processImage(fileOf(JPEG, 4000));
    expect(out.blob.size).toBeLessThanOrEqual(IMAGE_LIMITS.maxRenditionBytes);
    expect(canvas.calls()).toBe(3);
  });

  it("gives up with a sentence a seller can act on when even the lowest quality is too big", async () => {
    stubBitmap(4000, 4000);
    stubCanvas([9_000_000, 9_000_000, 9_000_000, 9_000_000]);
    await expect(processImage(fileOf(JPEG, 4000))).rejects.toThrow(/vẫn quá nặng/i);
  });

  it("refuses a browser that hands back something other than WebP", async () => {
    // Silently accepting PNG here would move the failure to the server, where
    // the seller sees finalize fail instead of this sentence.
    stubBitmap(800, 800);
    stubCanvas([1000], "image/png");
    await expect(processImage(fileOf(JPEG, 4000))).rejects.toThrow(/WebP/);
  });

  it("refuses when the browser cannot give a 2D context", async () => {
    stubBitmap(800, 800);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    await expect(processImage(fileOf(JPEG, 4000))).rejects.toBeInstanceOf(ImageRejected);
  });

  it("turns a decode failure into a sentence, not a raw DOM error", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => { throw new Error("boom"); }));
    await expect(processImage(fileOf(JPEG, 4000))).rejects.toThrow(/bị hỏng/);
  });

  it("caps the longest edge at the limit the server also enforces", async () => {
    stubBitmap(4096, 2048);
    stubCanvas([500_000]);
    const out = await processImage(fileOf(JPEG, 4000));
    expect(Math.max(out.width, out.height)).toBe(IMAGE_LIMITS.maxDimension);
  });

  it("releases the bitmap even when it throws — a leaked one kills a phone tab", async () => {
    const { close } = stubBitmap(800, 800);
    stubCanvas([-1]); // toBlob yields null
    await expect(processImage(fileOf(JPEG, 4000))).rejects.toBeInstanceOf(ImageRejected);
    expect(close).toHaveBeenCalled();
  });

  it("stops on an aborted signal and does not return a blob anyway", async () => {
    stubBitmap(800, 800);
    stubCanvas([500_000]);
    const controller = new AbortController();
    controller.abort();
    await expect(processImage(fileOf(JPEG, 4000), { signal: controller.signal })).rejects.toThrow(
      /abort/i,
    );
  });
});

describe("runQueue — a phone survives eight photos", () => {
  it("never runs more than the concurrency at once", async () => {
    let inFlight = 0;
    let peak = 0;
    await runQueue(
      Array.from({ length: 8 }, (_, i) => i),
      async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight -= 1;
      },
      2,
    );
    expect(peak).toBe(2);
  });

  it("passes each item exactly once, with its index", async () => {
    const seen: Array<[string, number]> = [];
    await runQueue(["a", "b", "c"], async (item, index) => { seen.push([item, index]); }, 2);
    expect(seen.sort()).toEqual([["a", 0], ["b", 1], ["c", 2]]);
  });

  it("does nothing, and does not hang, on an empty list", async () => {
    const worker = vi.fn();
    await expect(runQueue([], worker, 2)).resolves.toBeUndefined();
    expect(worker).not.toHaveBeenCalled();
  });
});

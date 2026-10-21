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
// The worker's own check, imported rather than described: the client fix is
// only worth anything if the bytes it produces pass the exact function that
// rejected them in production.
import { inspectJpeg } from "../../../../supabase/functions/shop-media-lifecycle/jpeg";
import {
  IMAGE_LIMITS,
  HEIC_MESSAGE,
  ImageRejected,
  processImage,
  readHead,
  runQueue,
  sniffImageType,
  stripJpegMetadata,
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

/**
 * Stand in for the encoder. `sizes` is walked as the quality ladder steps.
 *
 * `type` decides what the blob CLAIMS to be per call: by default the stub
 * echoes the requested type (a capable browser); a string forces every blob to
 * that type; a function gets the requested type and the call index — which is
 * how Safari is simulated, answering a WebP request with a PNG-typed blob.
 * Every requested encoder type and quality is recorded, so a test can assert
 * the webp→jpeg order and the restart from 0.82.
 */
const stubCanvas = (
  sizes: number[],
  type?: string | ((requested: string, call: number) => string),
) => {
  const drawImage = vi.fn();
  const requestedTypes: string[] = [];
  const requestedQualities: number[] = [];
  let call = 0;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    cb: BlobCallback,
    requested?: string,
    quality?: number,
  ) {
    requestedTypes.push(requested ?? "");
    requestedQualities.push(quality ?? NaN);
    const size = sizes[Math.min(call, sizes.length - 1)];
    const blobType =
      typeof type === "function" ? type(requested ?? "", call) : type ?? requested ?? "";
    call += 1;
    if (size < 0) return cb(null);
    const blob = new Blob(["x"], { type: blobType });
    Object.defineProperty(blob, "size", { value: size });
    cb(blob);
  });
  return { drawImage, calls: () => call, requestedTypes, requestedQualities };
};

/** Safari's answer: a WebP request comes back PNG-typed; JPEG works. */
const safariEncoder = (requested: string) =>
  requested === IMAGE_LIMITS.renditionType ? "image/png" : requested;

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
    const canvas = stubCanvas([500_000]);
    const out = await processImage(fileOf(PNG, 4000));
    expect(out.blob.type).toBe(IMAGE_LIMITS.renditionType);
    expect(out.sourceType).toBe("image/png");
    expect(out).toMatchObject({ width: 1200, height: 900 });
    // Chrome/Android path unchanged: WebP worked, so JPEG is never asked for.
    expect(canvas.requestedTypes).toEqual([IMAGE_LIMITS.renditionType]);
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

  it("falls back to JPEG when the WebP encoder is missing — iOS Safari", async () => {
    // Safari answers a WebP request with a PNG-typed blob. The whole ladder
    // runs again as JPEG, from the top quality, never mixing types mid-ladder.
    stubBitmap(800, 800);
    const canvas = stubCanvas([500_000], safariEncoder);
    const out = await processImage(fileOf(JPEG, 4000));
    expect(out.blob.type).toBe("image/jpeg");
    expect(canvas.requestedTypes).toEqual([IMAGE_LIMITS.renditionType, "image/jpeg"]);
    // The JPEG ladder restarts at 0.82 rather than resuming where WebP died.
    expect(canvas.requestedQualities).toEqual([0.82, 0.82]);
  });

  it("falls back to JPEG when the WebP encoder answers with null, too", async () => {
    // Some browsers say "no" with a null blob instead of a wrong-typed one.
    // Either answer means the same thing — no WebP encoder — and gets the
    // same fallback, not an immediate failure.
    stubBitmap(800, 800);
    const canvas = stubCanvas([-1, 500_000]); // call 0: webp → null; call 1: jpeg fits
    const out = await processImage(fileOf(JPEG, 4000));
    expect(out.blob.type).toBe("image/jpeg");
    expect(canvas.requestedTypes).toEqual([IMAGE_LIMITS.renditionType, "image/jpeg"]);
  });

  it("steps the quality down inside the JPEG branch too", async () => {
    stubBitmap(1000, 1000);
    const canvas = stubCanvas(
      [
        500_000, // call 0: the WebP probe — type comes back wrong, size unused
        IMAGE_LIMITS.maxRenditionBytes + 1, // jpeg 0.82 — 1 byte over
        IMAGE_LIMITS.maxRenditionBytes + 1, // jpeg 0.70
        IMAGE_LIMITS.maxRenditionBytes - 1, // jpeg 0.60 — fits
      ],
      safariEncoder,
    );
    const out = await processImage(fileOf(JPEG, 4000));
    expect(out.blob.type).toBe("image/jpeg");
    expect(out.blob.size).toBeLessThanOrEqual(IMAGE_LIMITS.maxRenditionBytes);
    expect(canvas.requestedQualities).toEqual([0.82, 0.82, 0.7, 0.6]);
  });

  it("refuses a browser that can encode neither WebP nor JPEG", async () => {
    // The old copy said "thử trình duyệt khác" because only WebP was accepted;
    // now that a JPEG-capable browser always gets through, the advice changed.
    stubBitmap(800, 800);
    stubCanvas([1000], "image/png");
    await expect(processImage(fileOf(JPEG, 4000))).rejects.toThrow(/không nén được ảnh/i);
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

// ─── The JPEG fallback's own metadata ───────────────────────────────────────
// Production, 2026-08-17: both of the shop's renditions were canvas-encoded
// JPEGs — and both carried FFE1 "Exif" plus an FFED "Photoshop 3.0" block,
// because WebKit encodes through ImageIO. inspectJpeg calls that
// metadata_present, the worker answers 422, and publish_profile 502s. The
// shape below is that file, minus the pixels.

/** One marker segment: FF <marker> <len_be16> <payload>. */
const seg = (marker: number, payload: number[]) => {
  const len = payload.length + 2;
  return [0xff, marker, (len >> 8) & 0xff, len & 0xff, ...payload];
};

const webkitJpeg = (width: number, height: number) =>
  new Uint8Array([
    0xff, 0xd8, // SOI
    ...seg(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 0x48, 0, 0x48, 0, 0]), // APP0
    ...seg(0xe1, [...ascii("Exif"), 0, 0, ...ascii("MM"), 0, 42, 0, 0, 0, 8]), // APP1
    ...seg(0xed, [...ascii("Photoshop 3.0"), 0, ...ascii("8BIM"), 4, 4, 0, 0]), // APP13
    ...seg(0xdb, Array(65).fill(1)), // DQT
    ...seg(0xc0, [8, (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff, 1, 0x11, 0x11, 0]),
    ...seg(0xda, [1, 1, 0, 0, 63, 0]), // SOS
    0x12, 0x34, 0x56,
    0xff, 0xd9, // EOI
  ]);

describe("stripJpegMetadata — what WebKit adds, the worker refuses", () => {
  it("is the reason the publish failed: the raw canvas JPEG is rejected", () => {
    expect(inspectJpeg(webkitJpeg(2048, 1536))).toEqual({
      ok: false,
      reason: "metadata_present",
    });
  });

  it("passes the worker's check after stripping, with the pixels intact", () => {
    const clean = stripJpegMetadata(webkitJpeg(2048, 1536));
    expect(inspectJpeg(clean)).toEqual({ ok: true, width: 2048, height: 1536 });
    // Scan data and EOI travel untouched — only the metadata segments go.
    expect(Array.from(clean.slice(-5))).toEqual([0x12, 0x34, 0x56, 0xff, 0xd9]);
    expect(clean.length).toBeLessThan(webkitJpeg(2048, 1536).length);
  });

  it("returns the same array when there is nothing to strip", () => {
    const clean = stripJpegMetadata(webkitJpeg(64, 32));
    expect(stripJpegMetadata(clean)).toBe(clean);
  });

  it("leaves anything that is not a walkable JPEG exactly as it was", () => {
    const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    expect(stripJpegMetadata(png)).toBe(png);
    const truncated = webkitJpeg(100, 100).slice(0, 10);
    expect(stripJpegMetadata(truncated)).toBe(truncated);
  });

  it("drops a whole run of APP segments, not just the first one", () => {
    // ImageIO emits Exif, then Photoshop, then an ICC profile — back to back.
    // Stopping after one leaves the file metadata_present all the same.
    const structure = [
      ...seg(0xdb, Array(65).fill(1)), // DQT
      ...seg(0xc0, [8, 0, 64, 0, 64, 1, 0x11, 0x11, 0]), // SOF0 64×64
      ...seg(0xda, [1, 1, 0, 0, 63, 0]), // SOS
      0x12, 0x34, 0x56,
      0xff, 0xd9,
    ];
    const app0 = seg(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
    const dirty = new Uint8Array([
      0xff, 0xd8,
      ...app0,
      ...seg(0xe1, [...ascii("Exif"), 0, 0]), // APP1
      ...seg(0xed, [...ascii("Photoshop 3.0"), 0]), // APP13
      ...seg(0xe2, [...ascii("ICC_PROFILE"), 0, 1, 1]), // APP2
      ...structure,
    ]);

    const clean = stripJpegMetadata(dirty);

    // Byte for byte: JFIF, the quantisation/frame/scan headers and the entropy
    // data are exactly what went in — only the three APP blocks are gone.
    expect(Array.from(clean)).toEqual([0xff, 0xd8, ...app0, ...structure]);
    expect(inspectJpeg(clean)).toEqual({ ok: true, width: 64, height: 64 });
  });

  it("walks past fill bytes instead of giving up on the file", () => {
    // FF FF before a marker is legal padding. Treating the second FF as the
    // marker aborts the walk and ships the Exif untouched.
    const app0 = seg(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
    const tail = [
      0xff, 0xff, // fill
      ...seg(0xdb, Array(65).fill(1)),
      ...seg(0xc0, [8, 0, 32, 0, 32, 1, 0x11, 0x11, 0]),
      ...seg(0xda, [1, 1, 0, 0, 63, 0]),
      0x77,
      0xff, 0xd9,
    ];
    const dirty = new Uint8Array([
      0xff, 0xd8,
      ...app0,
      ...seg(0xe1, [...ascii("Exif"), 0, 0]),
      ...tail,
    ]);

    const clean = stripJpegMetadata(dirty);

    expect(Array.from(clean)).toEqual([0xff, 0xd8, ...app0, ...tail]);
    expect(inspectJpeg(clean)).toEqual({ ok: true, width: 32, height: 32 });
  });

  it("does not stop at a marker that carries no length", () => {
    // TEM/RSTn are one marker and nothing else. Reading a length after one
    // walks into the next segment's bytes and aborts the walk — which ships
    // the Exif that this whole file exists to remove.
    const app0 = seg(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
    const structure = [
      ...seg(0xdb, Array(65).fill(1)),
      ...seg(0xc0, [8, 0, 32, 0, 32, 1, 0x11, 0x11, 0]), // SOF0 32×32
      ...seg(0xda, [1, 1, 0, 0, 63, 0]), // SOS
      0x77,
      0xff, 0xd9,
    ];
    const dirty = new Uint8Array([
      0xff, 0xd8,
      ...app0,
      0xff, 0x01, // TEM — standalone
      ...seg(0xe1, [...ascii("Exif"), 0, 0]),
      ...structure,
    ]);

    const clean = stripJpegMetadata(dirty);

    expect(Array.from(clean)).toEqual([0xff, 0xd8, ...app0, 0xff, 0x01, ...structure]);
    expect(inspectJpeg(clean)).toEqual({ ok: true, width: 32, height: 32 });
  });

  it("still strips when the file ends at EOI without ever reaching a scan", () => {
    // Not a photo, but it is a file the walk must finish rather than abandon
    // half-copied: the rebuild only happens after the loop, so an EOI treated
    // as a length-carrying segment would truncate the output.
    const app0 = seg(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
    const dirty = new Uint8Array([
      0xff, 0xd8,
      ...app0,
      ...seg(0xe1, [...ascii("Exif"), 0, 0]),
      0xff, 0xd9,
    ]);

    expect(Array.from(stripJpegMetadata(dirty))).toEqual([0xff, 0xd8, ...app0, 0xff, 0xd9]);
  });

  // The three ways the walk can fail, each with a segment ALREADY dropped
  // before it fails: that is the state where giving up has to mean "hand the
  // encoder's bytes back", not "write out what we kept so far" — which would
  // upload a file missing everything after the point we lost the thread.
  const app0 = () => seg(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const exif = () => seg(0xe1, [...ascii("Exif"), 0, 0]);

  it("hands back the original when a byte where a marker belongs is not FF", () => {
    const broken = new Uint8Array([
      0xff, 0xd8,
      ...exif(),
      ...app0(),
      0x00, // where FF should be
      ...seg(0xdb, Array(65).fill(1)),
      0xff, 0xd9,
    ]);

    expect(stripJpegMetadata(broken)).toBe(broken);
  });

  it("hands back the original when the file ends inside a run of fill bytes", () => {
    const broken = new Uint8Array([
      0xff, 0xd8,
      ...exif(),
      ...app0(),
      0xff, 0xff, // fill, then nothing
    ]);

    expect(stripJpegMetadata(broken)).toBe(broken);
  });

  it("hands back the original when a segment header is cut off mid-length", () => {
    const broken = new Uint8Array([
      0xff, 0xd8,
      ...exif(),
      ...app0(),
      0xff, 0xdb, // DQT with no length bytes at all
    ]);

    expect(stripJpegMetadata(broken)).toBe(broken);
  });

  it("hands back the original file when a segment length is impossible", () => {
    // len < 2 cannot include its own two length bytes. Rewriting a file we
    // cannot parse is how a working photo becomes a corrupt one — the upload
    // carries on with the bytes the encoder produced.
    const broken = new Uint8Array([
      0xff, 0xd8,
      ...seg(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
      0xff, 0xe1, 0x00, 0x01, // APP1 claiming a 1-byte length
      0xff, 0xd9,
    ]);

    const out = stripJpegMetadata(broken);

    expect(out).toBe(broken);
    expect(Array.from(out)).toEqual(Array.from(broken));
  });

  it("cleans the JPEG the pipeline hands the uploader, and only the JPEG one", async () => {
    stubBitmap(800, 800);
    // Safari: the WebP request comes back PNG-typed, so the JPEG ladder runs —
    // and the encoder's bytes carry Exif.
    const dirty = webkitJpeg(800, 800);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      this: HTMLCanvasElement,
      cb: BlobCallback,
      requested?: string,
    ) {
      if (requested === IMAGE_LIMITS.renditionType) return cb(new Blob(["x"], { type: "image/png" }));
      cb(new Blob([dirty.slice().buffer as ArrayBuffer], { type: "image/jpeg" }));
    });

    const out = await processImage(fileOf(JPEG, 4000));

    expect(out.blob.type).toBe("image/jpeg");
    const uploaded = new Uint8Array(await out.blob.arrayBuffer());
    expect(inspectJpeg(uploaded)).toEqual({ ok: true, width: 800, height: 800 });
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

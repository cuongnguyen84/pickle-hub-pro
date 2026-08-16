// ============================================================================
// Browser image pipeline: sniff, decode, downscale, re-encode to WebP.
// ----------------------------------------------------------------------------
// This is a UX and bandwidth step, NOT a security boundary. The worker and
// product_media_finalize() are the authoritative verifiers: they read the
// stored object's real MIME and size back from storage.objects, which only the
// Storage API writes. Everything here can be bypassed by a determined client
// and none of it is trusted downstream — it exists so a seller on 4G uploads
// 200 KB instead of 5 MB, and so their GPS coordinates never leave the phone.
//
// EXIF removal is a property of the re-encode, not a step: drawing a decoded
// bitmap onto a canvas and asking for WebP produces pixels and nothing else.
// There is no metadata to strip because none is carried across. The test
// asserts that on real bytes rather than trusting the sentence.
// ============================================================================

/** Mirrors shop_media_limits(). A parity test reads the SQL and compares. */
export const IMAGE_LIMITS = {
  maxInputBytes: 8 * 1024 * 1024,
  maxRenditionBytes: 1024 * 1024,
  maxDimension: 2048,
  maxPerProduct: 8,
  inputTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  /** Preferred. iOS Safari cannot encode WebP through canvas.toBlob. */
  renditionType: "image/webp",
  /** What iOS Safari gets instead. The server accepts both — the object key
   *  keeps its .webp suffix either way: extension is a claim; the MIME in
   *  storage.objects is the truth. */
  renditionFallbackType: "image/jpeg",
} as const;

export type SniffedType = "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "unknown";

/**
 * What the bytes actually are.
 *
 * An extension is a claim and a File.type is the OS repeating that claim, so
 * neither is evidence. This reads the signature — which matters most for the
 * case it is really here for: an iPhone photo named .jpg that is HEIC inside,
 * where trusting the name means uploading something the server will reject
 * after the seller has already waited for it.
 */
export function sniffImageType(head: Uint8Array): SniffedType {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (
    head.length >= 8 &&
    head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 &&
    head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a
  ) {
    return "image/png";
  }
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...Array.from(head.slice(from, to)));
  if (head.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  // ISO-BMFF: `....ftyp<brand>`. heic/heix/hevc/mif1/msf1 are the ones a phone
  // produces; they all fail decode in most browsers, which is the point.
  if (head.length >= 12 && ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12).toLowerCase();
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heis"].includes(brand)) return "image/heic";
  }
  return "unknown";
}

export const readHead = async (file: Blob, bytes = 16): Promise<Uint8Array> =>
  new Uint8Array(await file.slice(0, bytes).arrayBuffer());

export class ImageRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageRejected";
  }
}

/**
 * HEIC.
 *
 * The server accepts JPEG, PNG and WebP as the ORIGINAL and nothing else
 * (P2a.2), and the original is kept precisely because it is the original —
 * uploading a converted file under that name would make the private copy a
 * different claim from the one it is stored to support. So even where a
 * browser can decode HEIC, this pipeline does not turn it into an upload; it
 * says so, in the seller's language, before anything is sent.
 *
 * That is the honest reading of "do not claim HEIC support you do not have".
 */
export const HEIC_MESSAGE =
  "Trình duyệt này chưa xử lý được ảnh HEIC. Hãy chọn ảnh JPEG, PNG hoặc WebP. " +
  "Trên iPhone: Cài đặt > Camera > Định dạng > Tương thích nhất.";

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  /** What the bytes turned out to be, after sniffing. */
  sourceType: SniffedType;
}

const bitmapFrom = async (file: Blob): Promise<ImageBitmap> => {
  // imageOrientation:'from-image' is what applies the EXIF rotation. Without
  // it a portrait phone photo arrives on its side and the seller sees a
  // sideways product they did not upload.
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageRejected("Không đọc được ảnh này — tệp có thể bị hỏng.");
  }
};

/** Longest edge capped, aspect ratio kept, and never enlarged: upscaling a
 *  small photo makes a bigger file that looks worse. */
export function targetSize(width: number, height: number, cap: number = IMAGE_LIMITS.maxDimension) {
  const longest = Math.max(width, height);
  if (longest <= cap) return { width, height };
  const scale = cap / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * One image, from a File to the rendition the server will verify.
 *
 * WebP first; a browser whose encoder hands back the wrong type (iOS Safari
 * returns PNG for a WebP request) gets the whole ladder again as JPEG. Quality
 * steps down until the result fits max_rendition_bytes rather than failing at
 * 1 KB over: a seller whose photo is 1.05 MB does not want to be told to go
 * and resize it themselves.
 */
export async function processImage(
  file: File | Blob,
  options: { signal?: AbortSignal; cap?: number } = {},
): Promise<ProcessedImage> {
  const { signal, cap = IMAGE_LIMITS.maxDimension as number } = options;
  const throwIfAborted = () => {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
  };

  if (file.size > IMAGE_LIMITS.maxInputBytes) {
    throw new ImageRejected(
      `Ảnh nặng ${(file.size / 1048576).toFixed(1)} MB, vượt quá ${IMAGE_LIMITS.maxInputBytes / 1048576} MB. Chụp lại ở chế độ thường thay vì HDR, hoặc chọn ảnh khác.`,
    );
  }

  const sourceType = sniffImageType(await readHead(file));
  throwIfAborted();
  if (sourceType === "image/heic") throw new ImageRejected(HEIC_MESSAGE);
  if (sourceType === "unknown") {
    throw new ImageRejected("Tệp này không phải ảnh JPEG, PNG hay WebP.");
  }

  const bitmap = await bitmapFrom(file);
  throwIfAborted();

  try {
    const { width, height } = targetSize(bitmap.width, bitmap.height, cap);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageRejected("Trình duyệt này không xử lý được ảnh.");
    ctx.drawImage(bitmap, 0, 0, width, height);

    // One encoder type per ladder, never mixed mid-ladder. Returns null when
    // the browser cannot produce that type at all (a null blob, or a blob of
    // some other type — iOS Safari answers a WebP request with PNG).
    const ladder = async (type: string): Promise<Blob | null> => {
      for (const quality of [0.82, 0.7, 0.6, 0.5]) {
        throwIfAborted();
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, type, quality),
        );
        if (!blob || blob.type !== type) return null;
        if (blob.size <= IMAGE_LIMITS.maxRenditionBytes) return blob;
      }
      throw new ImageRejected("Ảnh vẫn quá nặng sau khi nén. Chọn ảnh nhỏ hơn.");
    };

    const blob =
      (await ladder(IMAGE_LIMITS.renditionType)) ??
      // The full ladder again, from 0.82: the server verifies the JPEG on the
      // same size limits, and the object key keeps its .webp suffix.
      (await ladder(IMAGE_LIMITS.renditionFallbackType));
    if (!blob) {
      // A JPEG-capable browser never lands here; "thử trình duyệt khác" would
      // be the wrong advice now that JPEG is accepted end-to-end.
      throw new ImageRejected(
        "Trình duyệt này không nén được ảnh. Hãy thử cập nhật trình duyệt hoặc chọn ảnh khác.",
      );
    }
    return { blob, width, height, sourceType };
  } finally {
    // Big bitmaps are the thing that kills a phone tab. Released on every
    // path, including the throwing ones.
    bitmap.close?.();
  }
}

/**
 * Run tasks a few at a time.
 *
 * Eight 8 MB photos decoded at once is several hundred megabytes of bitmap,
 * which on a mid-range Android is a tab that disappears. Two at a time is slow
 * enough to survive and fast enough not to feel queued.
 */
export async function runQueue<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency = 2,
): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(lanes);
}

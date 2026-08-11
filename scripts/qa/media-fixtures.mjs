// ============================================================================
// Test images, built in code.
// ----------------------------------------------------------------------------
// No binary fixtures in the repo: nothing to license, nothing to explain, and
// nothing that quietly stops matching what it claims to be. Every byte here is
// constructed, so each file is exactly the shape the test is about.
// ============================================================================

/**
 * A minimal but REAL 1×1 JPEG.
 *
 * Produced once by a standard encoder and pinned as base64 because a browser
 * canvas cannot be asked for one before the browser exists — the QA script
 * needs the bytes to build its input file, not after.
 */
const TINY_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
  "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
  "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

export const tinyJpeg = () => Buffer.from(TINY_JPEG_B64, "base64");

/**
 * The same JPEG with an APP1 Exif segment carrying a GPS tag.
 *
 * An APP1 immediately after SOI is legal JPEG and every decoder accepts it, so
 * this is a real photo that really has location data in it — which is the only
 * kind of input that makes "the rendition has no GPS" a claim worth checking.
 *
 * Layout: SOI · APP1(len, "Exif\0\0", TIFF header, 1 IFD entry = GPS IFD
 * pointer, GPS IFD with GPSLatitudeRef) · the rest of the original file.
 */
export function jpegWithGps() {
  const base = tinyJpeg();

  const tiff = Buffer.alloc(0);
  const parts = [];
  // TIFF header, big-endian, first IFD at offset 8.
  parts.push(Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08]));
  // IFD0: one entry, GPSInfo (0x8825) → LONG → offset 26.
  parts.push(Buffer.from([0x00, 0x01]));
  parts.push(Buffer.from([0x88, 0x25, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x1a]));
  parts.push(Buffer.from([0x00, 0x00, 0x00, 0x00])); // next IFD: none
  // GPS IFD at 26: one entry, GPSLatitudeRef (0x0001) → ASCII "N\0".
  parts.push(Buffer.from([0x00, 0x01]));
  parts.push(Buffer.from([0x00, 0x01, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02, 0x4e, 0x00, 0x00, 0x00]));
  parts.push(Buffer.from([0x00, 0x00, 0x00, 0x00]));

  const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff, ...parts]);
  const length = payload.length + 2;
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1, (length >> 8) & 0xff, length & 0xff]),
    payload,
  ]);

  // SOI stays first; the APP1 goes straight after it.
  return Buffer.concat([base.subarray(0, 2), app1, base.subarray(2)]);
}

/** A file whose name and declared type say JPEG and whose bytes say HEIC. */
export function heicNamedJpg() {
  const body = Buffer.alloc(64);
  body.write("ftyp", 4, "latin1");
  body.write("heic", 8, "latin1");
  return body;
}

/** Bigger than the 8 MB input cap, with a valid JPEG signature. */
export function oversizedJpeg() {
  const body = Buffer.alloc(9 * 1024 * 1024);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(body, 0);
  return body;
}

/** Not an image at all, wearing a .png name. */
export const notAnImage = () => Buffer.from("%PDF-1.7\n%not a picture\n", "latin1");

/** Does this WebP carry any metadata chunk? RIFF chunks are four-character
 *  codes, so EXIF and XMP are findable by name without a parser. */
export function webpHasMetadata(buffer) {
  const text = buffer.toString("latin1");
  return text.includes("EXIF") || text.includes("XMP ") || text.includes("Exif\0\0");
}

export const isWebp = (buffer) =>
  buffer.length > 12 &&
  buffer.toString("latin1", 0, 4) === "RIFF" &&
  buffer.toString("latin1", 8, 12) === "WEBP";

/**
 * The fixtures, checked against themselves.
 *
 * "The rendition has no GPS" proves nothing if the input never had any, and a
 * fixture that quietly stops carrying EXIF turns a real assertion into a
 * vacuous one that still reports success. So the QA scripts call this first.
 */
export function assertFixturesAreWhatTheyClaim() {
  const problems = [];
  const gps = jpegWithGps();
  if (!(gps[0] === 0xff && gps[1] === 0xd8)) problems.push("jpegWithGps không bắt đầu bằng SOI");
  if (!webpHasMetadata(gps)) problems.push("jpegWithGps KHÔNG chứa EXIF — phép thử xoá GPS thành vô nghĩa");
  if (gps.length <= tinyJpeg().length) problems.push("jpegWithGps không lớn hơn ảnh gốc");

  const heic = heicNamedJpg();
  if (heic.toString("latin1", 4, 8) !== "ftyp") problems.push("heicNamedJpg không có chữ ký ftyp");
  if (oversizedJpeg().length <= 8 * 1024 * 1024) problems.push("oversizedJpeg không vượt 8 MB");
  if (webpHasMetadata(notAnImage())) problems.push("notAnImage lại chứa EXIF");
  return problems;
}

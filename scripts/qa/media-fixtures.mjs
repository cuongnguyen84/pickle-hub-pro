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

/**
 * Splice a full metadata payload into a REAL JPEG: EXIF with an Orientation
 * tag and a GPS IFD, plus a separate APP1 XMP packet.
 *
 * `jpegWithGps()` above is enough to prove "the rendition has no EXIF" on a
 * 1×1 image. It cannot prove the rendition is the right way up, because a 1×1
 * image has no orientation to lose, and it says nothing about XMP — which
 * carries location too and is a separate chunk in both containers.
 *
 * So this takes a base JPEG that has actual pixels (built by a browser canvas
 * at run time, so no binary fixture enters the repository) and gives it
 * everything a phone photo would arrive with.
 *
 * @param base       a real JPEG, SOI first
 * @param orientation EXIF Orientation. 6 = rotate 90° CW on display, which is
 *                    what a phone writes when you hold it upright.
 */
export function jpegWithExifGpsXmp(base, orientation = 6) {
  if (!(base[0] === 0xff && base[1] === 0xd8)) {
    throw new Error("base is not a JPEG — no SOI");
  }

  // ── APP1 #1: Exif ────────────────────────────────────────────────────────
  // Big-endian TIFF. IFD0 holds two entries (Orientation, GPSInfo pointer)
  // and the GPS IFD follows it.
  const IFD0_AT = 8;
  const IFD0_SIZE = 2 + 12 * 2 + 4;          // count + 2 entries + next-IFD
  const GPS_AT = IFD0_AT + IFD0_SIZE;        // 38

  const tiff = Buffer.concat([
    Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, IFD0_AT]),
    // IFD0: 2 entries
    Buffer.from([0x00, 0x02]),
    // 0x0112 Orientation · SHORT · count 1 · value in the high half-word
    Buffer.from([0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00]),
    // 0x8825 GPSInfo · LONG · count 1 · offset of the GPS IFD
    Buffer.from([0x88, 0x25, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, GPS_AT]),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),   // no next IFD
    // GPS IFD: one entry, GPSLatitudeRef = "N"
    Buffer.from([0x00, 0x01]),
    Buffer.from([0x00, 0x01, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02, 0x4e, 0x00, 0x00, 0x00]),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
  ]);

  const exifPayload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const exifLen = exifPayload.length + 2;
  const exifApp1 = Buffer.concat([
    Buffer.from([0xff, 0xe1, (exifLen >> 8) & 0xff, exifLen & 0xff]),
    exifPayload,
  ]);

  // ── APP1 #2: XMP ─────────────────────────────────────────────────────────
  const xmpPacket =
    `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>` +
    `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF ` +
    `xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
    `<rdf:Description exif:GPSLatitude="21,1.5N" exif:GPSLongitude="105,50.7E" ` +
    `xmlns:exif="http://ns.adobe.com/exif/1.0/"/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
  const xmpPayload = Buffer.concat([
    Buffer.from("http://ns.adobe.com/xap/1.0/\0", "latin1"),
    Buffer.from(xmpPacket, "latin1"),
  ]);
  const xmpLen = xmpPayload.length + 2;
  const xmpApp1 = Buffer.concat([
    Buffer.from([0xff, 0xe1, (xmpLen >> 8) & 0xff, xmpLen & 0xff]),
    xmpPayload,
  ]);

  return Buffer.concat([base.subarray(0, 2), exifApp1, xmpApp1, base.subarray(2)]);
}

/** Does this buffer carry an XMP packet, by either of its two signatures? */
export const hasXmp = (buffer) => {
  const text = buffer.toString("latin1");
  return text.includes("http://ns.adobe.com/xap/1.0/") || text.includes("<x:xmpmeta");
};

/** Does this buffer carry an Exif header or a GPS IFD tag? */
export const hasExif = (buffer) => buffer.toString("latin1").includes("Exif\0\0");

/** The GPS values our fixture writes, looked for verbatim in the output. */
export const hasFixtureGps = (buffer) => {
  const text = buffer.toString("latin1");
  return text.includes("GPSLatitude") || text.includes("21,1.5N") || text.includes("105,50.7E");
};

/**
 * The fixture, checked against itself before anything is concluded from it.
 * "The rendition has no XMP" proves nothing if the input never had any.
 */
export function assertPhotoFixtureIsReal(buffer) {
  const problems = [];
  if (!(buffer[0] === 0xff && buffer[1] === 0xd8)) problems.push("không phải JPEG (thiếu SOI)");
  if (!hasExif(buffer)) problems.push("KHÔNG chứa EXIF — phép thử xoá EXIF thành vô nghĩa");
  if (!hasXmp(buffer)) problems.push("KHÔNG chứa XMP — phép thử xoá XMP thành vô nghĩa");
  if (!hasFixtureGps(buffer)) problems.push("KHÔNG chứa toạ độ GPS");
  return problems;
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

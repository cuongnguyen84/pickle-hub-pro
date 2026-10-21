// Build a real JPEG that carries EXIF with GPS coordinates.
//
// Case 13 is about a photo taken on a phone: it has the location of the seller's
// home in it, and the buyer must never receive that. A JPEG produced by canvas
// has no EXIF at all, so it would prove nothing — the pipeline would "strip"
// something that was never there.
//
// So: render pixels in the browser to get a valid JPEG, then splice an APP1
// EXIF segment in after SOI. The GPS values are deliberately recognisable
// (48.8584 N, 2.2945 E — the Eiffel Tower) so the leakage scan can search for
// them as numbers and as rationals.
import { chromium } from "@playwright/test";

export const GPS = { latDeg: 48, latMin: 51, latSec: 30.12, lonDeg: 2, lonMin: 17, lonSec: 40.2 };
/**
 * ASCII strings we plant in EXIF. Searched for as literal bytes after the
 * pipeline has run — the GPS numbers themselves are binary rationals and are
 * checked separately by `hasGpsIfd`.
 */
export const EXIF_MARKERS = ["CP27FixtureCamera", "ThePickleHub CP27 secret caption"];

function u16(n) { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; }
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; }

/** One IFD entry: tag, type, count, value-or-offset. */
function entry(tag, type, count, valueBuf) {
  return Buffer.concat([u16(tag), u16(type), u32(count), valueBuf]);
}

function rational(num, den) { return Buffer.concat([u32(num), u32(den)]); }

/**
 * A minimal but valid big-endian TIFF header with an IFD0 (Make + a caption),
 * and a GPS IFD holding latitude and longitude.
 */
function buildExif() {
  const make = Buffer.from("CP27FixtureCamera\0", "ascii");
  const caption = Buffer.from("ThePickleHub CP27 secret caption\0", "ascii");

  // Layout: header(8) | IFD0 | IFD0 data | GPS IFD | GPS data
  const ifd0Count = 3; // Make, ImageDescription, GPSInfoIFDPointer
  const ifd0Size = 2 + ifd0Count * 12 + 4;
  const ifd0DataOffset = 8 + ifd0Size;
  const makeOffset = ifd0DataOffset;
  const captionOffset = makeOffset + make.length;
  const gpsIfdOffset = captionOffset + caption.length;

  const gpsCount = 4; // LatRef, Lat, LonRef, Lon
  const gpsSize = 2 + gpsCount * 12 + 4;
  const gpsDataOffset = gpsIfdOffset + gpsSize;
  const latOffset = gpsDataOffset;
  const lonOffset = latOffset + 24;

  const lat = Buffer.concat([
    rational(GPS.latDeg, 1), rational(GPS.latMin, 1), rational(Math.round(GPS.latSec * 100), 100),
  ]);
  const lon = Buffer.concat([
    rational(GPS.lonDeg, 1), rational(GPS.lonMin, 1), rational(Math.round(GPS.lonSec * 100), 100),
  ]);

  const ifd0 = Buffer.concat([
    u16(ifd0Count),
    entry(0x010f, 2, make.length, u32(makeOffset)),        // Make
    entry(0x010e, 2, caption.length, u32(captionOffset)),  // ImageDescription
    entry(0x8825, 4, 1, u32(gpsIfdOffset)),                // GPSInfoIFDPointer
    u32(0),
  ]);

  const gpsIfd = Buffer.concat([
    u16(gpsCount),
    entry(0x0001, 2, 2, Buffer.concat([Buffer.from("N\0", "ascii"), Buffer.alloc(2)])),
    entry(0x0002, 5, 3, u32(latOffset)),
    entry(0x0003, 2, 2, Buffer.concat([Buffer.from("E\0", "ascii"), Buffer.alloc(2)])),
    entry(0x0004, 5, 3, u32(lonOffset)),
    u32(0),
  ]);

  const tiff = Buffer.concat([
    Buffer.from("MM", "ascii"), u16(42), u32(8), // big-endian, magic, IFD0 at 8
    ifd0, make, caption, gpsIfd, lat, lon,
  ]);

  const payload = Buffer.concat([Buffer.from("Exif\0\0", "ascii"), tiff]);
  return Buffer.concat([Buffer.from([0xff, 0xe1]), u16(payload.length + 2), payload]);
}

/** A JPEG with real pixels and real EXIF/GPS. */
export async function makeExifJpeg({ width = 1400, height = 1000 } = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const dataUrl = await page.evaluate(
    ([w, h]) => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const g = c.getContext("2d");
      const grad = g.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#0f766e"); grad.addColorStop(1, "#f59e0b");
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      g.fillStyle = "#fff"; g.font = "bold 72px sans-serif";
      g.fillText("CP27", 60, 140);
      return c.toDataURL("image/jpeg", 0.92);
    },
    [width, height],
  );
  await browser.close();

  const raw = Buffer.from(dataUrl.split(",")[1], "base64");
  if (raw[0] !== 0xff || raw[1] !== 0xd8) throw new Error("canvas did not produce a JPEG");
  return Buffer.concat([raw.subarray(0, 2), buildExif(), raw.subarray(2)]);
}

/** Which of the planted EXIF strings are still in these bytes. */
export function stillHasExif(buf) {
  const s = buf.toString("latin1");
  return EXIF_MARKERS.filter((m) => s.includes(m));
}

/**
 * The GPS coordinates as they appear on the wire: six big-endian rationals.
 * Checked as bytes because the numbers never appear as text, and a rendition
 * that merely dropped the ASCII tags while keeping the GPS IFD would pass a
 * string search.
 */
export function hasGpsIfd(buf) {
  const gps = Buffer.concat([
    u32(GPS.latDeg), u32(1), u32(GPS.latMin), u32(1), u32(Math.round(GPS.latSec * 100)), u32(100),
  ]);
  return buf.includes(gps) || buf.includes(Buffer.from("Exif\0\0", "ascii"));
}

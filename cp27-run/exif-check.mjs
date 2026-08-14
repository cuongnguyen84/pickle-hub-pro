import { makeExifJpeg, stillHasExif, EXIF_MARKERS } from "./exif-jpeg.mjs";
import { writeFileSync } from "node:fs";
const buf = await makeExifJpeg();
writeFileSync("/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/exif-fixture.jpg", buf);
console.log("bytes:", buf.length);
console.log("APP1 present:", buf[2] === 0xff && buf[3] === 0xe1);
console.log("markers found:", stillHasExif(buf), "of", EXIF_MARKERS.length);

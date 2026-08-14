import { readFileSync } from "node:fs";
import { stillHasExif, hasGpsIfd } from "./exif-jpeg.mjs";
const buf = readFileSync("/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/exif-fixture.jpg");
console.log("fixture  ascii markers:", stillHasExif(buf), "| gps ifd:", hasGpsIfd(buf));
const clean = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3]);
console.log("clean    ascii markers:", stillHasExif(clean), "| gps ifd:", hasGpsIfd(clean));

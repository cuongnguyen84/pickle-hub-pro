import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as src from "../ppa-rankings";

// Native iOS ships the same WPR excerpt as a bundled JSON. If this fails, run
// `node scripts/gen-native-wpr.mjs` and commit the regenerated file.
describe("wpr-rankings.json (native) mirrors src/content/ppa-rankings.ts", () => {
  it("is byte-for-byte what the generator produces from the TS constants", async () => {
    // @ts-expect-error plain .mjs script (no declaration file); shape checked by the assertions below
    const { buildNativeWpr } = await import("../../../scripts/gen-native-wpr.mjs");
    const file = path.resolve(__dirname, "../../../apple/ThePickleHub/Resources/wpr-rankings.json");
    const onDisk = JSON.parse(readFileSync(file, "utf8"));
    expect(onDisk).toEqual(buildNativeWpr(src));
    expect(onDisk.men).toHaveLength(25);
    expect(onDisk.women).toHaveLength(25);
  });
});

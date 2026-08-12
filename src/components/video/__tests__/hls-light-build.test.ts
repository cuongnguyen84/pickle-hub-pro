// ============================================================================
// hls.js light build — capability contract.
// ----------------------------------------------------------------------------
// `vite.config.ts` aliases `hls.js` to its LIGHT dist build. That is 53 KB gz
// of the total bundle, and it is only safe because this product uses none of
// what the light build leaves out.
//
// ── CAPABILITIES THIS PLAYER DOES NOT HAVE ─────────────────────────────────
//
//   subtitles / captions ....... WebVTT, CEA-608, CEA-708. No caption track is
//                                parsed, rendered or offered.
//   alternate audio ............ no alt-audio track selection.
//   EME / DRM .................. no Widevine, PlayReady or FairPlay. Mux
//                                `playback_policy: "signed"` is a JWT on the
//                                URL and still works; actual DRM does not.
//   CMCD ....................... no Common Media Client Data on segment
//                                requests. Mux Data analytics is unaffected —
//                                it rides on mux-embed.
//   advertising / interstitials  no HLS interstitial or ad-insertion support.
//
// The failure mode is SILENT, which is the whole reason this file exists: the
// light build keeps `hls.subtitleTracks`, `hls.audioTracks` and friends and
// simply reports nothing. A future feature that switches captions or DRM on
// would look correctly wired and play without them, and the first report would
// come from a viewer.
//
// So the contract is enforced from both ends:
//
//   1. the alias is pinned, so nobody silently returns to the full build
//      without noticing it costs 53 KB;
//   2. any configuration that implies one of the capabilities above fails this
//      test, forcing the trade to be re-decided in the open.
//
// If you are here because this test went red: you are adding something the
// current player cannot do. Either drop the capability, or drop the alias and
// pay the 53 KB back out of the bundle budget in the same change. Do not
// delete the assertion.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const viteConfig = readFileSync("vite.config.ts", "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p) && !p.includes("__tests__")) out.push(p);
  }
  return out;
}

// One row per capability the light build drops. `markers` are the things that
// only appear when somebody is actually turning that capability on — Mux asset
// configuration, hls.js config keys, or the player attributes that expose it.
const UNSUPPORTED: { capability: string; markers: RegExp[] }[] = [
  {
    capability: "subtitles / captions (WebVTT, CEA-608, CEA-708)",
    markers: [/generated_subtitles/, /enableWebVTT/, /enableCEA708Captions/, /subtitleTrackController/],
  },
  {
    capability: "alternate audio tracks",
    markers: [/audioTrackController/],
  },
  {
    capability: "EME / DRM (Widevine, PlayReady, FairPlay)",
    markers: [/\bdrm_configuration\b/, /\bemeEnabled\b/, /\bdrmSystems\b/, /\bemeController\b/, /widevineLicenseUrl/],
  },
  {
    capability: "CMCD",
    markers: [/cmcdController/, /\bcmcd\s*:/],
  },
  {
    capability: "advertising / HLS interstitials",
    markers: [/interstitialsController/, /mux-data-google-ima/, /\bgoogle-ima\b/],
  },
];

describe("hls.js light build", () => {
  it("is the build every importer resolves to", () => {
    // Aliasing here rather than only at our own import site is the point:
    // @mux/playback-core imports "hls.js" by bare specifier, and it is the
    // only importer left in the graph.
    expect(viteConfig).toMatch(/"hls\.js":\s*path\.resolve\([^)]*hls\.light\.mjs"\)/);
  });

  it.each(UNSUPPORTED)("has nothing that needs $capability", ({ markers }) => {
    // Player surfaces live in src/; Mux asset and livestream configuration
    // lives in the edge functions. Either one enabling a capability is enough
    // to make the light build the wrong choice, so both are searched.
    const files = [...walk("src"), ...walk("supabase/functions")];
    const hits: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const re of markers) if (re.test(src)) hits.push(`${f} matches ${re}`);
    }
    expect(hits).toEqual([]);
  });
});

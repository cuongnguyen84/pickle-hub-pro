// ============================================================================
// hls.js light build — guard.
// ----------------------------------------------------------------------------
// `vite.config.ts` aliases `hls.js` to its LIGHT dist build. That is 53 KB gz
// of the total bundle, and it is only safe because the light build drops
// exactly the features this product does not use:
//
//   subtitles / WebVTT / CEA-608-708 captions .. no caption UI, no Mux
//                                                transcription configured
//   alternate audio tracks ..................... single-track match video
//   EME / DRM (emeController) .................. mux-create-livestream sets
//                                                playback_policy public|signed;
//                                                "signed" is a JWT on the URL,
//                                                NOT Widevine/FairPlay. There is
//                                                no drm_configuration anywhere.
//   CMCD ....................................... Mux Data analytics rides on
//                                                mux-embed, not hls's CMCD
//   interstitials (ads) ........................ no ad product
//
// The dangerous failure mode is silent: the light build keeps the accessors
// (`hls.subtitleTracks` etc.) and simply reports nothing, so enabling captions
// or DRM later would look wired-up and play without them. This test fails the
// moment somebody adds either, so the byte saving has to be re-decided in the
// open rather than discovered by a viewer.
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

describe("hls.js light build", () => {
  it("is the build every importer resolves to", () => {
    expect(viteConfig).toMatch(/"hls\.js":\s*path\.resolve\([^)]*hls\.light\.mjs"\)/);
  });

  it("has no caption or DRM configuration that the light build would silently drop", () => {
    // Mux asset/livestream configuration lives in the edge functions; the
    // player surfaces live in src/. Both are searched, because either one
    // turning captions or DRM on is enough to make the light build wrong.
    const files = [...walk("src"), ...walk("supabase/functions")];
    const banned = [
      /generated_subtitles/,
      /\bdrm_configuration\b/,
      /\bemeEnabled\b/,
      /\bdrmSystems\b/,
      /enableWebVTT/,
      /enableCEA708Captions/,
    ];
    const hits: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const re of banned) if (re.test(src)) hits.push(`${f} matches ${re}`);
    }
    expect(hits).toEqual([]);
  });
});

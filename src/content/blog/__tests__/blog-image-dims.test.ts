// ============================================================================
// The generated dimension map (image-dims.ts) must match the files on disk.
// ----------------------------------------------------------------------------
// Both blog hero surfaces — the SPA (<img width height>) and the SSR bot path
// added for audit item H1 — declare their aspect ratio from this map. A stale
// entry means the browser reserves the wrong box and the article shifts when
// the hero decodes, which is the exact CLS class the 2026-08-25 audit found.
//
// Fix a failure with:  node scripts/gen-blog-image-dims.mjs
// ============================================================================

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BLOG_IMAGE_DIMS, blogImageDims } from "../image-dims";
import { blogMetadata } from "../metadata";
import { webpSize } from "../../../../scripts/gen-blog-image-dims.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = resolve(here, "..", "..", "..", "..", "public", "images", "blog");
const files = readdirSync(IMAGES_DIR).filter((f) => !f.startsWith("."));

describe("blog image dimension map", () => {
  it("covers every file in public/images/blog", () => {
    const missing = files.filter((f) => !(`/images/blog/${f}` in BLOG_IMAGE_DIMS));
    expect(missing, `run scripts/gen-blog-image-dims.mjs — missing:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("has no entries whose file is gone", () => {
    const stale = Object.keys(BLOG_IMAGE_DIMS).filter(
      (k) => !files.includes(k.replace("/images/blog/", "")),
    );
    expect(stale, `run scripts/gen-blog-image-dims.mjs — stale:\n  ${stale.join("\n  ")}`).toEqual([]);
  });

  it("records the real intrinsic size of each file", () => {
    const wrong = files.filter((f) => {
      const [w, h] = webpSize(readFileSync(resolve(IMAGES_DIR, f)), f);
      const got = BLOG_IMAGE_DIMS[`/images/blog/${f}`];
      return !got || got[0] !== w || got[1] !== h;
    });
    expect(wrong, `dimensions drifted:\n  ${wrong.join("\n  ")}`).toEqual([]);
  });

  it("resolves a size for every post hero — no post falls back to a guessed ratio", () => {
    const unresolved = blogMetadata
      .filter((m) => m.heroImage?.src && !blogImageDims(m.heroImage.src))
      .map((m) => `${m.slug} → ${m.heroImage?.src}`);
    expect(unresolved, `heroes with no dimensions:\n  ${unresolved.join("\n  ")}`).toEqual([]);
  });

  it("strips an absolute origin and a cache-busting query before lookup", () => {
    const [path, dims] = Object.entries(BLOG_IMAGE_DIMS)[0];
    expect(blogImageDims(`https://www.thepicklehub.net${path}?v=3`)).toEqual(dims);
    expect(blogImageDims("/images/blog/does-not-exist.webp")).toBeUndefined();
    expect(blogImageDims(null)).toBeUndefined();
  });
});

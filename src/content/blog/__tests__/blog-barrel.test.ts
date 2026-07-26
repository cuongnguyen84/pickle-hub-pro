// ============================================================================
// The static barrel (posts/all.ts) must list every post module.
// ----------------------------------------------------------------------------
// The SSR bot path renders post bodies through this barrel because Cloudflare
// Pages Functions cannot use Vite's import.meta.glob. A post missing from the
// barrel renders for humans but serves Googlebot an empty <article> — a silent
// regression of exactly the bug the barrel was added to fix.
//
// Fix a failure with:  node scripts/gen-blog-barrel.mjs
// ============================================================================

import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { blogPostLoaders, loadBlogPost } from "../posts/all";
import { blogMetadata } from "../metadata";

const here = dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = resolve(here, "..", "posts");

const fileSlugs = readdirSync(POSTS_DIR)
  .filter((f) => f.endsWith(".ts") && f !== "all.ts")
  .map((f) => f.replace(/\.ts$/, ""))
  .sort();

describe("blog post barrel (posts/all.ts)", () => {
  it("lists every post file — run scripts/gen-blog-barrel.mjs after adding a post", () => {
    const missing = fileSlugs.filter((s) => !(s in blogPostLoaders));
    expect(missing, `posts missing from all.ts:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("has no entries whose post file is gone", () => {
    const stale = Object.keys(blogPostLoaders).filter((s) => !fileSlugs.includes(s));
    expect(stale, `stale all.ts entries:\n  ${stale.join("\n  ")}`).toEqual([]);
  });

  it("every published post resolves to EN content the bot renderer can emit", async () => {
    const loaded = await Promise.all(
      blogMetadata.map(async (m) => [m.slug, await loadBlogPost(m.slug)] as const),
    );
    const empty = loaded
      .filter(([, post]) => !post?.content.en.sections?.length)
      .map(([slug]) => slug);
    expect(
      empty,
      `published posts whose EN body would render empty for Googlebot:\n  ${empty.join("\n  ")}`,
    ).toEqual([]);
  });

  it("each entry's declared slug matches its barrel key", async () => {
    const entries = await Promise.all(
      Object.keys(blogPostLoaders).map(async (key) => [key, await loadBlogPost(key)] as const),
    );
    const mismatched = entries
      .filter(([key, post]) => post?.slug !== key)
      .map(([key, post]) => `${key} → post.slug = ${post?.slug}`);
    expect(mismatched, `slug mismatches:\n  ${mismatched.join("\n  ")}`).toEqual([]);
  });
});

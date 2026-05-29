// ============================================================================
// Phase 3B — Blog "4-file sync" guard.
// ----------------------------------------------------------------------------
// CLAUDE.md's #1 recurring trap: a new blog post needs simultaneous changes in
// several places or bots 404 even though the SPA renders fine. This test
// statically enforces the source-of-truth files so a missing entry fails CI
// instead of shipping a bot-404:
//
//   1. src/content/blog/posts/<slug>.ts   — the full post (SPA route)
//   2. src/content/blog/metadata.ts       — blogMetadata[] (list pages)
//   3. functions/_lib/render/index.ts     — BLOG_POST_META dict (bot SSR)
//
// The 4th leg (Supabase vi_blog_posts for the /vi/blog twin) lives in the DB
// and can't be checked statically — verify it manually per the checklist.
//
// Invariant: every PUBLISHED post (in blogMetadata) MUST have a post file AND
// a BLOG_POST_META entry. Post files not in metadata are treated as drafts
// (warning only, not a failure).
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { blogMetadata } from "../metadata";

const here = dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = resolve(here, "..", "posts");
const RENDER_INDEX = resolve(here, "..", "..", "..", "..", "functions", "_lib", "render", "index.ts");

/** Slugs that have a posts/<slug>.ts file. */
function postFileSlugs(): string[] {
  return readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "types.ts")
    .map((f) => f.replace(/\.ts$/, ""));
}

/** Top-level keys of the BLOG_POST_META dict in the SSR renderer. */
function blogPostMetaSlugs(): string[] {
  const src = readFileSync(RENDER_INDEX, "utf8");
  const start = src.indexOf("const BLOG_POST_META");
  expect(start, "BLOG_POST_META declaration found in render/index.ts").toBeGreaterThan(-1);
  // The data object opens at the first `}> = {` after the type declaration.
  const objOpen = src.indexOf("}> = {", start);
  const body = src.slice(objOpen, src.indexOf("\n};", objOpen));
  const slugs = new Set<string>();
  // Each entry is a 2-space-indented quoted key: `  "slug": { ... },`
  const re = /^\s{2}"([a-z0-9-]+)":\s*\{/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) slugs.add(m[1]);
  return [...slugs];
}

describe("blog 4-file sync guard", () => {
  const metaSlugs = blogMetadata.map((m) => m.slug);
  const fileSlugs = postFileSlugs();
  const renderSlugs = blogPostMetaSlugs();

  it("blogMetadata has no duplicate slugs", () => {
    const dupes = metaSlugs.filter((s, i) => metaSlugs.indexOf(s) !== i);
    expect(dupes, `duplicate slugs in metadata: ${dupes.join(", ")}`).toEqual([]);
  });

  it("sanity: BLOG_POST_META parsed at least one slug", () => {
    expect(renderSlugs.length).toBeGreaterThan(0);
  });

  it("every published post has a posts/<slug>.ts file", () => {
    const missing = metaSlugs.filter((s) => !fileSlugs.includes(s));
    expect(
      missing,
      `metadata slugs with no posts/<slug>.ts (SPA 404):\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
  });

  it("every published post has a BLOG_POST_META entry (bot-404 guard)", () => {
    const missing = metaSlugs.filter((s) => !renderSlugs.includes(s));
    expect(
      missing,
      `metadata slugs missing from BLOG_POST_META — Googlebot/Bingbot will 404:\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
  });

  it("every BLOG_POST_META entry has a matching post file", () => {
    const orphan = renderSlugs.filter((s) => !fileSlugs.includes(s));
    expect(
      orphan,
      `BLOG_POST_META slugs with no posts/<slug>.ts:\n  ${orphan.join("\n  ")}`,
    ).toEqual([]);
  });

  it("reports draft post files not yet published in metadata (warning only)", () => {
    const drafts = fileSlugs.filter((s) => !metaSlugs.includes(s));
    if (drafts.length) {
      // Not a failure — these are unpublished drafts. Surfaced for awareness.
      console.warn(
        `[blog-sync] ${drafts.length} post file(s) not in blogMetadata (drafts?): ${drafts.join(", ")}`,
      );
    }
    expect(true).toBe(true);
  });
});

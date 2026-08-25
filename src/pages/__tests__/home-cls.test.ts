import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const source = (p: string) => readFileSync(resolve(root, p), "utf8");

/**
 * Field CLS on this origin was p75 0.35 on mobile with 31.4% of visits poor
 * (CrUX, window ending 2026-08-22). A PageSpeed run the same day split the
 * blame by locale: the EN home page scored 0.015 while /vi scored 0.419, so
 * every remaining point was Vietnamese-only. A throttled Chrome trace of
 * production /vi found exactly two causes, and these tests guard both.
 *
 * Neither is reproducible on a local preview build — the trace against
 * localhost scores 0.0000 with or without the fixes, because both depend on
 * production timing (a slow Supabase round trip, and a font arriving after
 * first paint on a real 3G/4G connection). Source assertions are therefore
 * the only regression signal available here; re-measure on production with
 * PageSpeed after deploying, not on a preview.
 */
describe("VI home page holds its geometry", () => {
  it("the editorial slot cannot collapse while the VI query is unresolved", () => {
    const index = source("src/pages/Index.tsx");

    // The trace: <section class="tl-section"> went h 369 -> 0 (dropped out of
    // layout entirely) and was reinserted 20ms later at y 755 — one 0.208
    // shift, the largest single entry on the page. It happened because the
    // slot fell through to `null` in the window where the query had stopped
    // loading but `viPosts` was still [].
    expect(index).toContain("isFetched: viPostsSettled");
    expect(index).toContain(
      'language === "vi" && (viPostsLoading || !viPostsSettled)',
    );

    // isLoading alone is the regression: it only covers the first in-flight
    // fetch, so it is false during the gap the shift lived in.
    expect(index).not.toContain('language === "vi" && viPostsLoading ?');
  });

  it("the editorial skeleton and the loaded section stay structurally paired", () => {
    const index = source("src/pages/Index.tsx");
    // Measured 2026-08-25 at 390px: skeleton 1203px vs loaded 1184px. The 19px
    // gap is carried by the third placeholder, which offsets the loaded
    // section's CTA button and its variable-length real titles. Dropping to
    // two placeholders reopens a 324px gap (measured 2026-08-09).
    expect(index).toContain("tl-editorial-skeleton");
    expect(index).toContain("Array.from({ length: 3 }");
  });
});

describe("fonts that shift text are preloaded", () => {
  it("preloads the Inter Vietnamese subset", () => {
    const html = source("index.html");

    // Inter is the base body stack (html{} in the critical CSS, body{} in
    // index.css), so .tl-story-summary and every unstyled run of copy render
    // in it. Lighthouse attributed a 0.214 shift on main.shell-content to
    // "Web font loaded" for this file. It is font-display:swap and 10 KB.
    expect(html).toMatch(
      /<link rel="preload" as="font" type="font\/woff2" crossorigin\s+href="\/fonts\/inter-vietnamese\.woff2"/,
    );
  });

  it("every preloaded subset is one the page can actually shift on", () => {
    const html = source("index.html");
    const preloaded = [...html.matchAll(/href="\/fonts\/([a-z0-9-]+)\.woff2"/g)].map(
      (m) => m[1],
    );

    // inter-latin is deliberately NOT preloaded: it is font-display:optional,
    // which never swaps, which is why the EN home page measured 0.015. It is
    // also 47 KB — the largest font in the set — and LCP has ~15ms of headroom
    // against the 2.5s threshold, so it must not enter the critical path.
    // If it is ever moved off `optional`, preload it and update this test.
    expect(preloaded).not.toContain("inter-latin");
    expect(html).toMatch(
      /font-display:optional;src:url\("\/fonts\/inter-latin\.woff2"\)/,
    );

    // Geist ships both subsets as swap, so both must stay preloaded.
    expect(preloaded).toContain("geist-latin");
    expect(preloaded).toContain("geist-vietnamese");
  });
});

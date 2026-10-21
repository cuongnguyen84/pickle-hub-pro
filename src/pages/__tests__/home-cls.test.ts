import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const source = (p: string) => readFileSync(resolve(root, p), "utf8");

/**
 * Field CLS on this origin was p75 0.35 on mobile with 31.4% of visits poor
 * (CrUX, window ending 2026-08-22). PageSpeed split the blame by locale and it
 * is not site-wide: the EN home page scored 0.015, /vi scored 0.419.
 *
 * A throttled Chrome trace of production /vi (390x844, 4x CPU, 1.6Mbps) put
 * essentially all of the measurable shift in one entry, and a DOM snapshot
 * either side of it named the cause:
 *
 *     before   157  h= 319  SECTION.tl-live-sec          <- skeleton
 *              475  h=1184  SECTION.tl-section           <- editorial
 *     after    157  h= 598  SECTION.tl-live-sec          <- resolved, +279px
 *              755  h=1184  SECTION.tl-section           <- unchanged, pushed
 *
 * The live skeleton under-reserved by 279px and everything below it moved.
 * (The layout-shift API reports viewport-clipped rects, which made the
 * editorial section look like it collapsed to h=0 — it never did.)
 */
describe("the live slot reserves the geometry it resolves to", () => {
  const live = source("src/components/home/LiveSection.tsx");

  it("the skeleton mirrors every box that carries height in a loaded section", () => {
    // Measured 2026-08-25 at 390px — loaded: head 44, main 354 (thumb 223 +
    // body 130), list 85. The old skeleton had only a bare head and one media
    // box, so it missed the "see all" link, the whole main body, and the
    // schedule list.
    for (const cls of [
      "tl-live-all", // head grows to 44px only with this link present
      "tl-live-main-thumb", // 16/10 — NOT tl-live-main-media, which is 16/9
      "tl-live-main-body",
      "tl-live-list",
      "tl-live-row",
    ]) {
      expect(live).toContain(cls);
    }
  });

  it("the skeleton uses the loaded thumb class, not the 16/9 media box", () => {
    // .tl-live-main-media is aspect-ratio 16/9 and belongs to the inline
    // player; a loaded card's still uses .tl-live-main-thumb at 16/10. Using
    // the wrong one made even the reserved part the wrong height.
    const skeleton = live.slice(
      live.indexOf("export function LiveSectionSkeleton"),
      live.indexOf("export function LiveSection("),
    );
    expect(skeleton).toContain("tl-live-main-thumb");
    expect(skeleton).not.toContain("tl-live-main-media");
  });

  it("the skeleton sets no heights of its own", () => {
    const skeleton = live.slice(
      live.indexOf("export function LiveSectionSkeleton"),
      live.indexOf("export function LiveSection("),
    );
    // Height must come from the same CSS that lays out the loaded section, so
    // it cannot drift when the section is restyled. Same rule the /news and
    // /san skeletons follow — see hub-list-cls.test.ts.
    expect(skeleton).not.toMatch(/height\s*:/i);
    expect(skeleton).not.toMatch(/minHeight/);
    expect(skeleton).not.toMatch(/aspectRatio/);
  });
});

describe("fonts that shift text are preloaded", () => {
  const html = source("index.html");

  it("preloads the Inter Vietnamese subset", () => {
    // Lighthouse attributes a 0.214 shift on main.shell-content to "Web font
    // loaded" for this file. Inter is the real body stack (html{} in the
    // critical CSS, body{} in index.css), it is font-display:swap, and it was
    // never preloaded while the budget went to Geist.
    //
    // Unlike the live-slot fix above, this one is NOT reproducible in a trace
    // from a Mac: the macOS fallback happens to match Inter's metrics closely
    // enough that no shift occurs, where a real Android device's Roboto does
    // not. It rests on Lighthouse's attribution, not on a local measurement.
    expect(html).toMatch(
      /<link rel="preload" as="font" type="font\/woff2" crossorigin\s+href="\/fonts\/inter-vietnamese\.woff2"/,
    );
  });

  it("every preloaded subset is one the page can actually shift on", () => {
    const preloaded = [...html.matchAll(/href="\/fonts\/([a-z0-9-]+)\.woff2"/g)].map(
      (m) => m[1],
    );

    // inter-latin is deliberately NOT preloaded: font-display:optional never
    // swaps, which is exactly why the EN page measured 0.015. It is also 47 KB
    // — the largest font in the set — and LCP has ~15ms of headroom against
    // the 2.5s threshold, so it must not enter the critical path. If it is
    // ever moved off `optional`, preload it and update this test.
    expect(preloaded).not.toContain("inter-latin");
    expect(html).toMatch(
      /font-display:optional;src:url\("\/fonts\/inter-latin\.woff2"\)/,
    );

    // Geist ships both subsets as swap, so both must stay preloaded.
    expect(preloaded).toContain("geist-latin");
    expect(preloaded).toContain("geist-vietnamese");
  });
});

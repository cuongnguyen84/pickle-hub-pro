import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const source = (p: string) => readFileSync(resolve(root, p), "utf8");

/**
 * PageSpeed measured lab CLS across ten templates on 2026-08-19. Every detail
 * page scored 0; the damage was concentrated in three hub/list routes:
 * homepage 0.9, /news 0.483, /san 0.449. The homepage was handled separately
 * (PR #633). These guard the other two.
 *
 * CrUX has no URL-level data for this site — traffic per URL is below the
 * sampling threshold — so lab measurement is the only per-template signal
 * available, and these assertions stand in for a field number we cannot get.
 */
describe("hub list routes reserve their loaded geometry", () => {
  it("/news renders skeleton rows built from the real row classes", () => {
    const news = source("src/pages/News.tsx");
    expect(news).toContain("tl-news-row--skeleton");
    expect(news).toContain("NEWS_SKELETON_ROWS");
    // The regression: a single line of loading text reserving almost nothing.
    // Assert the JSX expression, not the words — the comment above the fix
    // quotes the old string to explain what was wrong with it.
    expect(news).not.toContain(
      '{language === "vi" ? "Đang tải tin…" : "Loading news…"}',
    );
    // The skeleton must reuse the row's own classes rather than ad-hoc boxes,
    // so its height is computed by the same CSS that lays out a loaded row.
    for (const cls of [
      "tl-news-row-kicker",
      "tl-news-row-title",
      "tl-news-row-summary",
      "tl-news-row-meta",
    ]) {
      expect(news).toContain(cls);
    }
  });

  it("the news skeleton is styled without hardcoding row heights", () => {
    const css = source("src/styles/the-line.css");
    expect(css).toContain(".tl-news-row--skeleton");
    // Height must come from the shared row rules, never from a height set on
    // the skeleton itself — that is what drifts when the row is restyled.
    const block = css.slice(css.indexOf(".tl-news-row--skeleton"));
    const scoped = block.slice(0, block.indexOf("@media (prefers-reduced-motion"));
    expect(scoped).not.toMatch(/\.tl-news-row--skeleton[^{]*\{[^}]*\bheight:/);
  });

  it("/san reserves a card grid rather than a spinner", () => {
    const venues = source("src/pages/VenuesList.tsx");
    expect(venues).toContain("VenueCardSkeleton");
    expect(venues).toContain("VENUE_SKELETON_CARDS");
    // The regression: a centred spinner in place of the grid.
    expect(venues).not.toContain("Loader2");
    // The placeholder grid must use the same column and gap classes as the
    // resolved grid, or it reserves the wrong width per card.
    const grid = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";
    expect(venues.split(grid).length - 1).toBeGreaterThanOrEqual(2);
  });

  it("VenueCardSkeleton mirrors VenueCard's box, not invented dimensions", () => {
    const skeleton = source("src/components/venues/VenueCardSkeleton.tsx");
    const card = source("src/components/venues/VenueCard.tsx");
    for (const cls of [
      "flex flex-col gap-3 rounded-md border border-border bg-card p-5",
      "flex items-start gap-3",
      "h-14 w-14 shrink-0",
      "mt-auto flex items-center justify-between gap-3 border-t border-border pt-3",
    ]) {
      expect(card).toContain(cls);
      expect(skeleton).toContain(cls);
    }
  });

  it("reserves about a viewport, not the whole page size", () => {
    // Reserving all 60 rows would overshoot every short result set and shift
    // the other way, which is not an improvement.
    expect(source("src/pages/News.tsx")).toContain("const NEWS_SKELETON_ROWS = 6;");
    expect(source("src/pages/VenuesList.tsx")).toContain("const VENUE_SKELETON_CARDS = 6;");
  });
});

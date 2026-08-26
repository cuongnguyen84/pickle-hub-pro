import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("layout-stable public content surfaces", () => {
  it("keeps live/upcoming first while retaining reserved feed placeholders", () => {
    const home = source("src/pages/Index.tsx");
    const news = source("src/components/home/HomeNewsFeed.tsx");
    const live = source("src/components/home/LiveSection.tsx");

    expect(home).toContain(
      "hasLiveData || scheduledStreams.length > 0 || recentEnded.length > 0",
    );
    expect(home).toContain("const liveNode = liveQueriesLoading");
    expect(home).toContain("priority");
    expect(home).toContain("viPostsLoading");
    expect(home).toContain("isLoading={homeNewsQuery.isLoading}");
    expect(news).toContain("tl-news-item--skeleton");
    expect(live).toContain('{ width: 768, height: 432, fit: "contain" }');
    expect(live).toContain('loading={priority ? "eager" : "lazy"}');
  });

  it("live watch page, DUPR banner and home hero reserve geometry (cls-attribution)", () => {
    const watch = source("src/pages/WatchLive.tsx");
    const banner = source("src/components/dupr/ConnectDuprBanner.tsx");
    const home = source("src/pages/Index.tsx");

    // INC1: stats row must not rewrap; loading tree mirrors resolved container.
    expect(watch).toContain("whitespace-nowrap overflow-x-auto");
    expect(watch.match(/container-wide section-spacing/g)?.length).toBeGreaterThanOrEqual(2);
    expect(watch).toContain('<Skeleton className="hidden lg:block aspect-video rounded-xl" />');
    // INC2: banner renders invisible (slot reserved), never late-inserts.
    expect(banner).toContain('visibility: reserving ? "hidden" : undefined');
    // INC3: home reserves the live hero slot while queries resolve.
    expect(home).toContain("LiveSectionSkeleton");
    // INC3 follow-up (2026-08-19): the reservation is only as good as the hint
    // that drives it. sessionStorage made every new session's first pageview
    // unreserved, which is what CrUX measures — field CLS p75 0.37 on mobile.
    // Guard that the hint stays device-scoped and never regresses to session
    // scope. Later the same day the default flipped too: shouldReserveLiveSlot
    // reserves unless a live hint positively says the slot was empty, so a
    // first visit reserves. Asserting the decision helper rather than the raw
    // reader is deliberate — reading the hint directly would reintroduce the
    // bug where "unknown" was treated as "known empty".
    expect(home).toContain("shouldReserveLiveSlot");
    expect(home).toContain("writeLiveLeadHint");
    expect(home).not.toContain("readLiveLeadHint(");
    // Assert the call, not the word — the surrounding comment in Index.tsx
    // names sessionStorage to explain what was wrong with it.
    expect(home).not.toContain("sessionStorage.getItem");
    expect(home).not.toContain("sessionStorage.setItem");
  });

  it("venue and blog loading states reserve media geometry", () => {
    const venue = source("src/pages/VenueDetail.tsx");
    const viBlog = source("src/pages/ViBlogPost.tsx");
    const enBlog = source("src/pages/BlogPost.tsx");

    expect(venue).toContain('className="mb-5 aspect-video w-full');
    expect(venue).toContain('width={1600}');
    expect(venue).toContain("nearbyLoading");
    expect(viBlog).toContain('className="aspect-[3/2] w-full rounded-xl mb-8"');
    expect(enBlog).toContain('className="aspect-video w-full mb-10 rounded-xl"');
  });
});

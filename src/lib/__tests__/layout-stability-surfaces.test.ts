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

    expect(home).toContain("const liveLeads = hasLiveData || scheduledStreams.length > 0");
    expect(home).toContain("liveLeads ? liveNode : null");
    expect(home).toContain("priority={liveLeads}");
    expect(home).toContain("viPostsLoading");
    expect(home).toContain("isLoading={homeNewsQuery.isLoading}");
    expect(news).toContain("tl-news-item--skeleton");
    expect(live).toContain("{ width: 768, height: 432 }");
    expect(live).toContain('loading={priority ? "eager" : "lazy"}');
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

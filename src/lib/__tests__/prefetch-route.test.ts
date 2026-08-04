import { describe, expect, it } from "vitest";
import { shouldPrefetchHomeData } from "../prefetch-policy";

describe("shouldPrefetchHomeData", () => {
  it.each(["/", "/vi", "/vi/"])("prefetches homepage data on %s", (path) => {
    expect(shouldPrefetchHomeData(path)).toBe(true);
  });

  it.each([
    "/san/venue-slug",
    "/blog/article-slug",
    "/vi/blog/bai-viet",
    "/tournaments",
  ])("does not compete with critical route data on %s", (path) => {
    expect(shouldPrefetchHomeData(path)).toBe(false);
  });
});

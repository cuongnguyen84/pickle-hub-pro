import { describe, expect, it } from "vitest";
import { isKnownSpaPath } from "../spa-routes";

describe("isKnownSpaPath", () => {
  it("accepts public and localized trust pages", () => {
    for (const path of ["/", "/vi", "/about", "/vi/about", "/contact", "/vi/contact"]) {
      expect(isKnownSpaPath(path)).toBe(true);
    }
  });

  it("accepts representative dynamic and private app routes", () => {
    for (const path of [
      "/tournament/hcmc-open", "/vi/blog/pickleball-rules", "/social/sunday-dink/live",
      "/clb/saigon/quan-ly/social/open-2026/sua", "/tools/quick-tables/abc/setup",
      "/admin/news", "/creator/videos/123/edit", "/seller/application/status",
    ]) {
      expect(isKnownSpaPath(path)).toBe(true);
    }
  });

  it("rejects paths that would otherwise become soft 404s", () => {
    for (const path of [
      "/definitely-not-real-agent-check-823", "/about/not-a-route", "/tools/not-a-real-tool",
      "/vi/contact/extra", "/.well-known/mcp/manifest",
    ]) {
      expect(isKnownSpaPath(path)).toBe(false);
    }
  });
});

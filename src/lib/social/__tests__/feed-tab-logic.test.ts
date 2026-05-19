import { describe, it, expect } from "vitest";
import {
  resolveDefaultTab,
  shouldShowFollowingTab,
  parseTabParam,
} from "../feed-tab-logic";

/**
 * Default-tab decision tree tests. The tree is small but the choice has
 * UX consequences (anonymous user landing on an empty Following tab would
 * be hostile), so it's worth pinning.
 */

describe("resolveDefaultTab", () => {
  it("anonymous + urlOverride=following coerces to trending (Codex P2)", () => {
    // Honouring an anonymous deep-link to ?tab=following would render
    // Following content while the Following tab is hidden — a keyboard
    // trap. Coerce to trending.
    expect(
      resolveDefaultTab({
        isAuthenticated: false,
        followingCount: null,
        urlOverride: "following",
      }),
    ).toBe("trending");
  });

  it("authenticated + urlOverride=following honoured", () => {
    expect(
      resolveDefaultTab({
        isAuthenticated: true,
        followingCount: 0,
        urlOverride: "following",
      }),
    ).toBe("following");
    expect(
      resolveDefaultTab({
        isAuthenticated: true,
        followingCount: 12,
        urlOverride: "following",
      }),
    ).toBe("following");
  });

  it("URL override 'trending' wins over follow-graph default for both auth states", () => {
    expect(
      resolveDefaultTab({
        isAuthenticated: true,
        followingCount: 12,
        urlOverride: "trending",
      }),
    ).toBe("trending");
    expect(
      resolveDefaultTab({
        isAuthenticated: false,
        followingCount: null,
        urlOverride: "trending",
      }),
    ).toBe("trending");
  });

  it("anonymous → trending when no override", () => {
    expect(
      resolveDefaultTab({
        isAuthenticated: false,
        followingCount: null,
      }),
    ).toBe("trending");
  });

  it("authenticated with 0 follows → trending (avoid empty Following landing)", () => {
    expect(
      resolveDefaultTab({
        isAuthenticated: true,
        followingCount: 0,
      }),
    ).toBe("trending");
  });

  it("authenticated with >0 follows → trending (Sprint 6: pro-tour boost makes Trending the cold-start landing for everyone)", () => {
    // Previous behavior favored Following when the viewer had any follows.
    // Sprint 6 product call: Trending now leads with PPA / APP / MLP pro
    // matches (boosted in get_trending_feed) so even high-follow viewers
    // see fresh recognizable content first. The Following tab is one
    // click + the deep-link is preserved for users who bookmark it.
    expect(
      resolveDefaultTab({
        isAuthenticated: true,
        followingCount: 1,
      }),
    ).toBe("trending");
    expect(
      resolveDefaultTab({
        isAuthenticated: true,
        followingCount: 47,
      }),
    ).toBe("trending");
  });

  it("authenticated with undefined count (loading) → trending", () => {
    // Pre-Sprint-6, this fallback existed to avoid landing on an empty
    // Following while useFollowingCount was in flight. Post-Sprint-6
    // the answer is the same: Trending unconditionally.
    expect(
      resolveDefaultTab({
        isAuthenticated: true,
        followingCount: undefined,
      }),
    ).toBe("trending");
  });
});

describe("shouldShowFollowingTab", () => {
  it("returns true only when authenticated", () => {
    expect(shouldShowFollowingTab(true)).toBe(true);
    expect(shouldShowFollowingTab(false)).toBe(false);
  });
});

describe("parseTabParam", () => {
  it("returns the tab when value is valid", () => {
    expect(parseTabParam("following")).toBe("following");
    expect(parseTabParam("trending")).toBe("trending");
  });

  it("returns null for unrecognized values", () => {
    expect(parseTabParam(null)).toBe(null);
    expect(parseTabParam(undefined)).toBe(null);
    expect(parseTabParam("")).toBe(null);
    expect(parseTabParam("recent")).toBe(null);
    expect(parseTabParam("FOLLOWING")).toBe(null); // case-sensitive on purpose
  });
});

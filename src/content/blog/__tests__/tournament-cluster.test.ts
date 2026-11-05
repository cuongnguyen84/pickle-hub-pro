import { describe, expect, it } from "vitest";
import { blogMetadata } from "../metadata";
import { buildTournamentClusterLinks } from "../tournament-cluster";

const en = (s: string) => (blogMetadata.some((p) => p.slug === s) ? `/blog/${s}` : undefined);

describe("buildTournamentClusterLinks", () => {
  it("links the schedule sibling, watch guide, rankings and tools from a results post", () => {
    expect(buildTournamentClusterLinks("hong-kong-slam-2026-results", "en", en).map((l) => l.path)).toEqual([
      "/blog/hong-kong-slam-2026-schedule",
      "/blog/how-to-watch-ppa-tour-live-2026",
      "/rankings",
      "/tools",
    ]);
  });

  it("skips a sibling that was never published and prefers an event-specific watch guide", () => {
    expect(buildTournamentClusterLinks("pickleball-world-championships-2026-results", "en", en).map((l) => l.path))
      .toEqual(["/blog/how-to-watch-ppa-tour-live-2026", "/rankings", "/tools"]);
    expect(buildTournamentClusterLinks("pickleball-world-cup-2026-da-nang-schedule", "en", en).map((l) => l.path))
      .toEqual([
        "/blog/pickleball-world-cup-2026-da-nang-results",
        "/blog/pickleball-world-cup-2026-da-nang-how-to-watch",
        "/rankings",
        "/tools",
      ]);
  });

  it("uses VI paths and stays empty for non-tournament posts", () => {
    const vi = buildTournamentClusterLinks("pickleball-world-championships-2026-results", "vi", (s) =>
      s === "how-to-watch-ppa-tour-live-2026" ? "/vi/blog/xem-ppa-tour-truc-tiep-2026" : undefined,
    );
    expect(vi.map((l) => l.path)).toEqual(["/vi/blog/xem-ppa-tour-truc-tiep-2026", "/vi/rankings", "/vi/tools"]);
    expect(buildTournamentClusterLinks("world-pickleball-rankings-wpr-explained", "en", en)).toEqual([]);
  });
});

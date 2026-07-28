// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { featuredCutoffDate, toFeaturedParentTournament } from "../useFeaturedParentTournaments";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

describe("featuredCutoffDate", () => {
  it("keeps a tournament for 10 days after its event date, then drops it", () => {
    const cutoff = featuredCutoffDate(new Date("2026-08-05T03:00:00Z"));
    expect(cutoff).toBe("2026-07-26");
    expect(featuredCutoffDate(new Date("2026-08-06T03:00:00Z"))).toBe("2026-07-27");
  });
});

describe("toFeaturedParentTournament", () => {
  it("counts every public event and previews active events first", () => {
    const result = toFeaturedParentTournament({
      id: "parent-1",
      creator_user_id: "owner-1",
      name: "Summer Cup",
      description: null,
      banner_url: null,
      event_date: "2026-07-26",
      location: "Dink Dynamos",
      share_id: "parent-share",
      is_featured: true,
      created_at: "2026-07-20T00:00:00.000Z",
      updated_at: "2026-07-20T00:00:00.000Z",
      quick_tables: [
        {
          id: "completed",
          name: "Completed event",
          status: "completed",
          share_id: "completed-share",
          created_at: "2026-07-24T00:00:00.000Z",
        },
        {
          id: "setup",
          name: "Setup event",
          status: "setup",
          share_id: "setup-share",
          created_at: "2026-07-23T00:00:00.000Z",
        },
        {
          id: "playoff",
          name: "Playoff event",
          status: "playoff",
          share_id: "playoff-share",
          created_at: "2026-07-22T00:00:00.000Z",
        },
        {
          id: "groups",
          name: "Group-stage event",
          status: "group_stage",
          share_id: "groups-share",
          created_at: "2026-07-21T00:00:00.000Z",
        },
      ],
    });

    expect(result.subEventCount).toBe(4);
    expect(result.previewSubEvents.map(event => event.id)).toEqual([
      "groups",
      "playoff",
      "setup",
    ]);
  });
});

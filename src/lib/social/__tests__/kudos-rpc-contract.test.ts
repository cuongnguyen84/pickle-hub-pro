import { describe, it, expectTypeOf, expect } from "vitest";
import type { Database } from "@/integrations/supabase/types";

/**
 * Sprint 4 Phase 4B — kudos RPC + extended feed RPC type contracts.
 *
 * Compile-time assertions only. If a future migration drifts the return
 * shape of toggle_match_kudos or removes kudos_count / viewer_kudoed from
 * the feed RPC return tables, these fail at `npm test` and surface the
 * regression before any consumer (KudosButton, FeedMatchCard, MatchActions)
 * blows up at runtime.
 *
 * `expect(true).toBe(true)` keeps each case runtime-counted.
 */
describe("Phase 4B kudos RPC type contracts", () => {
  it("toggle_match_kudos: takes p_match_id, returns Json (jsonb wrapper)", () => {
    type Args = Database["public"]["Functions"]["toggle_match_kudos"]["Args"];
    type Returns = Database["public"]["Functions"]["toggle_match_kudos"]["Returns"];
    expectTypeOf<Args>().toEqualTypeOf<{ p_match_id: string }>();
    // RPC returns jsonb {kudoed, count}; gen-types renders as Json.
    expectTypeOf<Returns>().not.toBeUndefined();
    expect(true).toBe(true);
  });

  it("get_following_feed: returns kudos_count + viewer_kudoed", () => {
    type Returns = Database["public"]["Functions"]["get_following_feed"]["Returns"];
    expectTypeOf<Returns[0]["kudos_count"]>().toMatchTypeOf<number>();
    expectTypeOf<Returns[0]["viewer_kudoed"]>().toMatchTypeOf<boolean>();
    expect(true).toBe(true);
  });

  it("get_trending_feed: accepts p_viewer_id + returns kudos_count + viewer_kudoed", () => {
    type Args = Database["public"]["Functions"]["get_trending_feed"]["Args"];
    type Returns = Database["public"]["Functions"]["get_trending_feed"]["Returns"];
    // p_viewer_id is the new optional param Phase 4B adds for trending.
    expectTypeOf<Args["p_viewer_id"]>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<Returns[0]["kudos_count"]>().toMatchTypeOf<number>();
    expectTypeOf<Returns[0]["viewer_kudoed"]>().toMatchTypeOf<boolean>();
    expect(true).toBe(true);
  });
});

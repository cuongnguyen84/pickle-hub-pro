import { describe, it, expectTypeOf, expect } from "vitest";
import type { Database } from "@/integrations/supabase/types";

/**
 * Sprint 4 Phase 4C — comment RPC + extended feed RPC type contracts.
 *
 * Compile-time assertions only. If a future migration drifts shapes
 * (e.g., dropping comment_count from the feed return, or renaming
 * is_deleted on get_match_comments), these fail at `npm test` and
 * surface the regression before consumers blow up.
 *
 * `expect(true).toBe(true)` keeps each case runtime-counted.
 */
describe("Phase 4C comments RPC type contracts", () => {
  it("add_match_comment: required p_match_id + p_body, optional p_parent_comment_id", () => {
    type Args = Database["public"]["Functions"]["add_match_comment"]["Args"];
    expectTypeOf<Args["p_match_id"]>().toEqualTypeOf<string>();
    expectTypeOf<Args["p_body"]>().toEqualTypeOf<string>();
    expectTypeOf<Args["p_parent_comment_id"]>().toEqualTypeOf<
      string | null | undefined
    >();
    expect(true).toBe(true);
  });

  it("edit_match_comment + delete_match_comment: take comment_id (+ body for edit)", () => {
    type EditArgs = Database["public"]["Functions"]["edit_match_comment"]["Args"];
    type DeleteArgs = Database["public"]["Functions"]["delete_match_comment"]["Args"];
    expectTypeOf<EditArgs>().toEqualTypeOf<{
      p_comment_id: string;
      p_body: string;
    }>();
    expectTypeOf<DeleteArgs>().toEqualTypeOf<{ p_comment_id: string }>();
    expect(true).toBe(true);
  });

  it("get_match_comments: cursor pagination + threading columns in return", () => {
    type Args = Database["public"]["Functions"]["get_match_comments"]["Args"];
    type Returns = Database["public"]["Functions"]["get_match_comments"]["Returns"];
    expectTypeOf<Args["p_match_id"]>().toEqualTypeOf<string>();
    expectTypeOf<Args["p_cursor_created_at"]>().toEqualTypeOf<
      string | null | undefined
    >();
    expectTypeOf<Args["p_cursor_comment_id"]>().toEqualTypeOf<
      string | null | undefined
    >();
    expectTypeOf<Returns[0]["comment_id"]>().toMatchTypeOf<string>();
    expectTypeOf<Returns[0]["parent_comment_id"]>().toMatchTypeOf<
      string | null
    >();
    expectTypeOf<Returns[0]["depth"]>().toMatchTypeOf<number>();
    expectTypeOf<Returns[0]["is_deleted"]>().toMatchTypeOf<boolean>();
    expect(true).toBe(true);
  });

  it("get_following_feed + get_trending_feed: return comment_count column", () => {
    type Following = Database["public"]["Functions"]["get_following_feed"]["Returns"];
    type Trending = Database["public"]["Functions"]["get_trending_feed"]["Returns"];
    expectTypeOf<Following[0]["comment_count"]>().toMatchTypeOf<number>();
    expectTypeOf<Trending[0]["comment_count"]>().toMatchTypeOf<number>();
    expect(true).toBe(true);
  });
});

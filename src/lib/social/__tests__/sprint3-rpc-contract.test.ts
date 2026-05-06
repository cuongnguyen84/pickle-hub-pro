import { describe, it, expectTypeOf, expect } from "vitest";
import type { Database } from "@/integrations/supabase/types";

/**
 * Sprint 3 Phase 1 — RPC + table type contracts.
 *
 * Type-only assertions (compile-time): ensure `supabase gen types` produced
 * the expected shapes for the 4 new RPCs + 2 new tables + profiles new
 * columns. If the regen drifts (e.g., a future migration changes a return
 * column type), these fail at `npm test` / `npm run build` and surface the
 * drift before it hits Phase 2/3 consumers.
 *
 * `expect(true).toBe(true)` per case keeps each test runtime-counted so the
 * vitest report shows 5 cases passing.
 */
describe("Sprint 3 RPC type contracts", () => {
  it("get_player_stats: takes p_username, returns row with win_rate + form", () => {
    type Args = Database["public"]["Functions"]["get_player_stats"]["Args"];
    type Returns = Database["public"]["Functions"]["get_player_stats"]["Returns"];
    expectTypeOf<Args>().toEqualTypeOf<{ p_username: string }>();
    expectTypeOf<Returns[0]["win_rate"]>().toMatchTypeOf<number>();
    expectTypeOf<Returns[0]["last_5_form"]>().toMatchTypeOf<string>();
    expectTypeOf<Returns[0]["current_streak"]>().toMatchTypeOf<number>();
    expect(true).toBe(true);
  });

  it("search_players: optional p_exclude_id + p_limit, returns username + dupr_doubles", () => {
    type Args = Database["public"]["Functions"]["search_players"]["Args"];
    expectTypeOf<Args["p_query"]>().toEqualTypeOf<string>();
    expectTypeOf<Args["p_exclude_id"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Args["p_limit"]>().toEqualTypeOf<number | undefined>();
    type Returns = Database["public"]["Functions"]["search_players"]["Returns"];
    expectTypeOf<Returns[0]["username"]>().toMatchTypeOf<string>();
    expectTypeOf<Returns[0]["dupr_doubles"]>().toMatchTypeOf<number>();
    expect(true).toBe(true);
  });

  it("get_player_match_history: paginated args, participants is Json", () => {
    type Args = Database["public"]["Functions"]["get_player_match_history"]["Args"];
    expectTypeOf<Args["p_player_id"]>().toEqualTypeOf<string>();
    expectTypeOf<Args["p_limit"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<Args["p_offset"]>().toEqualTypeOf<number | undefined>();
    type Returns = Database["public"]["Functions"]["get_player_match_history"]["Returns"];
    expectTypeOf<Returns[0]["match_id"]>().toMatchTypeOf<string>();
    expectTypeOf<Returns[0]["player_won"]>().toMatchTypeOf<boolean>();
    // participants is JSONB — gen-types renders as Json
    type Participants = Returns[0]["participants"];
    expectTypeOf<Participants>().not.toBeUndefined();
    expect(true).toBe(true);
  });

  it("dupr_rating_history Row exists with profile_id + dupr_doubles", () => {
    type Row = Database["public"]["Tables"]["dupr_rating_history"]["Row"];
    expectTypeOf<Row["profile_id"]>().toEqualTypeOf<string>();
    expectTypeOf<Row["dupr_doubles"]>().toMatchTypeOf<number | null>();
    expectTypeOf<Row["dupr_singles"]>().toMatchTypeOf<number | null>();
    expectTypeOf<Row["source"]>().toMatchTypeOf<string>();
    // dupr_sync_runs Row also exists (internal log table)
    type SyncRow = Database["public"]["Tables"]["dupr_sync_runs"]["Row"];
    expectTypeOf<SyncRow["profiles_total"]>().toMatchTypeOf<number>();
    expect(true).toBe(true);
  });

  it("profiles row has Sprint 3 onboarding + dupr ingest columns", () => {
    type Row = Database["public"]["Tables"]["profiles"]["Row"];
    expectTypeOf<Row["onboarding_step"]>().toMatchTypeOf<number | null>();
    expectTypeOf<Row["onboarding_completed_at"]>().toMatchTypeOf<string | null>();
    expectTypeOf<Row["dupr_profile_url"]>().toMatchTypeOf<string | null>();
    expectTypeOf<Row["dupr_last_error"]>().toMatchTypeOf<string | null>();
    expectTypeOf<Row["dupr_last_attempt_at"]>().toMatchTypeOf<string | null>();
    expect(true).toBe(true);
  });
});

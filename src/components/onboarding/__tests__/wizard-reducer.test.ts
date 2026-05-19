import { describe, it, expect } from "vitest";
import {
  reducer,
  initialState,
  type OnboardingState,
  type OnboardingAction,
} from "../wizard-reducer";

/**
 * Reducer tests for OnboardingWizard, focused on TOGGLE_FOLLOW which fixes
 * the Codex P1 stale-closure bug on PR #15. Two async FollowButton
 * onFollowChange callbacks resolving close together MUST converge on the
 * union of their toggles — not the result of the second one alone (which
 * is what the previous handleFollowChange + closure-captured `selected`
 * pattern produced).
 */

const withFollows = (ids: string[]): OnboardingState => ({
  ...initialState,
  follows: { ...initialState.follows, selected_user_ids: ids },
});

describe("OnboardingWizard reducer — TOGGLE_FOLLOW", () => {
  it("adds an id when isFollowing=true and id not yet present", () => {
    const next = reducer(withFollows([]), {
      type: "TOGGLE_FOLLOW",
      followedId: "user-A",
      isFollowing: true,
    });
    expect(next.follows.selected_user_ids).toEqual(["user-A"]);
  });

  it("removes an id when isFollowing=false", () => {
    const next = reducer(withFollows(["user-A", "user-B"]), {
      type: "TOGGLE_FOLLOW",
      followedId: "user-A",
      isFollowing: false,
    });
    expect(next.follows.selected_user_ids).toEqual(["user-B"]);
  });

  it("idempotent: toggling-on the same id twice yields no duplicate", () => {
    const once = reducer(withFollows([]), {
      type: "TOGGLE_FOLLOW",
      followedId: "user-A",
      isFollowing: true,
    });
    const twice = reducer(once, {
      type: "TOGGLE_FOLLOW",
      followedId: "user-A",
      isFollowing: true,
    });
    expect(twice.follows.selected_user_ids).toEqual(["user-A"]);
  });

  it("idempotent: toggling-off an absent id is a no-op", () => {
    const next = reducer(withFollows(["user-A"]), {
      type: "TOGGLE_FOLLOW",
      followedId: "user-B",
      isFollowing: false,
    });
    expect(next.follows.selected_user_ids).toEqual(["user-A"]);
  });

  it("two TOGGLE_FOLLOWs resolving 'out-of-order' both land in final state", () => {
    // This is the Codex P1 scenario: two async callbacks fire close
    // together. With the previous closure-based handleFollowChange both
    // would have computed `next` from the same stale snapshot ([])
    // and the second dispatch would clobber the first → only one id
    // in selected. With the reducer-based atomic toggle, the second
    // dispatch reads the FIRST dispatch's result, so both ids land.
    const afterFirst = reducer(initialState, {
      type: "TOGGLE_FOLLOW",
      followedId: "user-A",
      isFollowing: true,
    });
    const afterSecond = reducer(afterFirst, {
      type: "TOGGLE_FOLLOW",
      followedId: "user-B",
      isFollowing: true,
    });
    expect(afterSecond.follows.selected_user_ids).toEqual([
      "user-A",
      "user-B",
    ]);
    expect(afterSecond.follows.selected_user_ids.length).toBe(2);
  });

  it("preserves other onboarding state slices", () => {
    const seeded: OnboardingState = {
      ...initialState,
      profile: {
        ...initialState.profile,
        display_name: "Cuong",
        username: "cuong-x",
      },
      currentStep: 4,
    };
    const next = reducer(seeded, {
      type: "TOGGLE_FOLLOW",
      followedId: "user-A",
      isFollowing: true,
    });
    expect(next.profile.display_name).toBe("Cuong");
    expect(next.profile.username).toBe("cuong-x");
    expect(next.currentStep).toBe(4);
    expect(next.follows.selected_user_ids).toEqual(["user-A"]);
  });

  it("preserves follows.skipped flag while toggling ids", () => {
    const seeded: OnboardingState = {
      ...initialState,
      follows: { selected_user_ids: ["user-A"], skipped: true },
    };
    const next = reducer(seeded, {
      type: "TOGGLE_FOLLOW",
      followedId: "user-B",
      isFollowing: true,
    });
    expect(next.follows.skipped).toBe(true);
    expect(next.follows.selected_user_ids).toEqual(["user-A", "user-B"]);
  });
});

// satisfy isolatedModules — keeps OnboardingAction in scope as a type used.
type _ActionContractCheck = OnboardingAction;

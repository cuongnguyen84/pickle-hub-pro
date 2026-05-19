/**
 * OnboardingWizard reducer + types — split into its own file (not the
 * .tsx wizard component) so:
 *   1. wizard-reducer.test.ts can import without pulling Supabase init.
 *   2. The wizard.tsx file stays "components only" → react-refresh stays
 *      happy. (Fast refresh warns when a .tsx exports non-components.)
 */

export type StepNumber = 1 | 2 | 3 | 4;

export type OnboardingState = {
  currentStep: StepNumber;
  profile: {
    display_name: string;
    username: string;
    skill_level: "beginner" | "intermediate" | "advanced" | "pro" | "";
  };
  dupr: {
    dupr_id: string;
    dupr_singles: number | null;
    dupr_doubles: number | null;
    skipped: boolean;
    saved: boolean;
  };
  venue: {
    venue_id: string | null;
    venue_name: string | null;
    skipped: boolean;
  };
  follows: {
    selected_user_ids: string[];
    skipped: boolean;
  };
};

export type OnboardingAction =
  | { type: "GO_NEXT" }
  | { type: "GO_PREV" }
  | { type: "SET_STEP"; step: StepNumber }
  | { type: "SET_PROFILE"; payload: Partial<OnboardingState["profile"]> }
  | { type: "SET_DUPR"; payload: Partial<OnboardingState["dupr"]> }
  | { type: "SET_VENUE"; payload: Partial<OnboardingState["venue"]> }
  | { type: "SET_FOLLOWS"; payload: Partial<OnboardingState["follows"]> }
  | { type: "TOGGLE_FOLLOW"; followedId: string; isFollowing: boolean };

export const initialState: OnboardingState = {
  currentStep: 1,
  profile: { display_name: "", username: "", skill_level: "" },
  dupr: {
    dupr_id: "",
    dupr_singles: null,
    dupr_doubles: null,
    skipped: false,
    saved: false,
  },
  venue: { venue_id: null, venue_name: null, skipped: false },
  follows: { selected_user_ids: [], skipped: false },
};

export function reducer(
  state: OnboardingState,
  action: OnboardingAction,
): OnboardingState {
  switch (action.type) {
    case "GO_NEXT": {
      const next = Math.min(state.currentStep + 1, 4) as StepNumber;
      return { ...state, currentStep: next };
    }
    case "GO_PREV": {
      const prev = Math.max(state.currentStep - 1, 1) as StepNumber;
      return { ...state, currentStep: prev };
    }
    case "SET_STEP":
      return { ...state, currentStep: action.step };
    case "SET_PROFILE":
      return { ...state, profile: { ...state.profile, ...action.payload } };
    case "SET_DUPR":
      return { ...state, dupr: { ...state.dupr, ...action.payload } };
    case "SET_VENUE":
      return { ...state, venue: { ...state.venue, ...action.payload } };
    case "SET_FOLLOWS":
      return { ...state, follows: { ...state.follows, ...action.payload } };
    case "TOGGLE_FOLLOW": {
      // Atomic toggle — derive next array from CURRENT reducer state, never
      // from a stale closure snapshot. Multiple async FollowButton.onFollowChange
      // callbacks resolving out-of-order each get the latest state via this
      // dispatch (Codex P1 fix on PR #15).
      const current = state.follows.selected_user_ids;
      let nextIds: string[];
      if (action.isFollowing) {
        nextIds = current.includes(action.followedId)
          ? current
          : [...current, action.followedId];
      } else {
        nextIds = current.filter((id) => id !== action.followedId);
      }
      return {
        ...state,
        follows: { ...state.follows, selected_user_ids: nextIds },
      };
    }
    default:
      return state;
  }
}

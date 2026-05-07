import { useReducer, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { OnboardingProgress } from "./OnboardingProgress";
import { ProfileSetup } from "./steps/ProfileSetup";
import { DuprLinkStep } from "./steps/DuprLinkStep";
import { VenueSelectStep } from "./steps/VenueSelectStep";
import { SuggestedFollowsStep } from "./steps/SuggestedFollowsStep";

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

type Action =
  | { type: "GO_NEXT" }
  | { type: "GO_PREV" }
  | { type: "SET_STEP"; step: StepNumber }
  | { type: "SET_PROFILE"; payload: Partial<OnboardingState["profile"]> }
  | { type: "SET_DUPR"; payload: Partial<OnboardingState["dupr"]> }
  | { type: "SET_VENUE"; payload: Partial<OnboardingState["venue"]> }
  | { type: "SET_FOLLOWS"; payload: Partial<OnboardingState["follows"]> };

const initialState: OnboardingState = {
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

function reducer(state: OnboardingState, action: Action): OnboardingState {
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
    default:
      return state;
  }
}

export function OnboardingWizard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const { user } = useAuth();

  // ─── Resume support ────────────────────────────────────────────────────
  // If profile.onboarding_step is N, the user has completed step N — start
  // at the NEXT one. Cap at 4 to handle re-entry of an already-completed
  // wizard (the page-level effect will redirect away in that case anyway).
  const resumedStepRef = useResumeStep(profile);
  useEffect(() => {
    if (resumedStepRef && resumedStepRef !== state.currentStep) {
      dispatch({ type: "SET_STEP", step: resumedStepRef });
    }
    // Resume only on initial mount — fired once when profile first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumedStepRef]);

  // Hydrate persisted profile fields back into wizard state on mount, so
  // returning users see their previously-typed display_name etc. when
  // resuming mid-wizard.
  useEffect(() => {
    const p = profile as
      | {
          display_name?: string | null;
          username?: string | null;
          dupr_id?: string | null;
          dupr_singles?: number | null;
          dupr_doubles?: number | null;
        }
      | null
      | undefined;
    if (!p) return;
    if (p.display_name || p.username) {
      dispatch({
        type: "SET_PROFILE",
        payload: {
          display_name: p.display_name ?? "",
          username: p.username ?? "",
        },
      });
    }
    if (p.dupr_doubles != null) {
      dispatch({
        type: "SET_DUPR",
        payload: {
          dupr_id: p.dupr_id ?? "",
          dupr_singles: p.dupr_singles ?? null,
          dupr_doubles: p.dupr_doubles,
          saved: true,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (!user) return null;

  const handleComplete = () => {
    navigate("/", { replace: true });
  };

  return (
    // No min-h-screen / bg-background here — host page (TheLineLayout) owns
    // viewport height + theme tokens. Wizard sits inside tl-scroll naturally.
    <div className="tl-shell" style={{ paddingBottom: 56 }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: "32px 0" }}>
        <OnboardingProgress currentStep={state.currentStep} />
        <div className="mt-6">
          {state.currentStep === 1 && (
            <ProfileSetup
              state={state}
              dispatch={dispatch}
              userId={user.id}
            />
          )}
          {state.currentStep === 2 && (
            <DuprLinkStep state={state} dispatch={dispatch} />
          )}
          {state.currentStep === 3 && (
            <VenueSelectStep
              state={state}
              dispatch={dispatch}
              userId={user.id}
            />
          )}
          {state.currentStep === 4 && (
            <SuggestedFollowsStep
              state={state}
              dispatch={dispatch}
              userId={user.id}
              onComplete={handleComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Compute the step we should resume at based on profile.onboarding_step. */
function useResumeStep(
  profile: { onboarding_step?: number | null; onboarding_completed_at?: string | null } | null | undefined,
): StepNumber | null {
  if (!profile) return null;
  if (profile.onboarding_completed_at) return null;
  const stored = profile.onboarding_step ?? 0;
  // step N completed → resume at N+1 (clamped 1..4)
  const next = Math.min(Math.max(stored + 1, 1), 4) as StepNumber;
  return next;
}

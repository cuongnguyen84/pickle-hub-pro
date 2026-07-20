import { useReducer, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { OnboardingProgress } from "./OnboardingProgress";
import { ProfileSetup } from "./steps/ProfileSetup";
import { DuprLinkStep } from "./steps/DuprLinkStep";
import { VenueSelectStep } from "./steps/VenueSelectStep";
import { SuggestedFollowsStep } from "./steps/SuggestedFollowsStep";
import {
  reducer,
  initialState,
  type StepNumber,
  type OnboardingState,
} from "./wizard-reducer";
import { postOnboardingTarget } from "@/lib/auth/postLoginRedirect";

// Re-export types for step component prop typing.
export type { StepNumber, OnboardingState };
export type { OnboardingAction } from "./wizard-reducer";

export function OnboardingWizard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Destination the player was heading for before the auth wall interrupted
  // them (set by Login). Re-validated here rather than trusted: this value
  // reaches us through the URL, so it is attacker-controlled input at this
  // point regardless of who wrote it last.
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get("redirect");

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
    // Land on the user's own profile so they see the result of onboarding
    // (Strava/Twitter pattern). state.profile.username is populated by
    // ProfileSetup step 1 success. Fall back to homepage if username is
    // somehow missing — shouldn't happen since step 1 is gating, but
    // belt-and-suspenders against a partial-state wizard exit.
    // A player who arrived from a bracket/event link goes BACK to it — finishing
    // onboarding should not cost them the thing they came to do. Only fall back
    // to the profile-first landing when they started onboarding on their own.
    navigate(postOnboardingTarget(redirectParam, state.profile.username ?? null), {
      replace: true,
    });
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

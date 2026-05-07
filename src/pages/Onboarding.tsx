import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { TheLineLayout } from "@/components/layout/TheLineLayout";

/**
 * /onboarding — Sprint 3 Phase 3A 4-step wizard host page.
 *
 * Routing rules (handled inline; this page does NOT use RequireAuth /
 * RequireOnboarding wrappers):
 *   - not authed                → redirect /login?redirect=/onboarding
 *   - onboarding_completed_at   → redirect / (no need to onboard again)
 *   - else                      → render <OnboardingWizard/>
 */
const Onboarding = () => {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useUserProfile();
  const navigate = useNavigate();

  // Cast widens useUserProfile's narrow TS interface to include the Sprint 3
  // Phase 1 onboarding_* columns (data is select('*'); only the type lags).
  const onboarded = (profile as { onboarding_completed_at?: string | null } | null)
    ?.onboarding_completed_at;

  useEffect(() => {
    if (!authLoading && !profileLoading && user && onboarded) {
      navigate("/", { replace: true });
    }
  }, [authLoading, profileLoading, user, onboarded, navigate]);

  if (authLoading || (user && profileLoading)) {
    return (
      <TheLineLayout title="Đang tải" noindex>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </TheLineLayout>
    );
  }

  if (!user) {
    return <Navigate to="/login?redirect=/onboarding" replace />;
  }

  if (onboarded) {
    return null; // useEffect above will handle the navigate
  }

  return (
    <TheLineLayout title="Hoàn thiện hồ sơ" noindex>
      <OnboardingWizard />
    </TheLineLayout>
  );
};

export default Onboarding;

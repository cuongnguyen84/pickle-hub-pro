import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";

interface RequireOnboardingProps {
  children: ReactNode;
  redirectTo?: string;
}

/**
 * Guard for routes that require a fully onboarded user (Sprint 3 Phase 3A+).
 *
 * Redirects:
 *   - unauthenticated  → /login?redirect=<currentPath>
 *   - onboarding pending → /onboarding (preserves return-to via Login flow)
 *
 * NOT applied to existing routes in Phase 3A — this component is reserved
 * for future routes (FollowButton-protected pages, Settings/dupr, etc.)
 * that should not render until the user has completed the wizard.
 */
const RequireOnboarding = ({
  children,
  redirectTo = "/onboarding",
}: RequireOnboardingProps) => {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useUserProfile();
  const location = useLocation();

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    const currentPath = location.pathname + location.search;
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(currentPath)}`}
        replace
      />
    );
  }

  // Cast widens to include Phase 1's Sprint 3 onboarding columns
  // (useUserProfile selects '*' but its TS interface predates Sprint 3).
  const profileWithOnboarding = profile as
    | { onboarding_completed_at?: string | null }
    | null
    | undefined;

  if (!profileWithOnboarding?.onboarding_completed_at) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default RequireOnboarding;

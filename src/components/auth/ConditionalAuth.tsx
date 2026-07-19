import { ReactNode } from "react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import RequireAuth from "@/components/auth/RequireAuth";
import { LoadingState } from "@/components/states/PageStates";

interface ConditionalAuthProps {
  children: ReactNode;
}

const ConditionalAuth = ({ children }: ConditionalAuthProps) => {
  const { data: settings, isLoading } = useSystemSettings();

  if (isLoading) {
    return <LoadingState fullScreen />;
  }

  if (settings?.require_login_tournament_detail) {
    return <RequireAuth>{children}</RequireAuth>;
  }

  return <>{children}</>;
};

export default ConditionalAuth;

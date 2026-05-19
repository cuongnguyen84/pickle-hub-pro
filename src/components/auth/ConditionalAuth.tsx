import { ReactNode } from "react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import RequireAuth from "@/components/auth/RequireAuth";
import { Loader2 } from "lucide-react";

interface ConditionalAuthProps {
  children: ReactNode;
}

const ConditionalAuth = ({ children }: ConditionalAuthProps) => {
  const { data: settings, isLoading } = useSystemSettings();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (settings?.require_login_tournament_detail) {
    return <RequireAuth>{children}</RequireAuth>;
  }

  return <>{children}</>;
};

export default ConditionalAuth;

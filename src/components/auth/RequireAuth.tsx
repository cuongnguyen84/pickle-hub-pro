import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import { AdminMFAGate } from "@/components/admin/AdminMFAGate";
import { LoadingState } from "@/components/states/PageStates";

interface RequireAuthProps {
  children: ReactNode;
  /** Optional role gate — redirects to / if user doesn't have the role. */
  requiredRole?: "admin" | "creator";
}

const RequireAuth = ({ children, requiredRole }: RequireAuthProps) => {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdminAuth();
  const { isCreator, isLoading: creatorLoading } = useCreatorAuth();
  const location = useLocation();

  const roleLoading =
    (requiredRole === "admin" && adminLoading) ||
    (requiredRole === "creator" && creatorLoading);

  if (loading || roleLoading) {
    return <LoadingState fullScreen />;
  }

  if (!user) {
    const currentPath = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }

  // Role gate (admin also satisfies creator gate via OR)
  if (requiredRole === "admin" && !isAdmin) {
    return <Navigate to="/" replace />;
  }
  if (requiredRole === "creator" && !isCreator && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // ADMIN-MFA: các route admin không đi qua AdminLayout (/admin/dupr,
  // /admin/errors) vẫn phải qua gate 2FA.
  if (requiredRole === "admin") {
    return <AdminMFAGate>{children}</AdminMFAGate>;
  }

  return <>{children}</>;
};

export default RequireAuth;

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { reportCaughtError } from "@/lib/errorReporter";

interface AdminAuthState {
  isAdmin: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// The role lookup is the second serial step of the /admin gate (after
// AuthProvider's getSession). PostgREST calls carry no timeout, so a
// stalled request used to leave AdminLayout on its loading skeleton
// forever even with a healthy session (same incident as the
// AuthProvider safety timer, 2026-10-27). Abort the lookup after this
// budget: the gate then resolves to the signed-in non-admin end state
// instead of spinning, and the stall is reported.
export const ROLE_CHECK_TIMEOUT_MS = 8000;

export function useAdminAuth(): AdminAuthState {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setIsAdmin(false);
      setIsCheckingRole(false);
      return;
    }
    // Capture the id here: inside the async check below, TS cannot carry
    // the non-null narrowing of `user` across the function boundary.
    const userId = user.id;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ROLE_CHECK_TIMEOUT_MS);
    let cancelled = false;

    async function checkAdminRole() {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .abortSignal(controller.signal)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          if (controller.signal.aborted) {
            reportCaughtError(
              new Error(`admin role check aborted after ${ROLE_CHECK_TIMEOUT_MS}ms`),
              "auth:roleCheckTimeout",
            );
          }
          console.error("Error checking admin role:", error);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data);
        }
      } catch (err) {
        if (cancelled) return;
        if (controller.signal.aborted) {
          reportCaughtError(
            new Error(`admin role check aborted after ${ROLE_CHECK_TIMEOUT_MS}ms`),
            "auth:roleCheckTimeout",
          );
        }
        console.error("Error checking admin role:", err);
        setIsAdmin(false);
      } finally {
        if (!cancelled) {
          setIsCheckingRole(false);
        }
      }
    }

    checkAdminRole();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [user, authLoading]);

  return {
    isAdmin,
    isLoading: authLoading || isCheckingRole,
    isAuthenticated: !!user,
  };
}

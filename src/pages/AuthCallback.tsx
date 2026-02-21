import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/utils/ga";
import { Loader2 } from "lucide-react";

/**
 * Auth Callback Page
 * 
 * Handles OAuth callback from providers (Google, etc.)
 * This page processes the auth tokens and redirects to the appropriate page.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth callback error:", error);
          navigate("/login?error=auth_failed", { replace: true });
          return;
        }

        if (session) {
          // Track sign_up for new OAuth users (created within last 60s)
          const createdAt = session.user?.created_at;
          if (createdAt && (Date.now() - new Date(createdAt).getTime()) < 60000) {
            const provider = session.user?.app_metadata?.provider || "oauth";
            console.log("[GA4] sign_up event (oauth callback)", provider);
            trackEvent("sign_up", { method: provider });
          }

          const redirectTo = searchParams.get("redirect") || "/";
          navigate(redirectTo, { replace: true });
        } else {
          // No session, redirect to login
          navigate("/login", { replace: true });
        }
      } catch (err) {
        console.error("Auth callback exception:", err);
        navigate("/login?error=auth_failed", { replace: true });
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-foreground-muted">Đang xác thực...</p>
    </div>
  );
};

export default AuthCallback;

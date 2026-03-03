import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Auth Callback Page
 * 
 * Handles OAuth callback from providers (Google, etc.)
 * 
 * For native iOS/Android:
 * - When opened in SFSafariViewController/Chrome Custom Tabs, 
 *   the ?native=1 param triggers a redirect to custom URL scheme
 *   so the main WebView can receive the tokens.
 * 
 * For web:
 * - Standard session handling via Supabase client.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const isNativeFlow = searchParams.get("native") === "1";
        
        if (isNativeFlow) {
          // We're in SFSafariViewController / external browser
          // Extract tokens from URL hash or code from query params
          // and redirect to custom URL scheme so the WebView can handle them
          console.log("[AuthCallback] Native flow detected, redirecting to custom scheme");
          
          const hash = window.location.hash;
          const currentUrl = new URL(window.location.href);
          
          // Build custom scheme URL with all auth params
          let customUrl = "thepicklehub://auth/callback";
          
          // Check for code (PKCE flow)
          const code = currentUrl.searchParams.get("code");
          if (code) {
            customUrl += `?code=${encodeURIComponent(code)}`;
          }
          
          // Also pass hash params (implicit flow fallback)
          if (hash && hash.length > 1) {
            customUrl += (code ? "&" : "?") + "hash=" + encodeURIComponent(hash);
          }
          
          console.log("[AuthCallback] Redirecting to:", customUrl);
          
          // Small delay to ensure page is loaded
          setTimeout(() => {
            window.location.href = customUrl;
          }, 500);
          
          return;
        }
        
        // Web flow: standard session handling
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth callback error:", error);
          navigate("/login?error=auth_failed", { replace: true });
          return;
        }

        if (session) {
          const redirectTo = searchParams.get("redirect") || "/";
          navigate(redirectTo, { replace: true });
        } else {
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
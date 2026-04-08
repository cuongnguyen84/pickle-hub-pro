import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Auth Callback Page
 * 
 * For native iOS/Android:
 * - Supabase client auto-exchanges the PKCE code on page load.
 * - We listen for the session, then redirect via custom URL scheme
 *   with access_token + refresh_token so the WebView can set the session.
 * 
 * For web:
 * - Standard session handling via Supabase client.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handledRef = useRef(false);

  useEffect(() => {
    const isNativeFlow = searchParams.get("native") === "1";

    if (isNativeFlow) {
      console.log("[AuthCallback] Native flow detected, waiting for session...");

      // Function to redirect to app with tokens
      const redirectToApp = (accessToken: string, refreshToken: string) => {
        if (handledRef.current) return;
        handledRef.current = true;
        
        const customUrl = `thepicklehub://auth/callback?access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`;
        console.log("[AuthCallback] Redirecting to app with tokens");
        window.location.href = customUrl;
      };

      // Listen for auth state change (Supabase will fire this after exchanging the code)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log("[AuthCallback] Auth event in browser:", event, !!session);
        if (session?.access_token && session?.refresh_token) {
          subscription.unsubscribe();
          // Small delay to ensure Supabase finishes internal state
          setTimeout(() => {
            redirectToApp(session.access_token, session.refresh_token);
          }, 300);
        }
      });

      // Also check if session is already available (code may have been exchanged already)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token && session?.refresh_token) {
          subscription.unsubscribe();
          redirectToApp(session.access_token, session.refresh_token);
        }
      });

      // Safety timeout - if nothing happens after 10s, show error
      const timeout = setTimeout(() => {
        if (!handledRef.current) {
          console.error("[AuthCallback] Timeout waiting for session");
          // Try one more time
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.access_token && session?.refresh_token) {
              redirectToApp(session.access_token, session.refresh_token);
            } else {
              // Redirect to app without tokens - polling will handle it
              window.location.href = "thepicklehub://auth/callback?error=timeout";
            }
          });
        }
      }, 10000);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timeout);
      };
    }

    // Web flow: standard session handling
    const handleWebCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth callback error:", error);
          navigate("/login?error=auth_failed", { replace: true });
          return;
        }

        if (session) {
          const redirectTo = searchParams.get("redirect") || "/";

          // If redirect target is an external URL (cross-domain),
          // pass tokens so the target domain can restore the session
          if (/^https?:\/\//i.test(redirectTo)) {
            try {
              const targetUrl = new URL(redirectTo);
              const currentHost = window.location.hostname;

              // Only pass tokens when redirecting to a different domain
              if (targetUrl.hostname !== currentHost) {
                const tokenRedirectUrl = `${targetUrl.origin}/auth/callback#access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}&type=bearer&redirect=${encodeURIComponent(targetUrl.pathname + targetUrl.search)}`;
                console.log("[AuthCallback] Cross-domain redirect with tokens");
                window.location.replace(tokenRedirectUrl);
                return;
              }
            } catch {
              // Invalid URL, fall through to regular redirect
            }
            window.location.replace(redirectTo);
            return;
          }

          navigate(redirectTo, { replace: true });
        } else {
          navigate("/login", { replace: true });
        }
      } catch (err) {
        console.error("Auth callback exception:", err);
        navigate("/login?error=auth_failed", { replace: true });
      }
    };

    handleWebCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-foreground-muted">Đang xác thực...</p>
    </div>
  );
};

export default AuthCallback;
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

    // Check if this is a cross-domain token handoff (tokens in URL hash)
    const hashFragment = window.location.hash;
    const hasTokensInHash = hashFragment.includes("access_token=") && hashFragment.includes("refresh_token=");

    if (hasTokensInHash && !isNativeFlow) {
      console.log("[AuthCallback] Cross-domain token handoff detected");

      const hashParams = new URLSearchParams(hashFragment.substring(1));
      const redirectPath = hashParams.get("redirect") || "/";
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        // Manually set session with the received tokens
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).then(({ data, error }) => {
          if (handledRef.current) return;
          handledRef.current = true;

          if (error) {
            console.error("[AuthCallback] setSession error:", error);
          } else {
            console.log("[AuthCallback] Session restored on custom domain");
          }

          // Clear hash from URL and redirect
          window.history.replaceState(null, "", window.location.pathname);
          navigate(redirectPath, { replace: true });
        });
      } else {
        navigate("/", { replace: true });
      }

      // Safety timeout
      const timeout = setTimeout(() => {
        if (!handledRef.current) {
          handledRef.current = true;
          console.error("[AuthCallback] Token handoff timeout");
          navigate(redirectPath, { replace: true });
        }
      }, 5000);

      return () => clearTimeout(timeout);
    }

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

    // Web flow: wait for PKCE code exchange, then handle redirect
    const redirectTo = searchParams.get("redirect") || "/";

    const performRedirect = (session: { access_token: string; refresh_token: string }) => {
      if (handledRef.current) return;
      handledRef.current = true;

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
    };

    // Listen for auth state change (PKCE code exchange fires SIGNED_IN)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[AuthCallback] Web auth event:", event, !!session);
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        subscription.unsubscribe();
        performRedirect(session);
      }
    });

    // Also check if session is already available
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe();
        performRedirect(session);
      }
    });

    // Safety timeout
    const timeout = setTimeout(() => {
      if (!handledRef.current) {
        handledRef.current = true;
        subscription.unsubscribe();
        console.error("[AuthCallback] Web flow timeout");
        navigate(redirectTo, { replace: true });
      }
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-foreground-muted">Đang xác thực...</p>
    </div>
  );
};

export default AuthCallback;
import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DynamicMeta } from "@/components/seo";
import { Loader2 } from "lucide-react";

/**
 * Auth Callback Page — handles 3 flows:
 *
 * 1. NATIVE (iOS/Android): PKCE code exchange → deep link with tokens
 * 2. OAUTH BROKER RETURN (on pickle-hub-pro.lovable.app):
 *    Tokens in hash from OAuth broker + ?redirect=https://www.thepicklehub.net/
 *    → set session → cross-domain handoff to custom domain
 * 3. CROSS-DOMAIN HANDOFF RECEIVER (on thepicklehub.net):
 *    Tokens in hash from lovable.app handoff + redirect path in hash
 *    → setSession → navigate locally
 */

const CUSTOM_DOMAIN_HOSTNAMES = new Set(["thepicklehub.net", "www.thepicklehub.net"]);

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handledRef = useRef(false);

  useEffect(() => {
    const isNativeFlow = searchParams.get("native") === "1";
    const hashFragment = window.location.hash;
    const hasTokensInHash = hashFragment.includes("access_token=") && hashFragment.includes("refresh_token=");
    const currentHostname = window.location.hostname;
    const isOnCustomDomain = CUSTOM_DOMAIN_HOSTNAMES.has(currentHostname);

    // ─── FLOW 3: Cross-domain handoff RECEIVER (on custom domain) ───
    // URL: thepicklehub.net/auth/callback#access_token=...&refresh_token=...&redirect=/path
    if (hasTokensInHash && isOnCustomDomain && !isNativeFlow) {
      console.log("[AuthCallback] Cross-domain handoff receiver (custom domain)");

      const hashParams = new URLSearchParams(hashFragment.substring(1));
      const redirectPath = hashParams.get("redirect") || "/";
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).then(({ error }) => {
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

      const timeout = setTimeout(() => {
        if (!handledRef.current) {
          handledRef.current = true;
          navigate(redirectPath, { replace: true });
        }
      }, 5000);

      return () => clearTimeout(timeout);
    }

    // ─── FLOW 2: OAuth broker return (on lovable.app published domain) ───
    // URL: pickle-hub-pro.lovable.app/auth/callback?redirect=https://www.thepicklehub.net/#access_token=...
    if (hasTokensInHash && !isOnCustomDomain && !isNativeFlow) {
      console.log("[AuthCallback] OAuth broker return (published domain)");

      const hashParams = new URLSearchParams(hashFragment.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      // redirect is in query string, NOT in hash
      const redirectTo = searchParams.get("redirect") || "/";

      if (accessToken && refreshToken) {
        // Set session on this domain first
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).then(({ error }) => {
          if (handledRef.current) return;
          handledRef.current = true;

          if (error) {
            console.error("[AuthCallback] setSession error:", error);
            navigate("/", { replace: true });
            return;
          }

          console.log("[AuthCallback] Session set, checking cross-domain redirect to:", redirectTo);

          // If redirect target is a different domain, do cross-domain handoff
          if (/^https?:\/\//i.test(redirectTo)) {
            try {
              const targetUrl = new URL(redirectTo);
              if (targetUrl.hostname !== currentHostname) {
                const handoffUrl = `${targetUrl.origin}/auth/callback#access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&type=bearer&redirect=${encodeURIComponent(targetUrl.pathname + targetUrl.search)}`;
                console.log("[AuthCallback] Cross-domain handoff → custom domain");
                window.location.replace(handoffUrl);
                return;
              }
            } catch {
              // Invalid URL, fall through
            }
            window.location.replace(redirectTo);
            return;
          }

          navigate(redirectTo, { replace: true });
        });
      } else {
        navigate("/", { replace: true });
      }

      const timeout = setTimeout(() => {
        if (!handledRef.current) {
          handledRef.current = true;
          navigate("/", { replace: true });
        }
      }, 5000);

      return () => clearTimeout(timeout);
    }

    // ─── FLOW 1: Native app (PKCE) ───
    if (isNativeFlow) {
      console.log("[AuthCallback] Native flow detected, waiting for session...");

      const redirectToApp = (accessToken: string, refreshToken: string) => {
        if (handledRef.current) return;
        handledRef.current = true;
        const customUrl = `thepicklehub://auth/callback?access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`;
        console.log("[AuthCallback] Redirecting to app with tokens");
        window.location.href = customUrl;
      };

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.access_token && session?.refresh_token) {
          subscription.unsubscribe();
          setTimeout(() => redirectToApp(session.access_token, session.refresh_token), 300);
        }
      });

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token && session?.refresh_token) {
          subscription.unsubscribe();
          redirectToApp(session.access_token, session.refresh_token);
        }
      });

      const timeout = setTimeout(() => {
        if (!handledRef.current) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.access_token && session?.refresh_token) {
              redirectToApp(session.access_token, session.refresh_token);
            } else {
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

    // ─── FLOW 0: Standard web PKCE (no tokens in hash, no native) ───
    const redirectTo = searchParams.get("redirect") || "/";

    const performRedirect = (session: { access_token: string; refresh_token: string }) => {
      if (handledRef.current) return;
      handledRef.current = true;

      if (/^https?:\/\//i.test(redirectTo)) {
        try {
          const targetUrl = new URL(redirectTo);
          if (targetUrl.hostname !== currentHostname) {
            const handoffUrl = `${targetUrl.origin}/auth/callback#access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}&type=bearer&redirect=${encodeURIComponent(targetUrl.pathname + targetUrl.search)}`;
            console.log("[AuthCallback] Cross-domain redirect with tokens");
            window.location.replace(handoffUrl);
            return;
          }
        } catch {
          // fall through
        }
        window.location.replace(redirectTo);
        return;
      }

      navigate(redirectTo, { replace: true });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        subscription.unsubscribe();
        performRedirect(session);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe();
        performRedirect(session);
      }
    });

    const timeout = setTimeout(() => {
      if (!handledRef.current) {
        handledRef.current = true;
        subscription.unsubscribe();
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
      <DynamicMeta title="The Pickle Hub - Đăng nhập" noindex={true} />
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary mb-2">
        <span className="text-primary-foreground font-bold text-xl">TPH</span>
      </div>
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-foreground-muted">Đang xác thực...</p>
    </div>
  );
};

export default AuthCallback;

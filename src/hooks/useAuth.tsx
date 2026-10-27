import { createContext, useContext, useEffect, useMemo, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getEmailVerificationRedirectUrl } from "@/lib/auth-config";
import { purgeAuthSensitiveCaches } from "@/lib/pwa/cache";
import { reportCaughtError } from "@/lib/errorReporter";
import { trackEvent } from "@/utils/ga";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Upper bound on the initial session resolution. getSession() has no
// timeout of its own and can wedge indefinitely with a stored session —
// the auth lock held by another tab during a stalled token refresh, or
// the refresh request itself hanging (no fetch timeout anywhere). On
// 2026-10-27 that left /admin on its loading skeleton forever for the
// site owner: loading only cleared when getSession settled or an auth
// event fired, and neither happened. After this budget the provider
// stops blocking the UI (the session still applies if it lands later)
// and reports the stall so it stops being invisible.
export const AUTH_LOADING_TIMEOUT_MS = 8000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const signupTrackedRef = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let sessionSettled = false;
    const markSessionSettled = () => {
      sessionSettled = true;
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        markSessionSettled();
        console.log("[Auth] onAuthStateChange:", event);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // On ANY sign-out — manual, token expiry, revoke, or a sign-out in
        // another tab — drop all client-held user data. onAuthStateChange is
        // the single source of truth (fires for every path); doing this only
        // inside signOut() would miss the non-manual cases. Clears the React
        // Query cache (in-memory RLS data) + the auth-sensitive Cache Storage.
        if (event === "SIGNED_OUT") {
          queryClient.clear();
          void purgeAuthSensitiveCaches();
        }

        // Track sign_up for new users (created within last 2 minutes)
        // Handle both SIGNED_IN and INITIAL_SESSION (OAuth redirects may use either)
        if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user && !signupTrackedRef.current) {
          const createdAt = session.user.created_at;
          if (createdAt) {
            const ageMs = Date.now() - new Date(createdAt).getTime();
            if (ageMs < 120000) {
              signupTrackedRef.current = true;
              const method = session.user.app_metadata?.provider || "email";
              console.log("[GA4] sign_up event fired!", { method, ageMs });
              trackEvent("sign_up", { method });
              // Fallback: push to dataLayer directly
              if (window.dataLayer) {
                window.dataLayer.push({ event: "sign_up", method });
              }
            }
          }
        }
      }
    );

    // THEN check for existing session. The .catch matters as much as the
    // safety timer below: a rejected getSession (revoked/rotated refresh
    // token) previously left `loading` true forever with an unhandled
    // rejection as the only trace.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        markSessionSettled();
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch((err) => {
        markSessionSettled();
        reportCaughtError(
          err instanceof Error ? err : new Error(String(err)),
          "auth:getSession",
        );
        setLoading(false);
      });

    const safetyTimer = setTimeout(() => {
      if (!sessionSettled) {
        reportCaughtError(
          new Error(`auth session unresolved after ${AUTH_LOADING_TIMEOUT_MS}ms`),
          "auth:loadingTimeout",
        );
      }
      setLoading(false);
    }, AUTH_LOADING_TIMEOUT_MS);

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // Memoized so every consumer of useAuth() doesn't re-render whenever the
  // provider re-renders with unchanged auth state (HOT-05). The sign-in/up/out
  // functions only touch the module-level supabase client, so they are stable.
  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      loading,
      signIn: async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        return { error: error as Error | null };
      },
      signUp: async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getEmailVerificationRedirectUrl(),
          },
        });
        return { error: error as Error | null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [user, session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

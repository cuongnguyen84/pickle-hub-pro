import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const signupTrackedRef = useRef(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[Auth] onAuthStateChange:", event);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

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

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    // Use centralized auth config for email redirect
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://thepicklehub.net';
    const redirectUrl = `${siteUrl}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

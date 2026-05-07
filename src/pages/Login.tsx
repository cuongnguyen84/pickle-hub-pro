import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { DynamicMeta } from "@/components/seo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { trackEvent } from "@/utils/ga";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getEmailVerificationRedirectUrl, getPasswordResetRedirectUrl, getSiteUrl } from "@/lib/auth-config";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { isNativeApp } from "@/lib/capacitor-utils";
import { Browser } from "@capacitor/browser";
import { setOAuthInProgress } from "@/hooks/useDeepLinkHandler";
import "@/styles/the-line.css";

const Login = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  // Sprint 3 Phase 3A: post-auth redirect respects onboarding state.
  const { profile, isLoading: profileLoading } = useUserProfile();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const getOAuthErrorMessage = (error: unknown, fallback: string) => {
    return error instanceof Error ? error.message : fallback;
  };

  // Get redirect URL from query params
  const redirectUrl = searchParams.get("redirect");

  // Redirect if already logged in. Sprint 3 Phase 3A: incomplete onboarding
  // bounces the user to /onboarding instead of the requested redirect target.
  useEffect(() => {
    if (!user || authLoading) return;
    // Wait for profile fetch so we can read onboarding_completed_at.
    if (profileLoading) return;
    const onboarded = (
      profile as { onboarding_completed_at?: string | null } | null | undefined
    )?.onboarding_completed_at;
    const targetUrl = onboarded ? redirectUrl || "/" : "/onboarding";
    navigate(targetUrl, { replace: true });
  }, [user, authLoading, profileLoading, profile, navigate, redirectUrl]);

  // Pin TheLine theme tokens on the document while Login is mounted so the
  // page picks up data-theme="the-line" CSS without needing TheLineLayout
  // (Login has its own minimal chrome — just the back-to-home link).
  useEffect(() => {
    const root = document.documentElement;
    const prevTheme = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "the-line");
    return () => {
      if (prevTheme) root.setAttribute("data-theme", prevTheme);
      else root.removeAttribute("data-theme");
    };
  }, []);

  const handleResendVerification = async () => {
    if (!email) return;
    setResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
        options: {
          emailRedirectTo: getEmailVerificationRedirectUrl(),
        },
      });
      if (error) {
        toast({
          variant: "destructive",
          title: t.common.error,
          description: error.message,
        });
      } else {
        toast({
          title: t.auth.verificationSent,
          description: t.auth.verificationSentDesc,
        });
      }
    } finally {
      setResendingEmail(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: getPasswordResetRedirectUrl(),
      });
      if (error) {
        toast({ variant: "destructive", title: t.common.error, description: error.message });
      } else {
        setResetSent(true);
        toast({ title: t.auth.resetPasswordSent, description: t.auth.resetPasswordSentDesc });
      }
    } finally {
      setSendingReset(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);

    try {
      const redirectTo = isNativeApp()
        ? `${getSiteUrl()}/auth/callback?native=1`
        : `${getSiteUrl()}/auth/callback`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: isNativeApp(),
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) throw error;

      if (isNativeApp() && data?.url) {
        setOAuthInProgress(true);
        await Browser.open({ url: data.url, presentationStyle: 'popover' });
      }
    } catch (err: unknown) {
      console.error("[OAuth] Error:", err);
      toast({
        variant: "destructive",
        title: t.common.error,
        description: getOAuthErrorMessage(err, "Google Sign-In failed"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsSubmitting(true);
    try {
      const redirectTo = isNativeApp()
        ? `${getSiteUrl()}/auth/callback?native=1`
        : `${getSiteUrl()}/auth/callback`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo,
          skipBrowserRedirect: isNativeApp(),
        },
      });

      if (error) throw error;

      if (isNativeApp() && data?.url) {
        setOAuthInProgress(true);
        await Browser.open({ url: data.url, presentationStyle: 'popover' });
      }
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t.common.error,
        description: getOAuthErrorMessage(err, "Apple Sign-In failed"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsSubmitting(true);
    setShowVerificationMessage(false);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          // Check if the error is about email not confirmed
          if (error.message.includes("Email not confirmed")) {
            setShowVerificationMessage(true);
            toast({
              variant: "destructive",
              title: t.auth.emailNotVerified,
              description: t.auth.emailNotVerifiedDesc,
            });
          } else {
            toast({
              variant: "destructive",
              title: t.auth.invalidCredentials,
              description: error.message,
            });
          }
        } else {
          toast({
            title: t.auth.loginSuccess,
          });
          // Redirect handled by the post-auth useEffect above (which checks
          // onboarding_completed_at via useUserProfile). Removing the manual
          // navigate here so unboarded users are bounced to /onboarding
          // instead of "/".
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          // Handle "User already registered" error
          if (error.message.includes("already registered")) {
            toast({
              variant: "destructive",
              title: t.auth.emailAlreadyUsed,
              description: t.auth.emailAlreadyUsedDesc,
            });
          } else {
            toast({
              variant: "destructive",
              title: t.common.error,
              description: error.message,
            });
          }
        } else {
          // Show verification message since email confirmation is required
          setShowVerificationMessage(true);
          
          // GA4 sign_up tracking - multiple methods for reliability
          console.log("[GA4] === SIGN_UP EVENT START ===");
          console.log("[GA4] gtag available:", typeof window.gtag === 'function');
          console.log("[GA4] dataLayer available:", !!window.dataLayer);
          
          // Method 1: trackEvent helper
          trackEvent("sign_up", { method: "email" });
          
          // Method 2: Direct gtag call
          if (typeof window.gtag === 'function') {
            window.gtag('event', 'sign_up', { method: 'email' });
            console.log("[GA4] sign_up fired via gtag directly");
          }
          
          // Method 3: dataLayer push
          if (window.dataLayer) {
            window.dataLayer.push({ event: "sign_up", method: "email" });
            console.log("[GA4] sign_up pushed to dataLayer");
          }
          
          console.log("[GA4] === SIGN_UP EVENT END ===");
          
          toast({
            title: t.auth.signupSuccess,
          });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div
        className="tl-root"
        style={{ background: "var(--tl-bg)", color: "var(--tl-fg)" }}
      >
        <div className="tl-scroll">
          <div
            style={{
              minHeight: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Loader2
              className="w-8 h-8 animate-spin"
              style={{ color: "var(--tl-fg-3)" }}
            />
          </div>
        </div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid var(--tl-border)",
    borderRadius: 0,
    padding: "12px 0",
    fontSize: 18,
    fontFamily: "inherit",
    color: "var(--tl-fg)",
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "'Geist Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--tl-fg-3)",
    marginBottom: 8,
  };

  return (
    // tl-root + tl-scroll wrap is required because production html/body/#root
    // are position:fixed; overflow:hidden (native-shell model — see the-line.css
    // line 2569). Without our own scroll container the page can't scroll past
    // the viewport on either desktop or mobile.
    <div
      className="tl-root"
      style={{ background: "var(--tl-bg)", color: "var(--tl-fg)" }}
    >
      <DynamicMeta title={isLogin ? t.auth.login : t.auth.signup} noindex={true} />

      <div className="tl-scroll">
        <div
          style={{
            minHeight: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
      <header style={{ padding: 16 }}>
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "var(--tl-fg-3)",
            fontSize: 13,
            textDecoration: "none",
            fontFamily: "'Geist Mono', monospace",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.errors.goHome}</span>
        </Link>
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ width: "100%", maxWidth: 420 }}>
          {/* Wordmark */}
          <Link
            to="/"
            style={{
              display: "block",
              textAlign: "center",
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: 32,
              color: "var(--tl-fg)",
              textDecoration: "none",
              marginBottom: 32,
              letterSpacing: "-0.015em",
            }}
            aria-label="The PickleHub"
          >
            The <em>Pickle</em>
            <span style={{ fontStyle: "normal", fontFamily: "'Geist', sans-serif" }}>
              Hub
            </span>
          </Link>

          <div className="tl-eyebrow" style={{ justifyContent: "center" }}>
            <span className="pip" />
            <span>{isLogin ? "ĐĂNG NHẬP" : "ĐĂNG KÝ"}</span>
          </div>

          <h1
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: "clamp(40px, 6vw, 64px)",
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: "var(--tl-fg)",
              margin: "0 0 8px",
              textAlign: "center",
            }}
          >
            {isLogin ? "Đăng nhập" : "Đăng ký"}.
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--tl-fg-2)",
              textAlign: "center",
              margin: "0 0 32px",
            }}
          >
            Pickleball, một tài khoản — mọi giải.
          </p>

          {/* Verification Message */}
          {showVerificationMessage && (
            <div
              style={{
                padding: 16,
                borderTop: "1px solid var(--tl-green)",
                borderBottom: "1px solid var(--tl-border)",
                marginBottom: 24,
              }}
            >
              <p style={{ fontSize: 14, color: "var(--tl-fg)", margin: "0 0 12px" }}>
                {isLogin ? t.auth.emailNotVerifiedDesc : t.auth.verificationSentDesc}
              </p>
              <button
                type="button"
                className="tl-btn"
                onClick={handleResendVerification}
                disabled={resendingEmail || !email}
              >
                {resendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t.common.loading}
                  </>
                ) : (
                  t.auth.resendVerification
                )}
              </button>
            </div>
          )}

          {/* OAuth */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              type="button"
              className="tl-btn"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              style={{ width: "100%", justifyContent: "center", padding: "12px 18px" }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Tiếp tục với Google
            </button>

            <button
              type="button"
              className="tl-btn"
              onClick={handleAppleSignIn}
              disabled={isSubmitting}
              style={{ width: "100%", justifyContent: "center", padding: "12px 18px" }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Đăng nhập với Apple
            </button>
          </div>

          {/* Editorial divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "28px 0",
              fontFamily: "'Geist Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--tl-fg-4)",
            }}
          >
            <span style={{ flex: 1, height: 1, background: "var(--tl-border)" }} />
            <span>HOẶC TIẾP TỤC VỚI EMAIL</span>
            <span style={{ flex: 1, height: 1, background: "var(--tl-border)" }} />
          </div>

          {/* Email/password form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <Label htmlFor="email" style={labelStyle}>{t.auth.email}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
                disabled={isSubmitting}
                style={inputStyle}
              />
            </div>

            <div>
              <Label htmlFor="password" style={labelStyle}>Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={8}
                disabled={isSubmitting}
                style={inputStyle}
              />
              {!isLogin && password.length > 0 && password.length < 8 && (
                <p
                  style={{
                    fontFamily: "'Instrument Serif', serif",
                    fontStyle: "italic",
                    fontSize: 13,
                    color: "var(--tl-red, #ef4444)",
                    marginTop: 6,
                  }}
                >
                  Mật khẩu cần ít nhất 8 ký tự
                </p>
              )}
            </div>

            {isLogin && (
              <div style={{ textAlign: "right", marginTop: -12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setResetSent(false);
                    setShowForgotPassword(true);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--tl-fg-3)",
                    fontFamily: "'Instrument Serif', serif",
                    fontStyle: "italic",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Quên mật khẩu?
                </button>
              </div>
            )}

            <button
              type="submit"
              className="tl-btn primary"
              disabled={isSubmitting}
              style={{ width: "100%", justifyContent: "center", padding: "12px 18px" }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t.common.loading}
                </>
              ) : isLogin ? (
                "Đăng nhập"
              ) : (
                "Đăng ký"
              )}
            </button>
          </form>

          {/* Toggle login/signup */}
          <p
            style={{
              textAlign: "center",
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontSize: 15,
              color: "var(--tl-fg-3)",
              margin: "24px 0 12px",
            }}
          >
            {isLogin ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setShowVerificationMessage(false);
              }}
              disabled={isSubmitting}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--tl-green)",
                fontFamily: "inherit",
                fontStyle: "italic",
                fontSize: 15,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              {isLogin ? "Đăng ký" : "Đăng nhập"}
            </button>
          </p>

          {/* Privacy */}
          <p
            style={{
              textAlign: "center",
              fontFamily: "'Geist Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--tl-fg-4)",
              marginTop: 16,
            }}
          >
            <Link
              to="/privacy"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              CHÍNH SÁCH BẢO MẬT
            </Link>
          </p>
        </div>
      </main>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <AlertDialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.auth.forgotPassword}</AlertDialogTitle>
            <AlertDialogDescription>
              {resetSent ? t.auth.resetPasswordSentDesc : t.auth.forgotPasswordDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!resetSent && (
            <div className="space-y-2 py-2">
              <Label htmlFor="forgot-email">{t.auth.email}</Label>
              <Input
                id="forgot-email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{resetSent ? t.common.close : t.common.cancel}</AlertDialogCancel>
            {!resetSent && (
              <AlertDialogAction onClick={handleForgotPassword} disabled={sendingReset || !forgotEmail}>
                {sendingReset && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t.auth.resetPassword}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Login;

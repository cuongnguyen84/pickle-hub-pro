import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Mail, Lock, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    user,
    loading: authLoading,
    signIn,
    signUp
  } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  // Get redirect URL from query params
  const redirectUrl = searchParams.get('redirect');

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      // Redirect to saved URL or home
      const targetUrl = redirectUrl || "/";
      navigate(targetUrl, { replace: true });
    }
  }, [user, authLoading, navigate, redirectUrl]);

  const handleResendVerification = async () => {
    if (!email) return;
    setResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        }
      });
      if (error) {
        toast({
          variant: "destructive",
          title: t.common.error,
          description: error.message
        });
      } else {
        toast({
          title: t.auth.verificationSent,
          description: t.auth.verificationSentDesc
        });
      }
    } finally {
      setResendingEmail(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${redirectUrl || '/'}`,
        }
      });
      if (error) {
        toast({
          variant: "destructive",
          title: t.common.error,
          description: error.message
        });
      }
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
              description: t.auth.emailNotVerifiedDesc
            });
          } else {
            toast({
              variant: "destructive",
              title: t.auth.invalidCredentials,
              description: error.message
            });
          }
        } else {
          toast({
            title: t.auth.loginSuccess
          });
          // Redirect to saved URL or home
          const targetUrl = redirectUrl || "/";
          navigate(targetUrl, { replace: true });
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          // Handle "User already registered" error
          if (error.message.includes("already registered")) {
            toast({
              variant: "destructive",
              title: t.auth.emailAlreadyUsed,
              description: t.auth.emailAlreadyUsedDesc
            });
          } else {
            toast({
              variant: "destructive",
              title: t.common.error,
              description: error.message
            });
          }
        } else {
          // Show verification message since email confirmation is required
          setShowVerificationMessage(true);
          toast({
            title: t.auth.signupSuccess
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-4">
        <Link to="/" className="inline-flex items-center gap-2 text-foreground-secondary hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">{t.errors.goHome}</span>
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          {/* Logo */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
              <span className="text-primary-foreground font-bold text-lg">TPH</span>
            </div>
            <h1 className="text-2xl font-semibold text-foreground">
              {isLogin ? t.auth.login : t.auth.signup}
            </h1>
          </div>

          {/* Verification Message */}
          {showVerificationMessage && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm text-foreground mb-3">
                {isLogin ? t.auth.emailNotVerifiedDesc : t.auth.verificationSentDesc}
              </p>
              <Button
                variant="outline"
                size="sm"
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
              </Button>
            </div>
          )}

          {/* Google Sign In */}
          <Button
            variant="outline"
            className="w-full gap-3"
            size="lg"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {t.auth.continueWithGoogle}
          </Button>

          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-sm text-foreground-muted">{t.auth.orContinueWith}</span>
            <Separator className="flex-1" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t.auth.email}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  placeholder="email@example.com"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t.auth.password}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  placeholder="••••••••••••"
                  required
                  minLength={8}
                  disabled={isSubmitting}
                />
                {!isLogin && password.length > 0 && password.length < 8 && (
                  <p className="text-xs text-destructive mt-1">
                    Password must be at least 8 characters
                  </p>
                )}
              </div>
            </div>

            {isLogin && (
              <div className="text-right">
                <button type="button" className="text-sm text-primary hover:underline">
                  {t.auth.forgotPassword}
                </button>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t.common.loading}
                </>
              ) : isLogin ? (
                t.auth.login
              ) : (
                t.auth.signup
              )}
            </Button>
          </form>

          {/* Toggle login/signup */}
          <p className="text-center text-sm text-foreground-secondary">
            {isLogin ? t.auth.noAccount : t.auth.hasAccount}{" "}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setShowVerificationMessage(false);
              }}
              className="text-primary hover:underline font-medium"
              disabled={isSubmitting}
            >
              {isLogin ? t.nav.signup : t.nav.login}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Login;
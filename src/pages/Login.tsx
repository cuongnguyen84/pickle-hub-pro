import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Mail, Lock, ArrowLeft, Loader2 } from "lucide-react";

const Login = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate("/", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) return;
    
    setIsSubmitting(true);
    
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            variant: "destructive",
            title: t.auth.invalidCredentials,
            description: error.message,
          });
        } else {
          toast({
            title: t.auth.loginSuccess,
          });
          navigate("/", { replace: true });
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          // Handle "User already registered" error
          if (error.message.includes("already registered")) {
            toast({
              variant: "destructive",
              title: "Email đã được sử dụng",
              description: "Vui lòng đăng nhập hoặc sử dụng email khác.",
            });
          } else {
            toast({
              variant: "destructive",
              title: t.common.error,
              description: error.message,
            });
          }
        } else {
          toast({
            title: t.auth.signupSuccess,
          });
          // Auto-confirm is enabled, so user will be logged in automatically
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
        <div className="w-full max-w-sm space-y-8">
          {/* Logo */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
              <span className="text-primary-foreground font-bold text-lg">PH</span>
            </div>
            <h1 className="text-2xl font-semibold text-foreground">
              {isLogin ? t.auth.login : t.auth.signup}
            </h1>
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
              ) : (
                isLogin ? t.auth.login : t.auth.signup
              )}
            </Button>
          </form>

          {/* Toggle login/signup */}
          <p className="text-center text-sm text-foreground-secondary">
            {isLogin ? t.auth.noAccount : t.auth.hasAccount}{" "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
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

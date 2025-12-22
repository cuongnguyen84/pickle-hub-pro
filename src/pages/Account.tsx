import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useI18n } from "@/i18n";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { 
  User, 
  LogOut, 
  Palette, 
  Shield, 
  Loader2,
  Mail,
  UserCircle
} from "lucide-react";
import { useEffect } from "react";

const Account = () => {
  const { t } = useI18n();
  const { user, signOut, loading: authLoading } = useAuth();
  const { isCreator, isLoading: creatorLoading } = useCreatorAuth();
  const { isAdmin, isLoading: adminLoading } = useAdminAuth();
  const navigate = useNavigate();

  const isLoading = authLoading || creatorLoading || adminLoading;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, isLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return null;
  }

  // Determine role display
  const getRoleDisplay = () => {
    if (isAdmin) return { label: "Admin", color: "bg-destructive/20 text-destructive" };
    if (isCreator) return { label: "Creator", color: "bg-primary/20 text-primary" };
    return { label: "Viewer", color: "bg-muted text-foreground-secondary" };
  };

  const role = getRoleDisplay();

  return (
    <MainLayout>
      <div className="container-narrow py-8">
        <div className="max-w-md mx-auto">
          {/* Profile Card */}
          <div className="glass-card p-6 md:p-8">
            {/* Avatar */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <User className="w-10 h-10 text-primary" />
              </div>
              
              {/* Display Name */}
              <h1 className="text-xl font-semibold text-foreground text-center">
                {user.email?.split("@")[0]}
              </h1>
              
              {/* Role Badge */}
              <span className={`mt-2 px-3 py-1 rounded-full text-xs font-medium ${role.color}`}>
                {role.label}
              </span>
            </div>

            {/* User Info */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Mail className="w-5 h-5 text-foreground-secondary" />
                <div>
                  <p className="text-xs text-foreground-muted">Email</p>
                  <p className="text-sm text-foreground">{user.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <UserCircle className="w-5 h-5 text-foreground-secondary" />
                <div>
                  <p className="text-xs text-foreground-muted">{t.admin.user.role}</p>
                  <p className="text-sm text-foreground">{role.label}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Creator Studio Button */}
              {isCreator && (
                <Button
                  onClick={() => navigate("/creator")}
                  className="w-full"
                  variant="outline"
                >
                  <Palette className="w-4 h-4 mr-2" />
                  {t.nav.creator}
                </Button>
              )}

              {/* Admin Dashboard Button */}
              {isAdmin && (
                <Button
                  onClick={() => navigate("/admin")}
                  className="w-full"
                  variant="outline"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  {t.nav.admin}
                </Button>
              )}

              {/* Logout Button */}
              <Button
                onClick={handleSignOut}
                className="w-full"
                variant="destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t.nav.logout}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Account;

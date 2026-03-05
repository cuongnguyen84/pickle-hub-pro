import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useRef, useState } from "react";
import { getLoginUrl } from "@/lib/auth-config";
import { useAuth } from "@/hooks/useAuth";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useI18n } from "@/i18n";
import MainLayout from "@/components/layout/MainLayout";
import { DynamicMeta } from "@/components/seo";
import { UserAvatar } from "@/components/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteAccountDialog } from "@/components/account/DeleteAccountDialog";
import { 
  LogOut, 
  Palette, 
  Shield, 
  Loader2,
  Mail,
  UserCircle,
  Camera,
  Edit2,
  Check,
  X,
  KeyRound
} from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Account = () => {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user, signOut, loading: authLoading } = useAuth();
  const { isCreator, isLoading: creatorLoading } = useCreatorAuth();
  const { isAdmin, isLoading: adminLoading } = useAdminAuth();
  const { profile, isLoading: profileLoading, uploadAvatar, updateProfile } = useUserProfile();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = authLoading || creatorLoading || adminLoading || profileLoading;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate(getLoginUrl(location.pathname + location.search), { replace: true });
    }
  }, [user, isLoading, navigate, location]);

  useEffect(() => {
    if (profile?.display_name) {
      setDisplayNameInput(profile.display_name);
    }
  }, [profile?.display_name]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        return;
      }
      uploadAvatar.mutate(file);
    }
  };

  const handleSaveDisplayName = () => {
    if (displayNameInput.trim()) {
      updateProfile.mutate({ display_name: displayNameInput.trim() });
      setIsEditingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: t.account.passwordTooShort, variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t.account.passwordMismatch, variant: "destructive" });
      return;
    }
    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: t.account.passwordChanged });
      setShowChangePassword(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast({ title: t.account.passwordChangeError, variant: "destructive" });
    } finally {
      setIsChangingPassword(false);
    }
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

  const getRoleDisplay = () => {
    if (isAdmin) return { label: "Admin", color: "bg-destructive/20 text-destructive" };
    if (isCreator) return { label: "Creator", color: "bg-primary/20 text-primary" };
    return { label: "Viewer", color: "bg-muted text-foreground-secondary" };
  };

  const role = getRoleDisplay();
  const displayName = profile?.display_name || user.email?.split("@")[0] || "User";

  return (
    <MainLayout>
      <DynamicMeta title="Tài khoản" noindex={true} />
      <div className="container-narrow py-8">
        <div className="max-w-md mx-auto">
          {/* Profile Card */}
          <div className="glass-card p-6 md:p-8">
            {/* Avatar */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative group">
                <UserAvatar
                  avatarUrl={profile?.avatar_url}
                  displayName={displayName}
                  isCreator={isCreator}
                  size="xl"
                  showBadge={true}
                />
                <button
                  onClick={handleAvatarClick}
                  className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  disabled={uploadAvatar.isPending}
                >
                  {uploadAvatar.isPending ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              
              {/* Display Name */}
              <div className="mt-4 flex items-center gap-2">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      className="h-8 w-40 text-center"
                      placeholder="Tên hiển thị"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={handleSaveDisplayName}
                      disabled={updateProfile.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setIsEditingName(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-semibold text-foreground text-center">
                      {displayName}
                    </h1>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setIsEditingName(true)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              
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

              {/* Change Password */}
              <Button
                onClick={() => setShowChangePassword(!showChangePassword)}
                className="w-full"
                variant="outline"
              >
                <KeyRound className="w-4 h-4 mr-2" />
                {t.account.changePassword}
              </Button>

              {showChangePassword && (
                <div className="space-y-3 p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-foreground-muted">{t.account.changePasswordDescription}</p>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">{t.account.newPassword}</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">{t.account.confirmNewPassword}</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••"
                    />
                  </div>
                  <Button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !newPassword || !confirmPassword}
                    className="w-full"
                  >
                    {isChangingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t.account.changePassword}
                  </Button>
                </div>
              )}

              {/* Logout Button */}
              <Button
                onClick={handleSignOut}
                className="w-full"
                variant="outline"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t.nav.logout}
              </Button>

              {/* Delete Account - Apple Guideline 5.1.1 */}
              <div className="pt-4 border-t border-border">
                <DeleteAccountDialog />
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Account;

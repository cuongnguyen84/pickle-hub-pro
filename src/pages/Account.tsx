import { useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useDeleteAccount } from "@/hooks/useDeleteAccount";
import { useI18n } from "@/i18n";
import MainLayout from "@/components/layout/MainLayout";
import { DynamicMeta } from "@/components/seo";
import { UserAvatar } from "@/components/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  Trash2,
  AlertTriangle
} from "lucide-react";
import { useEffect } from "react";

const Account = () => {
  const { t } = useI18n();
  const { user, signOut, loading: authLoading } = useAuth();
  const { isCreator, isLoading: creatorLoading } = useCreatorAuth();
  const { isAdmin, isLoading: adminLoading } = useAdminAuth();
  const { profile, isLoading: profileLoading, uploadAvatar, updateProfile } = useUserProfile();
  const deleteAccount = useDeleteAccount();
  const navigate = useNavigate();
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = authLoading || creatorLoading || adminLoading || profileLoading;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, isLoading, navigate]);

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
      // Validate file size (max 2MB)
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
                
                {/* Upload overlay */}
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
                variant="outline"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t.nav.logout}
              </Button>

              {/* Delete Account */}
              <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogTrigger asChild>
                  <Button
                    className="w-full"
                    variant="destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t.account.deleteAccount}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      {t.account.deleteAccountConfirm}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-4">
                      <p>{t.account.deleteAccountWarning}</p>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-delete">
                          {t.account.typeToConfirm.replace("{text}", t.account.confirmText)}
                        </Label>
                        <Input
                          id="confirm-delete"
                          value={confirmDeleteText}
                          onChange={(e) => setConfirmDeleteText(e.target.value)}
                          placeholder={t.account.confirmText}
                        />
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setConfirmDeleteText("")}>
                      {t.common.cancel}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteAccount.mutate()}
                      disabled={confirmDeleteText !== t.account.confirmText || deleteAccount.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteAccount.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      {t.account.deleteAccount}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Account;

import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Building2,
  Users,
  Trophy,
  Shield,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Key,
  Eye,
  Bell,
  MessageSquare,
  ScrollText,
  Flag,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { getLoginUrl } from "@/lib/auth-config";
import { cn } from "@/lib/utils";
import { isIOS, isNativeApp, isAndroid } from "@/lib/capacitor-utils";

interface AdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: "/admin", icon: LayoutDashboard, labelKey: "overview" as const },
  { path: "/admin/organizations", icon: Building2, labelKey: "organizations" as const },
  { path: "/admin/users", icon: Users, labelKey: "users" as const },
  { path: "/admin/tournaments", icon: Trophy, labelKey: "tournaments" as const },
  { path: "/admin/moderation", icon: Shield, labelKey: "moderation" as const },
  { path: "/admin/reports", icon: Flag, labelKey: "reports" as const },
  { path: "/admin/api-keys", icon: Key, labelKey: "apiKeys" as const },
  { path: "/admin/viewers", icon: Eye, labelKey: "viewers" as const },
  { path: "/admin/push", icon: Bell, labelKey: "push" as const },
  { path: "/admin/forum", icon: MessageSquare, labelKey: "forum" as const },
  { path: "/admin/audit-log", icon: ScrollText, labelKey: "auditLog" as const },
];

// Bottom tab items for mobile - show the most used ones
const mobileTabItems = [
  { path: "/admin", icon: LayoutDashboard, label: "Tổng quan", exact: true },
  { path: "/admin/organizations", icon: Building2, label: "Tổ chức" },
  { path: "/admin/users", icon: Users, label: "Users" },
  { path: "/admin/moderation", icon: Shield, label: "Kiểm duyệt" },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const { t } = useI18n();
  const { isAdmin, isLoading, isAuthenticated } = useAdminAuth();
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isIOSDevice = isIOS();
  const isAndroidDevice = isAndroid();
  const isNative = isNativeApp();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate(getLoginUrl(location.pathname), { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate, location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">{t.auth.accessDenied}</h1>
          <p className="text-foreground-muted mb-6">
            Bạn không có quyền truy cập trang quản trị này.
          </p>
          <Button onClick={() => navigate("/")} variant="outline">
            <ChevronLeft className="w-4 h-4 mr-2" />
            {t.errors.goHome}
          </Button>
        </div>
      </div>
    );
  }

  const getNavLabel = (key: string) => {
    const labels: Record<string, string> = {
      overview: t.admin.overview,
      organizations: t.admin.organizations,
      users: t.admin.users,
      tournaments: t.admin.tournaments,
      moderation: t.admin.moderation.title,
      reports: "Báo cáo",
      apiKeys: "API Keys",
      viewers: t.admin.viewers.title,
      push: "Push",
      forum: t.forum.title,
      auditLog: t.admin.auditLog?.title || "Audit Log",
    };
    return labels[key] || key;
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  // Items not shown in bottom tab (for the "more" drawer)
  const moreNavItems = navItems.filter(
    (item) => !mobileTabItems.some((tab) => tab.path === item.path)
  );

  const isMoreActive = moreNavItems.some(
    (item) => location.pathname === item.path
  );

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-14 flex items-center gap-4 px-4"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
        <span className="font-semibold">{t.admin.dashboard}</span>
      </header>

      {/* Mobile spacer for fixed header */}
      <div className="lg:hidden h-14 flex-shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Drawer - shows remaining nav items + logout */}
      {sidebarOpen && (
        <aside
          className="fixed top-14 left-0 z-50 w-64 bg-surface border-r border-border-subtle flex flex-col lg:hidden shadow-xl"
          style={{ 
            top: 'calc(3.5rem + env(safe-area-inset-top))',
            height: 'calc(100vh - 3.5rem - env(safe-area-inset-top))' 
          }}
        >
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground-secondary hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {getNavLabel(item.labelKey)}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-border-subtle space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start text-foreground-secondary hover:text-foreground"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5 mr-3" />
              {t.nav.logout}
            </Button>
            <Link to="/" onClick={() => setSidebarOpen(false)}>
              <Button
                variant="ghost"
                className="w-full justify-start text-foreground-secondary hover:text-foreground"
              >
                <ChevronLeft className="w-5 h-5 mr-3" />
                {t.errors.goHome}
              </Button>
            </Link>
          </div>
        </aside>
      )}

      {/* Mobile Bottom Tab Nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[9999] lg:hidden bg-background-elevated border-t border-border-subtle"
        style={{
          paddingBottom: (isAndroidDevice && isNative)
            ? 'max(env(safe-area-inset-bottom, 14px), 14px)'
            : isIOSDevice
              ? 'env(safe-area-inset-bottom, 0px)'
              : '0px',
        }}
      >
        <div
          className="flex items-stretch justify-around"
          style={{ minHeight: isIOSDevice ? '68px' : (isAndroidDevice && isNative) ? '72px' : '56px' }}
        >
          {mobileTabItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 flex-1 py-3",
                  "transition-colors duration-200",
                  isActive
                    ? "text-primary"
                    : "text-foreground-muted hover:text-foreground-secondary"
                )}
              >
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* More button to open sidebar */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 flex-1 py-3",
              "transition-colors duration-200",
              isMoreActive
                ? "text-primary"
                : "text-foreground-muted hover:text-foreground-secondary"
            )}
          >
            <MoreHorizontal className="w-6 h-6" strokeWidth={isMoreActive ? 2.5 : 1.8} />
            <span className="text-[10px] font-medium">Thêm</span>
          </button>
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex sticky top-0 left-0 h-screen w-64 bg-sidebar-background border-r border-sidebar-border flex-col">
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          <Link to="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sidebar-foreground">Admin</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {getNavLabel(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-3" />
            {t.nav.logout}
          </Button>
          <Link to="/">
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground mt-1"
            >
              <ChevronLeft className="w-5 h-5 mr-3" />
              {t.errors.goHome}
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto pb-24 lg:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}

import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import { cn } from "@/lib/utils";
import { getLoginUrl } from "@/lib/auth-config";
import { isIOS, isNativeApp, isAndroid } from "@/lib/capacitor-utils";
import {
  LayoutDashboard,
  Video,
  Radio,
  Settings,
  ChevronLeft,
  Menu,
  X,
  AlertTriangle,
  Loader2,
  BarChart3,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreatorLayoutProps {
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
}

const sidebarLinks = [
  { path: "/creator", label: "Overview", icon: LayoutDashboard, exact: true },
  { path: "/creator/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/creator/videos", label: "Videos", icon: Video },
  { path: "/creator/livestreams", label: "Livestreams", icon: Radio },
  { path: "/creator/tournaments", label: "Tournaments", icon: Trophy },
  { path: "/creator/settings", label: "Settings", icon: Settings },
];

export function CreatorLayout({ children, title, actions }: CreatorLayoutProps) {
  const { isCreator, isLoading, isAuthenticated, hasOrganization } = useCreatorAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isIOSDevice = isIOS();
  const isAndroidDevice = isAndroid();
  const isNative = isNativeApp();
  const mobileBottomNavOffset = (isAndroidDevice && isNative)
    ? 'calc(72px + max(env(safe-area-inset-bottom, 14px), 14px))'
    : isIOSDevice
      ? 'calc(68px + env(safe-area-inset-bottom, 0px))'
      : '56px';

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-foreground-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    navigate(getLoginUrl(location.pathname), { replace: true });
    return null;
  }

  // Not a creator
  if (!isCreator) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-card p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Bạn không có quyền truy cập
          </h1>
          <p className="text-foreground-secondary mb-6">
            Trang này chỉ dành cho Creator và Admin.
          </p>
          <Button onClick={() => navigate("/")} variant="outline">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Về trang chủ
          </Button>
        </div>
      </div>
    );
  }

  // No organization assigned
  if (!hasOrganization) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-card p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-warning" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Tài khoản chưa được gán Organization
          </h1>
          <p className="text-foreground-secondary mb-6">
            Vui lòng liên hệ admin để được gán organization trước khi tạo nội dung.
          </p>
          <Button onClick={() => navigate("/")} variant="outline">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Về trang chủ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] min-h-0 w-full bg-background flex flex-col lg:flex-row overflow-hidden">
      {/* Mobile Header with menu toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border-subtle pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between h-14 px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 -ml-2 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-muted transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link to="/" className="flex items-center gap-2 text-foreground font-semibold">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">PH</span>
            </div>
            <span className="text-sm">Creator Studio</span>
          </Link>
          <div className="w-9" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Mobile Tab Navigation */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[9999] bg-background-elevated border-t border-border-subtle"
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
          {sidebarLinks.map((link) => {
            const isActive = link.exact
              ? location.pathname === link.path
              : location.pathname.startsWith(link.path);
            const Icon = link.icon;
            
            return (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 flex-1 py-3",
                  "transition-colors duration-200",
                  isActive
                    ? "text-primary"
                    : "text-foreground-muted hover:text-foreground-secondary"
                )}
              >
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Desktop only */}
      <aside className="hidden lg:flex sticky top-0 left-0 h-screen w-64 bg-surface border-r border-border-subtle flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border-subtle">
          <Link to="/" className="flex items-center gap-2 text-foreground font-semibold">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">PH</span>
            </div>
            <span>Creator Studio</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {sidebarLinks.map((link) => {
            const isActive = link.exact
              ? location.pathname === link.path
              : location.pathname.startsWith(link.path);

            return (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground-secondary hover:text-foreground hover:bg-muted"
                )}
              >
                <link.icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Back to site */}
        <div className="p-4 border-t border-border-subtle">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-foreground-secondary hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Về trang chủ
          </Link>
        </div>
      </aside>

      {/* Mobile Drawer - Only Home link */}
      {sidebarOpen && (
        <aside
          className="fixed left-0 z-50 w-64 bg-surface border-r border-border-subtle flex flex-col lg:hidden shadow-xl"
          style={{
            top: 'calc(3.5rem + env(safe-area-inset-top))',
            bottom: mobileBottomNavOffset,
          }}
        >
          <nav className="p-4">
            <Link
              to="/"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-foreground-secondary hover:text-foreground hover:bg-muted"
            >
              <ChevronLeft className="w-5 h-5" />
              Về trang chủ
            </Link>
          </nav>
        </aside>
      )}

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-24 lg:pb-0">
        <div className="p-4 lg:p-8">
          {/* Page Header - Mobile friendly */}
          {(title || actions) && (
            <div className="mb-6">
              {title && (
                <h1 className="text-xl lg:text-2xl font-bold text-foreground mb-4 lg:mb-0">
                  {title}
                </h1>
              )}
              {actions && (
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 lg:mt-0 lg:absolute lg:top-8 lg:right-8">
                  {actions}
                </div>
              )}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

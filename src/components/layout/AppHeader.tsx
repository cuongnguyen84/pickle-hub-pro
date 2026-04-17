import { Link, useLocation } from "react-router-dom";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Menu, X, Search, LogIn, LogOut, User, Palette, Shield, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/notifications";
import { getLoginUrl } from "@/lib/auth-config";

const AppHeader = () => {
  const { t, language, setLanguage } = useI18n();
  const { user, signOut } = useAuth();
  const { isCreator } = useCreatorAuth();
  const { isAdmin } = useAdminAuth();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Language prefix for navigation links
  const langPrefix = location.pathname === "/vi" || location.pathname.startsWith("/vi/") ? "/vi" : "";

  const handleSignOut = async () => {
    await signOut();
  };

  const navLinks = [
    { path: `${langPrefix}/`, label: t.nav.home },
    { path: `${langPrefix}/live`, label: t.nav.live },
    { path: `${langPrefix}/videos`, label: t.nav.videos },
    { path: `${langPrefix}/news`, label: t.news.title },
    { path: `${langPrefix}/forum`, label: t.forum.navLabel },
    { path: `${langPrefix}/tools`, label: t.nav.tools },
    { path: `${langPrefix}/blog`, label: "Blog" },
    { path: `${langPrefix}/tournaments`, label: t.nav.tournaments },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 left-0 right-0 z-50 transition-all duration-300",
        "pt-[env(safe-area-inset-top)] border-b border-transparent",
        "transform-gpu",
        isScrolled || isMobileMenuOpen
          ? "bg-background/80 backdrop-blur-xl border-white/[0.06]"
          : "bg-background"
      )}
    >
      <div className="container-wide">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-foreground font-semibold text-lg">
            <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center">
              <span className="text-white font-bold text-sm">TPH</span>
            </div>
            <span className="hidden sm:inline">{t.common.appName}</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive =
                location.pathname === link.path ||
                (link.path !== "/" && location.pathname.startsWith(link.path));
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-foreground-secondary hover:text-foreground hover:bg-white/5"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-md text-foreground-secondary hover:text-foreground hover:bg-muted transition-colors duration-200"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Notification Bell - Desktop */}
            <NotificationBell className="hidden md:block" />

            {/* Search - Desktop */}
            <Link
              to="/search"
              className="hidden md:flex p-2 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-muted transition-colors duration-200"
            >
              <Search className="w-5 h-5" />
            </Link>

            {/* User Menu / Login Button - Desktop */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="hidden md:flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <span className="max-w-[100px] truncate text-sm">
                      {user.email?.split("@")[0]}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {isCreator && (
                    <DropdownMenuItem asChild>
                      <Link to="/creator" className="flex items-center gap-2">
                        <Palette className="w-4 h-4" />
                        Creator Studio
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Admin
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link to="/account" className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {t.nav.profile}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    {t.nav.logout}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to={getLoginUrl(location.pathname + location.search)} className="hidden md:block">
                <Button variant="ghost" size="sm" className="gap-2">
                  <LogIn className="w-4 h-4" />
                  {t.nav.login}
                </Button>
              </Link>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 md:hidden rounded-lg text-foreground-secondary hover:text-foreground hover:bg-muted transition-colors duration-200"
              aria-label={isMobileMenuOpen ? t.nav.closeMenu : t.nav.openMenu}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-border-subtle animate-fade-in">
          <div className="container-wide py-4 space-y-1">
            {navLinks.map((link) => {
              const isActive =
                location.pathname === link.path ||
                (link.path !== "/" && location.pathname.startsWith(link.path));
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    "block px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200",
                    isActive
                      ? "text-foreground bg-muted"
                      : "text-foreground-secondary hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="pt-4 border-t border-border-subtle mt-4">
              {user ? (
                <>
                  <div className="px-4 py-2 text-sm text-foreground-muted">{user.email}</div>
                  {isCreator && (
                    <Link
                      to="/creator"
                      className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-foreground-secondary hover:text-foreground hover:bg-muted/50 transition-colors duration-200"
                    >
                      <Palette className="w-4 h-4" />
                      Creator Studio
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-foreground-secondary hover:text-foreground hover:bg-muted/50 transition-colors duration-200"
                    >
                      <Shield className="w-4 h-4" />
                      Admin
                    </Link>
                  )}
                  <Link
                    to="/account"
                    className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-foreground-secondary hover:text-foreground hover:bg-muted/50 transition-colors duration-200"
                  >
                    <User className="w-4 h-4" />
                    {t.nav.profile}
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 w-full px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-muted/50 transition-colors duration-200"
                  >
                    <LogOut className="w-4 h-4" />
                    {t.nav.logout}
                  </button>
                </>
              ) : (
                <Link
                  to={getLoginUrl(location.pathname + location.search)}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-foreground-secondary hover:text-foreground hover:bg-muted/50 transition-colors duration-200"
                >
                  <LogIn className="w-4 h-4" />
                  {t.nav.login}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default AppHeader;

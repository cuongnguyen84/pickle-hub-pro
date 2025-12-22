import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Menu, X, Search, LogIn, LogOut, User, Palette, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/notifications";
const AppHeader = () => {
  const {
    t,
    language,
    setLanguage
  } = useI18n();
  const {
    user,
    signOut
  } = useAuth();
  const {
    isCreator
  } = useCreatorAuth();
  const {
    isAdmin
  } = useAdminAuth();
  const location = useLocation();
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
  const toggleLanguage = () => {
    setLanguage(language === "vi" ? "en" : "vi");
  };
  const handleSignOut = async () => {
    await signOut();
  };
  const navLinks = [{
    path: "/",
    label: t.nav.home
  }, {
    path: "/live",
    label: t.nav.live
  }, {
    path: "/videos",
    label: t.nav.videos
  }, {
    path: "/tournaments",
    label: t.nav.tournaments
  }];
  return <>
      <header className={cn("fixed top-0 left-0 right-0 z-50 transition-all duration-300", "pt-[env(safe-area-inset-top)]", isScrolled || isMobileMenuOpen ? "glass-strong" : "bg-transparent")}>
        <div className="container-wide">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 text-foreground font-semibold text-lg">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">TPH</span>
              </div>
              <span className="hidden sm:inline">{t.common.appName}</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(link => {
              const isActive = location.pathname === link.path || link.path !== "/" && location.pathname.startsWith(link.path);
              return <Link key={link.path} to={link.path} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200", isActive ? "text-foreground bg-muted" : "text-foreground-secondary hover:text-foreground hover:bg-muted/50")}>
                    {link.label}
                  </Link>;
            })}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              {/* Language Switcher */}
              <button onClick={toggleLanguage} className="px-2 py-1 rounded-md text-xs font-medium text-foreground-secondary hover:text-foreground hover:bg-muted transition-colors duration-200">
                {language === "vi" ? "EN" : "VN"}
              </button>

              {/* Notification Bell - Desktop */}
              <NotificationBell className="hidden md:block" />

              {/* Search - Desktop */}
              <Link to="/search" className="hidden md:flex p-2 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-muted transition-colors duration-200">
                <Search className="w-5 h-5" />
              </Link>

              {/* User Menu / Login Button - Desktop */}
              {user ? <DropdownMenu>
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
                    {isCreator && <DropdownMenuItem asChild>
                        <Link to="/creator" className="flex items-center gap-2">
                          <Palette className="w-4 h-4" />
                          Creator Studio
                        </Link>
                      </DropdownMenuItem>}
                    {isAdmin && <DropdownMenuItem asChild>
                        <Link to="/admin" className="flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Admin
                        </Link>
                      </DropdownMenuItem>}
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
                </DropdownMenu> : <Link to="/login" className="hidden md:block">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <LogIn className="w-4 h-4" />
                    {t.nav.login}
                  </Button>
                </Link>}

              {/* Mobile Menu Toggle */}
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 md:hidden rounded-lg text-foreground-secondary hover:text-foreground hover:bg-muted transition-colors duration-200">
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && <div className="md:hidden border-t border-border-subtle animate-fade-in">
            <div className="container-wide py-4 space-y-1">
              {navLinks.map(link => {
            const isActive = location.pathname === link.path || link.path !== "/" && location.pathname.startsWith(link.path);
            return <Link key={link.path} to={link.path} className={cn("block px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200", isActive ? "text-foreground bg-muted" : "text-foreground-secondary hover:text-foreground hover:bg-muted/50")}>
                    {link.label}
                  </Link>;
          })}
              <div className="pt-4 border-t border-border-subtle mt-4">
                {user ? <>
                    <div className="px-4 py-2 text-sm text-foreground-muted">
                      {user.email}
                    </div>
                    <button onClick={handleSignOut} className="flex items-center gap-2 w-full px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-muted/50 transition-colors duration-200">
                      <LogOut className="w-4 h-4" />
                      {t.nav.logout}
                    </button>
                  </> : <Link to="/login" className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-foreground-secondary hover:text-foreground hover:bg-muted/50 transition-colors duration-200">
                    <LogIn className="w-4 h-4" />
                    {t.nav.login}
                  </Link>}
              </div>
            </div>
          </div>}
      </header>
      
      {/* Spacer for fixed header - includes safe area */}
      <div className="h-14 md:h-16" style={{
      paddingTop: 'env(safe-area-inset-top)'
    }} />
    </>;
};
export default AppHeader;
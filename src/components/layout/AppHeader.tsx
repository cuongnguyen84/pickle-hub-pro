import { Link, useLocation } from "react-router-dom";
import { useI18n, Language } from "@/i18n";
import { Menu, X, Search, User, LogIn } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const AppHeader = () => {
  const { t, language, setLanguage } = useI18n();
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

  const navLinks = [
    { path: "/", label: t.nav.home },
    { path: "/live", label: t.nav.live },
    { path: "/videos", label: t.nav.videos },
    { path: "/tournaments", label: t.nav.tournaments },
  ];

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          isScrolled || isMobileMenuOpen
            ? "glass-strong"
            : "bg-transparent"
        )}
      >
        <div className="container-wide">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link 
              to="/" 
              className="flex items-center gap-2 text-foreground font-semibold text-lg"
            >
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">PH</span>
              </div>
              <span className="hidden sm:inline">{t.common.appName}</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path ||
                  (link.path !== "/" && location.pathname.startsWith(link.path));
                
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200",
                      isActive
                        ? "text-foreground bg-muted"
                        : "text-foreground-secondary hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              {/* Language Switcher */}
              <button
                onClick={toggleLanguage}
                className="px-2 py-1 rounded-md text-xs font-medium text-foreground-secondary hover:text-foreground hover:bg-muted transition-colors duration-200"
              >
                {language === "vi" ? "EN" : "VN"}
              </button>

              {/* Search - Desktop */}
              <Link
                to="/search"
                className="hidden md:flex p-2 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-muted transition-colors duration-200"
              >
                <Search className="w-5 h-5" />
              </Link>

              {/* Login Button - Desktop */}
              <Link to="/login" className="hidden md:block">
                <Button variant="ghost" size="sm" className="gap-2">
                  <LogIn className="w-4 h-4" />
                  {t.nav.login}
                </Button>
              </Link>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 md:hidden rounded-lg text-foreground-secondary hover:text-foreground hover:bg-muted transition-colors duration-200"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border-subtle animate-fade-in">
            <div className="container-wide py-4 space-y-1">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path ||
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
                <Link
                  to="/login"
                  className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-foreground-secondary hover:text-foreground hover:bg-muted/50 transition-colors duration-200"
                >
                  <LogIn className="w-4 h-4" />
                  {t.nav.login}
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>
      
      {/* Spacer for fixed header */}
      <div className="h-16" />
    </>
  );
};

export default AppHeader;

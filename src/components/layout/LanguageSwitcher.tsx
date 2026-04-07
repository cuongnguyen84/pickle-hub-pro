import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export const LanguageSwitcher = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isVi = location.pathname === "/vi" || location.pathname.startsWith("/vi/");

  const switchTo = (targetLang: "en" | "vi") => {
    if (targetLang === "vi" && !isVi) {
      navigate(`/vi${location.pathname}${location.search}`);
    } else if (targetLang === "en" && isVi) {
      const enPath = location.pathname.replace(/^\/vi/, "") || "/";
      navigate(`${enPath}${location.search}`);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => switchTo("en")}
        className={cn(
          "px-1.5 py-0.5 rounded text-xs font-medium transition-colors duration-200",
          !isVi
            ? "text-foreground bg-muted"
            : "text-foreground-secondary hover:text-foreground hover:bg-muted/50"
        )}
      >
        EN
      </button>
      <span className="text-foreground-muted text-xs">|</span>
      <button
        onClick={() => switchTo("vi")}
        className={cn(
          "px-1.5 py-0.5 rounded text-xs font-medium transition-colors duration-200",
          isVi
            ? "text-foreground bg-muted"
            : "text-foreground-secondary hover:text-foreground hover:bg-muted/50"
        )}
      >
        VI
      </button>
    </div>
  );
};

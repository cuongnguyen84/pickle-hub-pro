import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "lang_banner_dismissed";

export const LanguageBanner = () => {
  const [show, setShow] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const isViPage = location.pathname === "/vi" || location.pathname.startsWith("/vi/");
    if (isViPage) return;

    const dismissed = sessionStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;

    const lang = navigator.language || navigator.languages?.[0] || "en";
    if (lang.toLowerCase().startsWith("vi")) {
      setShow(true);
    }
  }, [location.pathname]);

  const dismiss = () => {
    setShow(false);
    sessionStorage.setItem(DISMISSED_KEY, "1");
  };

  const switchToVi = () => {
    dismiss();
    navigate(`/vi${location.pathname}${location.search}`);
  };

  if (!show) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-center gap-3 text-sm">
      <span className="text-foreground">
        Bạn đang xem bản tiếng Anh. Chuyển sang tiếng Việt?
      </span>
      <Button size="sm" variant="default" onClick={switchToVi} className="h-7 text-xs">
        Chuyển
      </Button>
      <button onClick={dismiss} className="text-foreground-secondary hover:text-foreground p-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

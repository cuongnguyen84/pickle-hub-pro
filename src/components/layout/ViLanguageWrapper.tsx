import { useEffect } from "react";
import { useI18n } from "@/i18n";

interface ViLanguageWrapperProps {
  children: React.ReactNode;
}

/**
 * Sets i18n language to "vi" while mounted, restores on unmount.
 * Wrap all /vi/* routes with this component.
 */
export const ViLanguageWrapper = ({ children }: ViLanguageWrapperProps) => {
  const { language, setLanguageFromUrl } = useI18n();

  useEffect(() => {
    if (language !== "vi") {
      setLanguageFromUrl("vi");
    }
    // Sync <html lang> attr so JS-rendering crawlers (Ahrefs, Googlebot
    // headless rendering) see lang="vi" on /vi/* routes. index.html ships
    // with lang="en" as the default SPA shell — without this update,
    // crawlers flag "Hreflang and HTML lang mismatch" because the page
    // declares self-hreflang="vi" but the document still says lang="en".
    document.documentElement.setAttribute("lang", "vi");
    return () => {
      setLanguageFromUrl("en");
      document.documentElement.setAttribute("lang", "en");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
};

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
    return () => {
      setLanguageFromUrl("en");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
};

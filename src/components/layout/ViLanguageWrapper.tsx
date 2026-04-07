import { useEffect } from "react";
import { useI18n } from "@/i18n";

interface ViLanguageWrapperProps {
  children: React.ReactNode;
}

/**
 * Sets i18n language to "vi" while mounted.
 * Wrap all /vi/* routes with this component.
 */
export const ViLanguageWrapper = ({ children }: ViLanguageWrapperProps) => {
  const { language, setLanguage } = useI18n();

  useEffect(() => {
    if (language !== "vi") {
      setLanguage("vi");
    }
  }, [language, setLanguage]);

  return <>{children}</>;
};

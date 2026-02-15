import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Translations } from "./vi";
import { vi } from "./vi";
import { en } from "./en";

type Language = "vi" | "en";

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const translations: Record<Language, Translations> = { vi, en };

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = "pickleball-hub-language"; // i18n storage key

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "vi" || stored === "en") {
        return stored;
      }
      // Auto-detect: if browser language starts with "vi", use Vietnamese; otherwise English
      const browserLang = navigator.language?.toLowerCase() ?? "";
      return browserLang.startsWith("vi") ? "vi" : "en";
    }
    return "vi";
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value: I18nContextType = {
    language,
    setLanguage,
    t: translations[language],
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const fallbackContext: I18nContextType = {
  language: "vi",
  setLanguage: () => {},
  t: vi,
};

export function useI18n() {
  const context = useContext(I18nContext);
  return context ?? fallbackContext;
}

export function useTranslation() {
  const { t } = useI18n();
  return t;
}

export type { Language, Translations };

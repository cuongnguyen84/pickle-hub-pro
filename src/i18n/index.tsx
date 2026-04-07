import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Translations } from "./vi";
import { vi } from "./vi";
import { en } from "./en";
import { supabase } from "@/integrations/supabase/client";

type Language = "vi" | "en";

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const translations: Record<Language, Translations> = { vi, en };

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = "pickleball-hub-language"; // i18n storage key
const GEO_LANG_KEY = "geo_detected_language"; // cache geo-detected language

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      // 0. URL-based: /vi/* routes force Vietnamese
      const path = window.location.pathname;
      if (path === "/vi" || path.startsWith("/vi/")) {
        return "vi";
      }

      // 1. User explicitly chose a language
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "vi" || stored === "en") {
        return stored;
      }
      // 2. Previously geo-detected
      const geoCached = sessionStorage.getItem(GEO_LANG_KEY);
      if (geoCached === "vi" || geoCached === "en") {
        return geoCached;
      }
    }
    // 3. Default to English (EN routes are default)
    return "en";
  });

  // Auto-detect language by IP country (only if user hasn't manually chosen)
  useEffect(() => {
    const userChosen = localStorage.getItem(STORAGE_KEY);
    if (userChosen) return; // User already chose, don't override

    const geoCached = sessionStorage.getItem(GEO_LANG_KEY);
    if (geoCached) return; // Already detected this session

    const detectByGeo = async () => {
      try {
        const cached = sessionStorage.getItem("geo_block_result");
        let country: string | null = null;

        if (cached) {
          country = JSON.parse(cached).country;
        } else {
          const { data } = await supabase.functions.invoke("geo-check");
          country = data?.country ?? null;
          if (data) {
            sessionStorage.setItem("geo_block_result", JSON.stringify(data));
          }
        }

        const detectedLang: Language = country === "VN" ? "vi" : "en";
        sessionStorage.setItem(GEO_LANG_KEY, detectedLang);
        setLanguageState(detectedLang);
        document.documentElement.lang = detectedLang;
      } catch (err) {
        console.error("[i18n] Geo detection failed:", err);
      }
    };

    detectByGeo();
  }, []);

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

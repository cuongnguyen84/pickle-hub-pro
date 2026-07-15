import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Translations } from "./vi";
import {
  isVietnamesePath,
  loadTranslations,
  type Language,
} from "./loader";
import { supabase } from "@/integrations/supabase/client";

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  setLanguageFromUrl: (lang: Language) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = "pickleball-hub-language"; // i18n storage key
const GEO_LANG_KEY = "geo_detected_language"; // cache geo-detected language

/**
 * html[lang] follows URL structure, not user preference.
 * /vi and /vi/* → "vi", everything else → "en".
 * This ensures bots and screen readers always see the correct page language
 * regardless of geo-detection or stored language preferences.
 */
const getHtmlLangFromPath = (): "en" | "vi" => {
  const path = window.location.pathname;
  return isVietnamesePath(path) ? "vi" : "en";
};

const getInitialLanguage = (): Language => {
  if (typeof window !== "undefined") {
    // 0. URL-based: /vi/* routes force Vietnamese
    const path = window.location.pathname;
    if (isVietnamesePath(path)) {
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
};

const I18nBootstrap = ({
  language,
  failed,
  onRetry,
}: {
  language: Language;
  failed: boolean;
  onRetry: () => void;
}) => {
  const copy = language === "vi"
    ? {
        loading: "Đang tải ngôn ngữ…",
        error: "Không thể tải ngôn ngữ.",
        retry: "Thử lại",
      }
    : {
        loading: "Loading language…",
        error: "Could not load the language.",
        retry: "Retry",
      };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      {failed ? (
        <div className="text-center" role="alert">
          <p className="mb-4 text-sm text-muted-foreground">{copy.error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {copy.retry}
          </button>
        </div>
      ) : (
        <div role="status" aria-live="polite">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <span className="sr-only">{copy.loading}</span>
        </div>
      )}
    </div>
  );
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const initialLanguage = useRef(getInitialLanguage()).current;
  const [activeTranslations, setActiveTranslations] = useState<{
    language: Language;
    translations: Translations;
  } | null>(null);
  const [loadError, setLoadError] = useState<Language | null>(null);
  const activeTranslationsRef = useRef(activeTranslations);
  const pendingLanguageRef = useRef<Language | null>(null);
  const requestedLanguageRef = useRef(initialLanguage);
  const loadRequestRef = useRef(0);

  const activateLanguage = useCallback((language: Language) => {
    requestedLanguageRef.current = language;

    if (
      activeTranslationsRef.current?.language === language ||
      pendingLanguageRef.current === language
    ) {
      return;
    }

    const requestId = ++loadRequestRef.current;
    pendingLanguageRef.current = language;
    setLoadError(null);

    void loadTranslations(language)
      .then((translations) => {
        if (loadRequestRef.current !== requestId) return;

        const next = { language, translations };
        activeTranslationsRef.current = next;
        pendingLanguageRef.current = null;
        setActiveTranslations(next);
      })
      .catch((error: unknown) => {
        if (loadRequestRef.current !== requestId) return;

        pendingLanguageRef.current = null;
        setLoadError(language);
        console.error(`[i18n] Failed to load ${language} translations:`, error);
      });
  }, []);

  useEffect(() => {
    activateLanguage(initialLanguage);
  }, [activateLanguage, initialLanguage]);

  // Auto-detect language by IP country (only if user hasn't manually chosen)
  useEffect(() => {
    // `/vi` and `/vi/*` are explicit locale routes. Geo detection must not
    // override them after the Vietnamese dictionary has already loaded.
    if (isVietnamesePath(window.location.pathname)) return;

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

        // The user may choose a language or navigate to `/vi/*` while the
        // network request is in flight. Do not let a stale geo response undo
        // that newer, explicit choice.
        if (
          localStorage.getItem(STORAGE_KEY) ||
          isVietnamesePath(window.location.pathname)
        ) {
          return;
        }

        const detectedLang: Language = country === "VN" ? "vi" : "en";
        sessionStorage.setItem(GEO_LANG_KEY, detectedLang);
        activateLanguage(detectedLang);
        document.documentElement.lang = getHtmlLangFromPath();
      } catch (err) {
        console.error("[i18n] Geo detection failed:", err);
      }
    };

    detectByGeo();
  }, [activateLanguage]);

  const setLanguage = useCallback((lang: Language) => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = getHtmlLangFromPath();
    activateLanguage(lang);
  }, [activateLanguage]);

  // Set language from URL without persisting to localStorage
  const setLanguageFromUrl = useCallback((lang: Language) => {
    document.documentElement.lang = getHtmlLangFromPath();
    activateLanguage(lang);
  }, [activateLanguage]);

  useEffect(() => {
    document.documentElement.lang = getHtmlLangFromPath();
  }, [activeTranslations?.language]);

  const value = useMemo<I18nContextType | null>(() => {
    if (!activeTranslations) return null;

    return {
      language: activeTranslations.language,
      setLanguage,
      setLanguageFromUrl,
      t: activeTranslations.translations,
    };
  }, [activeTranslations, setLanguage, setLanguageFromUrl]);

  const retryLanguageLoad = useCallback(() => {
    pendingLanguageRef.current = null;
    activateLanguage(requestedLanguageRef.current);
  }, [activateLanguage]);

  if (!value) {
    return (
      <I18nBootstrap
        language={requestedLanguageRef.current}
        failed={loadError === requestedLanguageRef.current}
        onRetry={retryLanguageLoad}
      />
    );
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}

export function useTranslation() {
  const { t } = useI18n();
  return t;
}

export type { Language, Translations };

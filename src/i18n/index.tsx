import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Translations } from "./vi";
import {
  setActiveTranslationBundle,
  isVietnamesePath,
  loadTranslations,
  type Language,
} from "./loader";
import { detectCountryFromEdge } from "./geo";

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  setLanguageFromUrl: (lang: Language) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = "pickleball-hub-language"; // i18n storage key
const GEO_LANG_KEY = "geo_detected_language"; // cache geo-detected language
const GEO_COUNTRY_KEY = "geo_detected_country";

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
  const label = language === "vi" ? "Đang tải ngôn ngữ…" : "Loading language…";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {failed ? (
        <div role="alert">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry / Thử lại
          </button>
        </div>
      ) : (
        <div role="status" aria-live="polite">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <span className="sr-only">{label}</span>
        </div>
      )}
    </div>
  );
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [initialLanguage] = useState(getInitialLanguage);
  const [activeTranslations, setActiveTranslations] = useState<{
    language: Language;
    translations: Translations;
  } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const activeLanguageRef = useRef<Language | null>(null);
  const requestedLanguageRef = useRef(initialLanguage);

  const activateLanguage = useCallback((language: Language) => {
    requestedLanguageRef.current = language;

    if (activeLanguageRef.current === language) return;

    setLoadFailed(false);

    void loadTranslations(language)
      .then((translations) => {
        if (requestedLanguageRef.current !== language) return;

        const next = { language, translations };
        activeLanguageRef.current = language;
        setActiveTranslationBundle(language, translations);
        setActiveTranslations(next);
      })
      .catch((error: unknown) => {
        if (requestedLanguageRef.current !== language) return;

        setLoadFailed(true);
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
        const cachedCountry = sessionStorage.getItem(GEO_COUNTRY_KEY);
        let country: string | null = null;

        if (cached) {
          const parsed = JSON.parse(cached) as { country?: unknown };
          country = typeof parsed.country === "string" ? parsed.country : null;
        } else if (cachedCountry) {
          country = cachedCountry;
        } else {
          country = await detectCountryFromEdge();
          if (country) {
            sessionStorage.setItem(GEO_COUNTRY_KEY, country);
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

  const setLanguage = useCallback(
    (lang: Language) => {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = getHtmlLangFromPath();
      activateLanguage(lang);
    },
    [activateLanguage],
  );

  // Set language from URL without persisting to localStorage
  const setLanguageFromUrl = useCallback(
    (lang: Language) => {
      document.documentElement.lang = getHtmlLangFromPath();
      activateLanguage(lang);
    },
    [activateLanguage],
  );

  useEffect(() => {
    document.documentElement.lang = getHtmlLangFromPath();
  }, [activeTranslations?.language]);

  if (!activeTranslations) {
    return (
      <I18nBootstrap
        language={requestedLanguageRef.current}
        failed={loadFailed}
        onRetry={() => activateLanguage(requestedLanguageRef.current)}
      />
    );
  }

  const value: I18nContextType = {
    language: activeTranslations.language,
    setLanguage,
    setLanguageFromUrl,
    t: activeTranslations.translations,
  };

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

import type { Translations } from "./vi";

export type Language = "vi" | "en";

const translationPromises: Partial<Record<Language, Promise<Translations>>> = {};

export const isVietnamesePath = (pathname: string): boolean =>
  pathname === "/vi" || pathname.startsWith("/vi/");

const importTranslations = (language: Language): Promise<Translations> => {
  if (language === "vi") {
    return import("./vi").then(({ vi }) => vi);
  }

  return import("./en").then(({ en }) => en);
};

/**
 * Load one dictionary on demand and share the request across concurrent callers.
 * Failed imports are evicted so the bootstrap retry can request the chunk again.
 */
export const loadTranslations = (language: Language): Promise<Translations> => {
  const cached = translationPromises[language];
  if (cached) return cached;

  const pending = importTranslations(language).catch((error: unknown) => {
    delete translationPromises[language];
    throw error;
  });

  translationPromises[language] = pending;
  return pending;
};

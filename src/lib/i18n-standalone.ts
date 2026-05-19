// Standalone i18n lookup for non-React contexts (mutation hooks, toasts).
// Cannot use useI18n() because hook callbacks fire outside the React render tree.
// Reads the same localStorage key the I18nProvider writes ("pickleball-hub-language").

import { vi } from "@/i18n/vi";
import { en } from "@/i18n/en";

const STORAGE_KEY = "pickleball-hub-language"; // must match src/i18n/index.tsx

type Language = "vi" | "en";
const bundles: Record<Language, unknown> = { vi, en };

export type ToastKey = string;

export function getCurrentLanguage(): Language {
  try {
    if (typeof window === "undefined") return "en";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "vi" || stored === "en" ? stored : "en";
  } catch {
    return "en";
  }
}

function getNested(obj: unknown, path: string[]): unknown {
  return path.reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object" && k in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return Object.entries(params).reduce<string>(
    (acc, [k, v]) => acc.split(`{${k}}`).join(String(v)),
    template,
  );
}

export function tStandalone(
  key: ToastKey,
  params?: Record<string, string | number>,
): string {
  const lang = getCurrentLanguage();
  const path = key.split(".");
  let resolved = getNested(bundles[lang], path);
  if (typeof resolved !== "string") {
    resolved = getNested(bundles[lang === "vi" ? "en" : "vi"], path);
  }
  if (typeof resolved !== "string") return key;
  return interpolate(resolved, params);
}

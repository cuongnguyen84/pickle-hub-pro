// Standalone i18n lookup for non-React contexts (mutation hooks, toasts).
// Cannot use useI18n() because hook callbacks fire outside the React render tree.
// Reads the dictionary already activated by I18nProvider. Importing locale
// modules here would pull both dictionaries into every route using a mutation
// hook and undo the provider's lazy-loading boundary.

import { getActiveTranslationBundle } from "@/i18n/loader";

export type ToastKey = string;

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
  const active = getActiveTranslationBundle();
  if (!active) return key;

  const path = key.split(".");
  const resolved = getNested(active.translations, path);
  if (typeof resolved !== "string") return key;
  return interpolate(resolved, params);
}

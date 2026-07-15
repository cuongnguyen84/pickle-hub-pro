import { describe, expect, it } from "vitest";
import {
  isVietnamesePath,
  loadTranslations,
  type Language,
} from "../loader";

describe("isVietnamesePath", () => {
  it.each(["/vi", "/vi/", "/vi/news", "/vi/tools/dashboard"])(
    "recognizes the Vietnamese route %s",
    (pathname) => {
      expect(isVietnamesePath(pathname)).toBe(true);
    },
  );

  it.each(["/", "/news", "/vietnam", "/videos"])(
    "does not misclassify %s",
    (pathname) => {
      expect(isVietnamesePath(pathname)).toBe(false);
    },
  );
});

describe("loadTranslations", () => {
  it.each<[Language, string, string]>([
    ["en", "The PickleHub", "Loading..."],
    ["vi", "The PickleHub", "Đang tải..."],
  ])("loads the %s dictionary on demand", async (language, appName, loading) => {
    const translations = await loadTranslations(language);

    expect(translations.common.appName).toBe(appName);
    expect(translations.common.loading).toBe(loading);
  });

  it("reuses the same promise for an already requested dictionary", () => {
    expect(loadTranslations("en")).toBe(loadTranslations("en"));
  });
});

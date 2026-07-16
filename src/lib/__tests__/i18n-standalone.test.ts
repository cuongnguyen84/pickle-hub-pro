import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  loadTranslations,
  setActiveTranslationBundle,
} from "../../i18n/loader";
import { tStandalone } from "../i18n-standalone";

describe("standalone translations", () => {
  it("reads the provider's active dictionary without importing both locales", async () => {
    const english = await loadTranslations("en");
    setActiveTranslationBundle("en", english);
    expect(tStandalone("toast.referee.add.success", { name: "Alex" }))
      .toBe("Referee added: Alex");

    const vietnamese = await loadTranslations("vi");
    setActiveTranslationBundle("vi", vietnamese);
    expect(tStandalone("toast.referee.add.success", { name: "An" }))
      .toBe("Đã thêm trọng tài: An");
    expect(tStandalone("missing.translation.key")).toBe("missing.translation.key");

    const source = readFileSync(
      fileURLToPath(new URL("../i18n-standalone.ts", import.meta.url)),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["']@\/i18n\/(?:en|vi)["']/);
  });
});

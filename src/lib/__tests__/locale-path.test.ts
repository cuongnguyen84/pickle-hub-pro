import { describe, expect, it } from "vitest";
import { localePath, withoutLocale } from "@/lib/locale-path";

describe("localePath", () => {
  it("prefixes Vietnamese links and leaves English links bare", () => {
    expect(localePath("/tools/quick-tables/chat", "vi")).toBe("/vi/tools/quick-tables/chat");
    expect(localePath("/tools/quick-tables/abc", "en")).toBe("/tools/quick-tables/abc");
    expect(localePath("/vi/tools/quick-tables", "vi")).toBe("/vi/tools/quick-tables");
    expect(localePath("/tools/quick-tables/x?tab=groups", "vi")).toBe("/vi/tools/quick-tables/x?tab=groups");
  });

  it("strips the locale for prefix checks", () => {
    expect(withoutLocale("/vi/tools/quick-tables/chat")).toBe("/tools/quick-tables/chat");
    expect(withoutLocale("/tools/quick-tables/chat")).toBe("/tools/quick-tables/chat");
  });
});

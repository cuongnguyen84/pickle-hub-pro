import { describe, it, expect } from "vitest";
import { assistantScreenFor } from "@/lib/assistant-context";

describe("assistantScreenFor — nút trợ lý chỉ hiện quanh giải", () => {
  it.each([
    ["/tournaments", "tournament_hub"],
    ["/vi/tournament/ppa-asia-2026", "tournament_detail"],
    ["/tools/quick-tables", "quick_table_hub"],
    ["/tools/quick-tables/abc123", "quick_table_detail"],
    ["/vi/tools/quick-tables/abc123/setup", "quick_table_setup"],
    ["/tools/quick-tables/parent/xyz", "quick_table_parent"],
  ])("%s → %s", (path, screen) => {
    expect(assistantScreenFor(path)).toBe(screen);
  });

  it.each(["/", "/vi", "/blog/abc", "/san/abc", "/live/123", "/vi/live/123", "/tools/quick-tables/chat", "/tools/quick-tables/referee/m1", "/news"])(
    "%s → không hiện",
    (path) => expect(assistantScreenFor(path)).toBeNull(),
  );
});

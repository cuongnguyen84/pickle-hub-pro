import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const source = (p: string) => readFileSync(resolve(root, p), "utf8");

/**
 * The bug this guards was not that the helper lacked Vietnamese — it was that
 * the helper was localised TWICE in private copies (Index.tsx and
 * CommentRow.tsx) while the shared one everyone else imported stayed
 * English-only. Duplication is why it survived, so the guard is about
 * duplication, not just about the strings.
 */
const SHARED_CALLERS = [
  "src/pages/News.tsx",
  "src/pages/NewsArticle.tsx",
  "src/pages/Forum.tsx",
  "src/pages/Tools.tsx",
  "src/pages/Videos.tsx",
  "src/pages/Tournaments.tsx",
  "src/pages/Live.tsx",
  "src/pages/Index.tsx",
];

describe("relative timestamps are localised at every call site", () => {
  it.each(SHARED_CALLERS)("%s passes a locale to formatRelative", (path) => {
    const s = source(path);
    const calls = s.match(/formatRelative\([^)]*\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toMatch(/,\s*language\s*\)/);
    }
  });

  it.each(SHARED_CALLERS)("%s imports the shared helper instead of redefining it", (path) => {
    const s = source(path);
    expect(s).toMatch(/import \{[^}]*\bformatRelative\b[^}]*\} from "@\/lib\/format-datetime"/);
    // A private `const formatRelative =` or `function formatRelative(` is how
    // the English-only version stayed hidden for months.
    expect(s).not.toMatch(/^(const|function)\s+formatRelative\b/m);
  });

  it("leaves CommentRow's own implementation alone, deliberately", () => {
    // CommentRow's copy is NOT an exact twin: it is past-only, says "just now"
    // rather than "now", and falls back to an absolute date beyond 30 days —
    // which is better for a comment thread than "412 ngày trước". Folding it
    // in would change what readers see for no i18n gain, since it is already
    // localised. Collapsing it needs the shared helper to grow an
    // absolute-fallback option first.
    const s = source("src/components/social/comments/CommentRow.tsx");
    expect(s).toMatch(/function formatRelative\(iso: string, language: "vi" \| "en"\)/);
    expect(s).toContain("vừa xong");
  });
});

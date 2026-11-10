// ============================================================================
// SERP byte budget for blog metadata — HARD GATE.
// ----------------------------------------------------------------------------
// functions/_lib/html.ts truncates titles at 60 CHARACTERS (truncateTitleForSeo;
// a 60-BYTE budget until AUDIT-01, 2026-11-10) and descriptions at 160 UTF-8
// BYTES (truncateForSeo), and the truncated string is what ends up in the SERP
// title AND in the bot-visible <h1>. Vietnamese diacritics cost 2-3 bytes each,
// so VI description copy that looks short in characters ships mangled: on 2026-07-26 prod
// served "Cách tổ chức giải vòng tròn Pickleball | Lịch…" for a 70-byte title.
//
// That audit found 63 titles and 55 descriptions already over budget, so this
// started life as a ratchet. All 118 were rewritten the same day, so it is now
// a hard gate: nothing may exceed the budget.
//
// If this fails, shorten the copy — do not raise the limits. They mirror
// SEO_TITLE_MAX_CHARS / SEO_DESCRIPTION_MAX_BYTES in functions/_lib/html.ts,
// which is what actually does the truncating.
// ============================================================================

import { describe, expect, it } from "vitest";
import { blogMetadata } from "../metadata";

const TITLE_MAX_CHARS = 60;
const DESCRIPTION_MAX_BYTES = 160;

const bytes = (s: string) => new TextEncoder().encode(s).length;
const chars = (s: string) => Array.from(s).length;

function over(
  field: "metaTitleEn" | "metaTitleVi" | "metaDescriptionEn" | "metaDescriptionVi",
  limit: number,
  measure: (s: string) => number = bytes,
) {
  return blogMetadata
    .filter((m) => measure(m[field]) > limit)
    .map((m) => `${m.slug}.${field} = ${measure(m[field])} (limit ${limit})`);
}

describe("blog metadata SERP byte budget", () => {
  it("no metaTitleEn exceeds 60 chars", () => {
    const bad = over("metaTitleEn", TITLE_MAX_CHARS, chars);
    expect(bad, `titles that ship ellipsised:\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("no metaTitleVi exceeds 60 chars", () => {
    const bad = over("metaTitleVi", TITLE_MAX_CHARS, chars);
    expect(bad, `titles that ship ellipsised:\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("no metaDescriptionEn exceeds 160 bytes", () => {
    const bad = over("metaDescriptionEn", DESCRIPTION_MAX_BYTES);
    expect(bad, `descriptions that ship ellipsised:\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("no metaDescriptionVi exceeds 160 bytes", () => {
    const bad = over("metaDescriptionVi", DESCRIPTION_MAX_BYTES);
    expect(bad, `descriptions that ship ellipsised:\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  // The SPA renders <title> from the post file while SSR + list pages read
  // metadata.ts, so drift means humans and Googlebot see different titles.
  // 2026-07-26: 5 titles and ~30 descriptions had already drifted apart.
  it("post files agree with metadata.ts on every SEO string", async () => {
    const { loadBlogPost } = await import("../posts/all");
    const mismatched: string[] = [];
    for (const m of blogMetadata) {
      const post = await loadBlogPost(m.slug);
      if (!post) continue;
      const checks: [string, string, string][] = [
        ["EN title", post.content.en.metaTitle, m.metaTitleEn],
        ["VI title", post.content.vi.metaTitle, m.metaTitleVi],
        ["EN description", post.content.en.metaDescription, m.metaDescriptionEn],
        ["VI description", post.content.vi.metaDescription, m.metaDescriptionVi],
      ];
      for (const [label, fromPost, fromMeta] of checks) {
        if (fromPost !== fromMeta) mismatched.push(`${m.slug} ${label}`);
      }
    }
    expect(mismatched, `post file vs metadata.ts drift:\n  ${mismatched.join("\n  ")}`).toEqual([]);
  });
});

// ============================================================================
// SERP byte-budget ratchet for blog metadata.
// ----------------------------------------------------------------------------
// functions/_lib/html.ts truncates titles at 60 UTF-8 BYTES and descriptions at
// 160 (truncateForSeo), and the truncated string is what ends up in the SERP
// title AND in the bot-visible <h1>. Vietnamese diacritics cost 2-3 bytes each,
// so VI copy that looks short in characters ships mangled: the 2026-07-26 SEO
// cluster work put "Cách tổ chức giải vòng tròn Pickleball | Lịch & Luật 2026"
// (70B) live and prod served "…Pickleball | Lịch…".
//
// A hard gate is not possible today — the audit at the time of writing found 63
// titles and 55 descriptions already over budget across 46 posts, which is a
// content project, not a code fix. So this is a RATCHET: the count may drop,
// never grow. Lower BASELINE as entries get rewritten; new posts must fit.
// ============================================================================

import { describe, expect, it } from "vitest";
import { blogMetadata } from "../metadata";

const TITLE_MAX_BYTES = 60;
const DESCRIPTION_MAX_BYTES = 160;

// Snapshot of the pre-existing debt on 2026-07-26. Only ever lower these.
const BASELINE = { titles: 63, descriptions: 55 };

const bytes = (s: string) => new TextEncoder().encode(s).length;

function overBudget() {
  const titles: string[] = [];
  const descriptions: string[] = [];
  for (const m of blogMetadata) {
    for (const [field, value] of [
      ["metaTitleEn", m.metaTitleEn],
      ["metaTitleVi", m.metaTitleVi],
    ] as const) {
      if (bytes(value) > TITLE_MAX_BYTES) titles.push(`${m.slug}.${field} = ${bytes(value)}B`);
    }
    for (const [field, value] of [
      ["metaDescriptionEn", m.metaDescriptionEn],
      ["metaDescriptionVi", m.metaDescriptionVi],
    ] as const) {
      if (bytes(value) > DESCRIPTION_MAX_BYTES) descriptions.push(`${m.slug}.${field} = ${bytes(value)}B`);
    }
  }
  return { titles, descriptions };
}

describe("blog metadata SERP byte budget (ratchet)", () => {
  const { titles, descriptions } = overBudget();

  it(`no more than ${BASELINE.titles} titles exceed ${TITLE_MAX_BYTES} bytes`, () => {
    expect(
      titles.length,
      `Truncated SERP titles grew to ${titles.length} (baseline ${BASELINE.titles}). ` +
        `A title over ${TITLE_MAX_BYTES} bytes ships with an ellipsis in the SERP and in the bot <h1>:\n  ` +
        titles.join("\n  "),
    ).toBeLessThanOrEqual(BASELINE.titles);
  });

  it(`no more than ${BASELINE.descriptions} descriptions exceed ${DESCRIPTION_MAX_BYTES} bytes`, () => {
    expect(
      descriptions.length,
      `Truncated SERP descriptions grew to ${descriptions.length} (baseline ${BASELINE.descriptions}):\n  ` +
        descriptions.join("\n  "),
    ).toBeLessThanOrEqual(BASELINE.descriptions);
  });

  it("the baseline is not stale by more than a handful (lower it as debt is paid)", () => {
    // Guard against a baseline that silently drifts far above reality, which
    // would let regressions hide underneath it.
    expect(BASELINE.titles - titles.length).toBeLessThanOrEqual(10);
    expect(BASELINE.descriptions - descriptions.length).toBeLessThanOrEqual(10);
  });
});

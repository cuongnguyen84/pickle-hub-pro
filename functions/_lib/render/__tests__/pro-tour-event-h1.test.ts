import { describe, expect, it } from "vitest";
import { renderProTourEvent } from "../pro-tour-event";
import type { ProTourEventRow } from "../../../../src/content/pro-tour-events";

const SITE = "https://www.thepicklehub.net";

const ROW: ProTourEventRow = {
  slug: "ppa-asia-1000-leapmotor-kuala-lumpur-cup-2026",
  name_pattern: "%Kuala Lumpur Cup%",
  name_en: "PPA Asia 1000 Leapmotor Kuala Lumpur Cup 2026",
  name_vi: "PPA Asia 1000 Leapmotor Kuala Lumpur Cup 2026",
  tier: "PPA Asia 1000",
  tour: "PPA Tour Asia",
  sponsor: "Leapmotor",
  city: "Kuala Lumpur",
  country: "Malaysia",
  country_code: "MY",
  venue: "Bukit Jalil",
  start_date: "2026-09-09",
  end_date: "2026-09-13",
  official_url: "https://example.test/event",
  brackets_url: "https://example.test/draws",
  prize_money: "$100,000",
  logo_url: null,
  brand_bg: null,
};

/** Stub of the service client's narrow query surface. */
function stubSupabase(data: unknown) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data, error: null }),
        }),
      }),
    }),
  };
}

function countH1(html: string): number {
  return (html.match(/<h1[\s>]/g) ?? []).length;
}

describe("renderProTourEvent", () => {
  // The regression this file exists for: bodyContent opens with its own <h1>,
  // so buildHtml() must be told to skip the auto-header. Without
  // omitAutoHeader every /live/pro/<slug> page — EN and VI — shipped two
  // <h1>s, the second one carrying the decorated "… | ThePickleHub" title.
  it("emits exactly one <h1> in both locales", async () => {
    for (const [path, lang, heading] of [
      ["/live/pro/x", "en", "— Results"],
      ["/vi/live/pro/x", "vi", "Kết quả"],
    ] as const) {
      const res = await renderProTourEvent(stubSupabase(ROW), ROW.slug, SITE, path, lang);
      expect(res).not.toBeNull();
      const html = await res!.text();
      expect(countH1(html)).toBe(1);
      expect(html).toContain(heading);
      // The auto-header's signature is the decorated, pipe-separated title.
      expect(html).not.toMatch(/<h1[^>]*>[^<]*\| ThePickleHub<\/h1>/);
    }
  });

  it("returns null for an unknown slug so the middleware can 404", async () => {
    const res = await renderProTourEvent(stubSupabase(null), "nope", SITE, "/live/pro/nope", "en");
    expect(res).toBeNull();
  });
});

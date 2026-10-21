import { describe, expect, it } from "vitest";
import { renderTools } from "../tools";
import {
  TOOLS_FAQ_EN,
  TOOLS_FAQ_VI,
  TOOLS_HOWTO_EN,
  TOOLS_HOWTO_VI,
  TOOLS_HOWTO_META,
} from "../../../../src/content/tools/hub-copy";

const SITE = "https://www.thepicklehub.net";

const render = async (lang: "en" | "vi") =>
  (await renderTools(SITE, lang === "vi" ? "/vi/tools" : "/tools", lang)).text();

const graph = (html: string) => {
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  expect(block, "no JSON-LD emitted").toBeTruthy();
  return JSON.parse(block![1])["@graph"] as Record<string, unknown>[];
};

const node = (html: string, type: string) => graph(html).find((n) => n["@type"] === type);

/**
 * SEO-GUARD-01 (2026-08-19). GSC 10–16/8 vs 3–9/8: /tools went 16 clicks → 0,
 * the single largest page loss on the site that week, and "pickleball bracket
 * generator" slid pos 12.2 → 19. The page held the head term in its title but
 * no procedural content behind it.
 *
 * The load-bearing invariant in this file is the LAST describe block: Google
 * requires HowTo/FAQ structured data to describe content the page actually
 * shows, so the JSON-LD, the SSR body and the React component must all read
 * from src/content/tools/hub-copy.ts.
 */
describe("renderTools — HowTo", () => {
  it("emits a HowTo node with every step, in both locales", async () => {
    for (const [lang, steps] of [
      ["en", TOOLS_HOWTO_EN],
      ["vi", TOOLS_HOWTO_VI],
    ] as const) {
      const howTo = node(await render(lang), "HowTo")!;
      expect(howTo, `${lang} emitted no HowTo`).toBeTruthy();

      const step = howTo.step as Record<string, unknown>[];
      expect(step).toHaveLength(steps.length);
      expect(step.map((s) => s.name)).toEqual(steps.map(([name]) => name));
      expect(step.every((s) => s["@type"] === "HowToStep")).toBe(true);
      expect(step.map((s) => s.position)).toEqual(steps.map((_, i) => i + 1));
      expect(howTo.inLanguage).toBe(lang);
    }
  });

  it("anchors each step at a fragment that exists in the body", async () => {
    for (const lang of ["en", "vi"] as const) {
      const html = await render(lang);
      const canonical = lang === "vi" ? `${SITE}/vi/tools` : `${SITE}/tools`;
      const step = node(html, "HowTo")!.step as Record<string, unknown>[];

      for (const [i] of step.entries()) {
        expect(step[i].url).toBe(`${canonical}#step-${i + 1}`);
        expect(html).toContain(`id="step-${i + 1}"`);
      }
    }
  });

  it("declares the tool free rather than leaving cost unstated", async () => {
    const howTo = node(await render("en"), "HowTo")!;
    expect(howTo.estimatedCost).toEqual({
      "@type": "MonetaryAmount",
      currency: "USD",
      value: "0",
    });
  });

  it("keeps the pre-existing WebApplication, ItemList and FAQPage nodes", async () => {
    const types = graph(await render("en")).map((n) => n["@type"]);
    expect(types).toEqual(
      expect.arrayContaining(["WebApplication", "ItemList", "FAQPage", "HowTo"]),
    );
    // The fake 4.8/120 rating removed on 2026-04-28 must stay gone.
    expect(await render("en")).not.toContain("aggregateRating");
  });
});

describe("renderTools — structured data matches visible content", () => {
  it("renders every FAQ answer it claims in FAQPage markup", async () => {
    for (const [lang, faqs] of [
      ["en", TOOLS_FAQ_EN],
      ["vi", TOOLS_FAQ_VI],
    ] as const) {
      const html = await render(lang);
      const questions = (node(html, "FAQPage")!.mainEntity as { name: string }[]).map(
        (q) => q.name,
      );
      expect(questions).toEqual(faqs.map(([q]) => q));
      for (const [question, answer] of faqs) {
        expect(html, `${lang}: question missing from body`).toContain(question);
        expect(html, `${lang}: answer missing from body`).toContain(answer);
      }
    }
  });

  it("renders every HowTo step text in the visible body", async () => {
    for (const [lang, steps] of [
      ["en", TOOLS_HOWTO_EN],
      ["vi", TOOLS_HOWTO_VI],
    ] as const) {
      const html = await render(lang);
      for (const [name, text] of steps) {
        expect(html, `${lang}: step name missing from body`).toContain(name);
        expect(html, `${lang}: step text missing from body`).toContain(text);
      }
      expect(html).toContain(TOOLS_HOWTO_META[lang].heading);
    }
  });

  it("keeps VI internal links inside the VI cluster", async () => {
    const html = await render("vi");
    expect(html).toContain(`${SITE}/vi/tools/quick-tables`);
    expect(html).not.toContain(`href="${SITE}/tools/quick-tables"`);
  });

  it("keeps exactly one h1 and reciprocal hreflang on both locales", async () => {
    for (const lang of ["en", "vi"] as const) {
      const html = await render(lang);
      expect(html.match(/<h1[\s>]/g)?.length, `${lang} h1 count`).toBe(1);
      expect(html).toContain(`<link rel="alternate" hreflang="en" href="${SITE}/tools"/>`);
      expect(html).toContain(`<link rel="alternate" hreflang="vi" href="${SITE}/vi/tools"/>`);
      expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${SITE}/tools"/>`);
    }
  });
});

describe("tools hub copy", () => {
  it("names ThePickleHub without the entity-diluting spaced variant", async () => {
    // CLAUDE.md GEO rule: "The Pickle Hub" is alternateName-only, never prose.
    for (const lang of ["en", "vi"] as const) {
      const body = (await render(lang)).match(/<main[\s\S]*?<\/main>/)?.[0] ?? "";
      expect(body).toContain("ThePickleHub");
      expect(body).not.toContain("The Pickle Hub");
    }
  });

  it("has no duplicate questions or steps", async () => {
    for (const list of [TOOLS_FAQ_EN, TOOLS_FAQ_VI, TOOLS_HOWTO_EN, TOOLS_HOWTO_VI]) {
      const keys = list.map(([k]) => k);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

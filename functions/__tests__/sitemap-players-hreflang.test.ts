import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(import.meta.dirname, "../sitemap-players.xml.ts"),
  "utf8",
);

describe("sitemap-players.xml hreflang", () => {
  // /nguoi-choi/{username} is single-canonical: there is no /vi/nguoi-choi/*
  // mirror, and the React app toggles language on the same route. The sitemap
  // used to emit vi + en + x-default all pointing at that one URL. Google
  // requires DIFFERENT urls per language, so same-url annotations are invalid
  // and dropped — and this repo already stripped exactly that pattern from
  // /social and /clubs in the 2026-05-18 Ahrefs Site Audit fix. The sitemap
  // was the last place it survived, and it contradicted the pages themselves,
  // which emit no hreflang at all.
  it("emits no hreflang for the single-canonical profile route", () => {
    const entry = source.slice(source.indexOf("const profileUrl"));
    expect(entry).not.toContain('lang: "vi", href: profileUrl');
    expect(entry).not.toContain('lang: "en", href: profileUrl');
    expect(entry).not.toContain('lang: "x-default", href: profileUrl');
  });

  it("keeps loc, lastmod, changefreq and priority", () => {
    for (const field of ["loc: profileUrl", "lastmod", "changefreq", "priority"]) {
      expect(source).toContain(field);
    }
  });

  it("records why the annotation was removed, so it is not restored by reflex", () => {
    expect(source).toContain("genuinely invalid signal");
  });
});

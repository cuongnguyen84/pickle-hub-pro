// @vitest-environment jsdom
import { expect, it } from "vitest";
import { sanitizeBlogHtml } from "../sanitize-blog-html";
import { attacks } from "./sanitizer-fixtures";

it.each(attacks)("sanitizes adversarial HTML before a browser DOM sink: %s", (input) => {
  const safe = sanitizeBlogHtml(input);
  const sink = document.createElement("div"); sink.innerHTML = safe;
  expect(sink.querySelector("script,style,svg,math,iframe,object,embed,form,input,template")).toBeNull();
  for (const element of sink.querySelectorAll("*")) {
    for (const attr of element.attributes) {
      expect(attr.name).not.toMatch(/^(on|style$|id$|name$|srcdoc$)/i);
      if (["href", "src"].includes(attr.name)) expect(attr.value).not.toMatch(/^(javascript|vbscript|data|file):|^\/\//i);
    }
  }
  expect(sanitizeBlogHtml(safe)).toBe(safe);
});
it("retains article structure, accessible text, tables and safe links/images", () => {
  const safe = sanitizeBlogHtml('<figure class="wide"><img src="https://cdn.test/a.webp" alt="A &amp; B" width="800"><figcaption>Caption</figcaption></figure><table><tr><th scope="col">Score</th><td>11</td></tr></table><details open><summary>More</summary><p>Text</p></details><a href="/blog/test" target="_blank">Read</a>');
  const sink = document.createElement("div"); sink.innerHTML = safe;
  expect(sink.querySelector("img")?.alt).toBe("A & B");
  expect(sink.querySelector("th")?.textContent).toBe("Score");
  expect(sink.querySelector("details")?.open).toBe(true);
  expect(sink.querySelector("a")?.rel).toBe("noopener noreferrer");
});
it("bounds oversized and deeply nested stored content", () => {
  expect(sanitizeBlogHtml("x".repeat(1_000_001))).toBe("");
  expect(() => sanitizeBlogHtml("<div>".repeat(1000) + "text" + "</div>".repeat(1000))).not.toThrow();
});
it("does not blank a representative full rendered article", async () => {
  const { renderEnBlogBody } = await import("../render/blog-body");
  const article = await renderEnBlogBody("pickleball-recovery-rest-hydration", "https://www.thepicklehub.net");
  expect(article.length).toBeGreaterThan(1000);
  const original = document.createElement("div"); original.innerHTML = article;
  const clean = document.createElement("div"); clean.innerHTML = sanitizeBlogHtml(article);
  expect(clean.textContent).toBe(original.textContent);
  expect(clean.querySelectorAll("h2").length).toBe(original.querySelectorAll("h2").length);
  expect(clean.querySelector("article")).not.toBeNull();
});

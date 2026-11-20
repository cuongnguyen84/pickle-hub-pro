// @vitest-environment jsdom
import { expect, it } from "vitest";
import { sanitizeBlogHtml } from "../sanitize-blog-html";
const attacks = [
  '<img src=x onerror=alert(1)>', '<a href=javascript:alert(1)>click</a>',
  '<a href="java&#x73;cript:alert(1)">click</a>', '<a href="java&#9;script:alert(1)">x</a>',
  '<svg><a xlink:href="javascript:alert(1)">x</a></svg>', '<math><mtext><img src=x onerror=alert(1)></mtext></math>',
  '<style><img src=x onerror=alert(1)></style>', '<script>alert(1)</script>',
  '<scr<script>ipt>alert(1)</scr</script>ipt>', '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=1 onerror=alert(1)>">',
  '<svg></p><style><g title="</style><img src onerror=alert(1)>">',
  '<a href="data:text/html,evil">data</a><img src="data:image/svg+xml,evil">',
  '<a href="//evil.test">x</a><a href="/\\evil.test">y</a>',
  '<div id=location name=location style="background:url(evil)"><form><input name=attributes></form></div>',
  '<template><img src=x onerror=alert(1)></template><custom onclick=alert(1)>text</custom>',
];
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

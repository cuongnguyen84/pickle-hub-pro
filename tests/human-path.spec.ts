import { test, expect, type Page } from "@playwright/test";

// ============================================================================
// Human-path link integrity — the nine-tenths of the site no gate was measuring
// ----------------------------------------------------------------------------
// Every acceptance check in this repo, and in the SEO work orders, is
// `curl -A "Googlebot"`. But bot and human run two different renderers:
// bots get functions/_lib/render/*, humans get the React SPA in src/pages/*.
// They are parallel implementations of the same pages, and only one of them
// was ever verified.
//
// That gap hid a real outage. src/pages/Index.tsx built Vietnamese story hrefs
// as `/vi/blog/${p.slug}` from the ENGLISH metadata slug, while the bot path
// (home.ts) read the correct Vietnamese slug from Supabase. Result: all six
// story cards on /vi pointed at URLs that did not exist — for 95% of the
// audience — while every curl came back 200 and every gate stayed green
// (2026-07-27, fixed in #473).
//
// It stayed invisible because the failure produces no signal: the SPA renders
// a normal "not found" branch, so nothing throws, nothing reaches
// client_errors, and a 30-minute soak is clean by construction.
//
// These tests run in a real browser, so JavaScript executes and the links
// under test are the ones a person actually clicks.
// ============================================================================

// Copy that means "this article is gone". Correct on a bad URL, a failure on
// a card the homepage just rendered.
const NOT_FOUND_COPY = [
  "Không tìm thấy bài viết",
  "Bài viết này không tồn tại",
  "Article not found",
];

// Copy that means "we could not reach the server". Also a failure on a story
// card — and, on a URL that genuinely does not exist, a *mislabel*: it tells a
// reader to retry something that will never work. See the PGRST116 test below.
const CONNECTION_ERROR_COPY = ["Lỗi kết nối", "Không thể kết nối"];

/** Same-origin hrefs rendered after hydration. */
async function renderedLinks(page: Page, path: string): Promise<string[]> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  // Story cards are client-rendered from blogMetadata; wait for one rather
  // than a network-idle heuristic (a live stream on the page never idles).
  await page.locator("a.tl-story").first().waitFor({ timeout: 15_000 });
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLAnchorElement>("a[href]")]
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => h.startsWith("/")),
  );
}

for (const home of ["/vi", "/"]) {
  test(`${home}: every story card resolves to a real article`, async ({ page, baseURL }) => {
    await page.goto(home, { waitUntil: "domcontentloaded" });
    const cards = page.locator("a.tl-story");
    await cards.first().waitFor({ timeout: 15_000 });

    const hrefs = await cards.evaluateAll((els) =>
      els.map((el) => el.getAttribute("href") ?? ""),
    );
    expect(hrefs.length, `no story cards rendered on ${home}`).toBeGreaterThan(0);

    for (const href of hrefs) {
      // Status first — this is what a bot would see.
      const res = await page.request.get(new URL(href, baseURL).toString());
      expect(res.status(), `${home} story card → ${href} returned ${res.status()}`).toBeLessThan(400);

      // Then the thing status codes cannot tell you: the SPA answers 200 for
      // any route and renders "not found" in the body. That soft 404 is
      // exactly how the /vi outage stayed hidden.
      await page.goto(href, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2_000); // content mounts after react-query resolves
      const body = await page.locator("body").innerText();
      for (const copy of [...NOT_FOUND_COPY, ...CONNECTION_ERROR_COPY]) {
        expect(body, `${home} story card → ${href} renders "${copy}" to a real visitor`).not.toContain(copy);
      }
      await page.goBack();
      await cards.first().waitFor({ timeout: 15_000 });
    }
  });
}

test("a Vietnamese article that does not exist says so, not \"connection error\"", async ({ page }) => {
  // Regression guard for a mislabel this repo has now shipped in BOTH
  // directions.
  //
  // Before: ViBlogPost merged `error || !post` into one branch, so a flaky 4G
  // connection told the reader the article had been deleted.
  //
  // After splitting them (#473): the lookup used the pgrst.object+json Accept
  // header, and PostgREST answers 406 PGRST116 "The result contains 0 rows"
  // for a missing slug — an Error, not empty data. So a nonexistent article
  // rendered "Lỗi kết nối — Thử lại", telling the reader to retry something
  // that can never succeed. Verified on prod before the fix.
  //
  // The query now returns a plain array, so absence is data and only a real
  // transport failure throws. This test pins both halves at once.
  await page.goto("/vi/blog/khong-ton-tai-abc-xyz-2026", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3_000);
  const body = await page.locator("body").innerText();

  expect(body, "a missing article must say it is missing").toContain("Không tìm thấy bài viết");
  for (const copy of CONNECTION_ERROR_COPY) {
    expect(body, `missing article mislabelled as "${copy}" — reader is told to retry a URL that cannot work`).not.toContain(copy);
  }
});

test("/vi: no internal link rendered by the SPA 404s", async ({ page, baseURL }) => {
  const hrefs = await renderedLinks(page, "/vi");
  const unique = [...new Set(hrefs)].filter((h) => !h.startsWith("//"));
  expect(unique.length).toBeGreaterThan(10);

  const broken: string[] = [];
  for (const href of unique) {
    const res = await page.request.get(new URL(href, baseURL).toString(), {
      maxRedirects: 5,
    });
    if (res.status() === 404) broken.push(`${href} → 404`);
  }
  expect(broken, `links the Vietnamese homepage renders but the server cannot serve:\n${broken.join("\n")}`).toEqual([]);
});

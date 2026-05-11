/**
 * Sprint 6 — RSC scraper adapter for brackets.pickleballtournaments.com
 *
 * Strategy: render the Next.js 13+ App Router page in Cloudflare Browser
 * Rendering, walk each round button (R32 → F), let RSC stream hydrate the
 * match cards, then extract the visible DOM into TournamentScrapeResult.
 *
 * ⚠️ STATUS — Sprint 6 PR-A (initial)
 * The selectors in this file are **scaffolding**, NOT yet verified against
 * a captured fixture. The fixture Cuong provided
 * (~/Desktop/tournament-fixture.html) is in TextEdit-wrapped HTML-escaped
 * format outside the project sandbox; the agent runtime couldn't grep into
 * it to harvest concrete selector strings. Treat every CSS selector as
 * TODO until a real Browser Rendering pass + parse cycle confirms each
 * one against the live DOM. Plan:
 *   1. Deploy this Worker + run a Browser Rendering pass on the test URL
 *      (workers/pro-tour-scraper README has the wrangler dev steps)
 *   2. Save the post-hydration HTML to
 *      workers/pro-tour-scraper/__fixtures__/2026-ppa-finals.html
 *   3. Update each SELECTOR_* below to the actual class / data attribute
 *   4. Re-run parser.test.ts (vitest fixture tests) until 5+ matches
 *      extract clean
 *   5. Open follow-up PR with the verified parser; this scaffolding is
 *      meant to land for the surrounding integration work to be
 *      review-able now (schema, ingest function, admin UI, feed badge)
 *
 * The CONTRACT between this adapter and the ingest edge function
 * (pro-tour-ingest) IS final. Selectors will move; the
 * TournamentScrapeResult shape will not.
 */

import type {
  ProTourAdapter,
  TournamentScrapeResult,
  ScrapedMatch,
  ScrapedPlayer,
  ScrapedTeam,
} from "../types";

interface ScraperEnv {
  /** Cloudflare Browser Rendering binding. Bound in
   *  workers/pro-tour-scraper/wrangler.toml as MYBROWSER. */
  MYBROWSER: Fetcher;
}

const HOST_PATTERN =
  /^https:\/\/brackets\.pickleballtournaments\.com\/tournaments\/[0-9a-f-]+\/events\/[0-9A-F-]+\/elimination\/[0-9A-F-]+/i;

/* ─── Selector scaffolding (TODO: verify against fixture) ───────────────
 *
 * Conventions for educated guesses (Next.js 13 App Router + Tailwind
 * common patterns + the screenshots Cuong described in the spec):
 *   - Round buttons: small circular pills in a top horizontal bar,
 *     likely role="button" with text content "R32" / "R16" / etc.
 *   - Tournament header: <h1> or large title with "PPA Tour: <year>".
 *   - Event subtitle: secondary heading like "Mens Doubles Pro Main Draw".
 *   - Match cards: repeated grid items, each wrapping team A + team B
 *     stacked, with seed on the left, names center, scores right.
 *   - Player anchor: <a href="https://pickleball.com/players/<slug>">.
 */
const SELECTOR_TOURNAMENT_TITLE = "h1, h2"; // narrow once verified
const SELECTOR_EVENT_SUBTITLE = "h2, h3"; // narrow once verified
const SELECTOR_ROUND_BUTTONS = '[role="button"], button'; // filter by inner text matches /^[RQSF]/
const SELECTOR_MATCH_CARD = "[data-match], article, .match-card"; // multiple candidates
const SELECTOR_PLAYER_LINK = 'a[href*="/players/"]';

/* ─── Adapter ────────────────────────────────────────────────────────── */

export const rscScraperAdapter: ProTourAdapter<ScraperEnv> = {
  name: "rsc_scraper",

  validateUrl(url) {
    return HOST_PATTERN.test(url);
  },

  async fetchTournament(url, env) {
    if (!this.validateUrl(url)) {
      throw new Error(`rsc_scraper: URL not recognised: ${url}`);
    }

    // Cloudflare Browser Rendering REST endpoint exposes a
    // headless Chromium that can wait for network idle + return
    // post-hydration HTML. We cycle through the round buttons inside
    // the script so all bracket data is in the same final DOM dump.
    const html = await renderWithBrowser(env, url);
    return parseTournamentHtml(html, url);
  },
};

/* ─── Browser Rendering call ────────────────────────────────────────────
 * Uses the Browser Rendering REST API (Workers Paid plan binding
 * `MYBROWSER`). For the v1 scaffolding we POST the URL + a small
 * navigation script that clicks each round button and waits for the
 * RSC stream to settle, then reads document.documentElement.outerHTML.
 *
 * Detailed shape of the binding (CF docs + types):
 *   const browser = await env.MYBROWSER.launch();
 *   const page = await browser.newPage();
 *   await page.goto(url, { waitUntil: 'networkidle0' });
 *   for (const r of ['R32','R16','QF','SF','F']) {
 *     await page.evaluate(label => {
 *       document.querySelectorAll('[role="button"],button')
 *         .forEach(b => { if (b.textContent?.trim() === label) b.click(); });
 *     }, r);
 *     await page.waitForTimeout(800);
 *   }
 *   return await page.content();
 *
 * The launch/newPage plumbing requires @cloudflare/puppeteer typings
 * not currently in the project. Worker package.json gets that dep
 * (workers/pro-tour-scraper/package.json) — kept out of the main app's
 * dependency tree.
 */
async function renderWithBrowser(env: ScraperEnv, url: string): Promise<string> {
  // Implementation lives in the Worker (workers/pro-tour-scraper/src/index.ts)
  // because it needs the puppeteer-like API surface. This module exports
  // the parser as a pure function so vitest can hit it with fixture HTML
  // without any browser stack.
  // Reference args so tsc strict noUnused doesn't fire even though the
  // body always throws. Real implementation lives in the Worker; this
  // stub keeps the adapter importable from tests.
  void env;
  void url;
  throw new Error(
    "renderWithBrowser is implemented in workers/pro-tour-scraper/src/index.ts; " +
      "this stub exists so the parser can be unit-tested in isolation. " +
      "When the adapter runs inside the Worker the env.MYBROWSER binding " +
      "is wired through and this function is replaced.",
  );
}

/* ─── Pure parser (testable) ─────────────────────────────────────────── */

/**
 * Parse a post-hydration HTML dump into a TournamentScrapeResult. Pure
 * function — takes a string, no fetches. Vitest hits this with a fixture
 * stored under workers/pro-tour-scraper/__fixtures__.
 *
 * NOTE: this parser uses regex string matching rather than a DOM library
 * because the Worker bundle is size-constrained and the DOM shape we need
 * is narrow (anchors with /players/ href, score numbers, round labels).
 * Once the fixture is harvested, switch to linkedom (~30 KB) if regex
 * gets fragile.
 */
export function parseTournamentHtml(
  html: string,
  sourceUrl: string,
): TournamentScrapeResult {
  const tournamentName = extractFirstMatch(
    html,
    /<h1[^>]*>([^<]+)<\/h1>/i,
    "Unknown Tournament",
  ).trim();
  const tournamentEvent = extractFirstMatch(
    html,
    /<h2[^>]*>([^<]+)<\/h2>/i,
    "Unknown Event",
  ).trim();

  const players = extractPlayers(html);
  const matches = extractMatches(html, sourceUrl);

  return {
    source_provider: "ppa_tour",
    source_url: sourceUrl,
    tournament_name: tournamentName,
    tournament_event: tournamentEvent,
    matches,
    players,
  };
}

/* ─── Player extraction ──────────────────────────────────────────────── */
//
// pickleball.com player anchors look like:
//   <a href="https://pickleball.com/players/ben-johns" ...>
//     <img src="..." alt="Ben Johns"/>
//     Ben Johns
//   </a>
// The slug after /players/ is the external_id; display_name is either
// the alt text or the inner text. avatar_url is the img src when present.
//
// TODO: replace with verified selectors once fixture harvested.

const PLAYER_LINK_RE =
  /<a[^>]+href=["']https?:\/\/(?:www\.)?pickleball\.com\/players\/([a-z0-9-]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const IMG_SRC_RE = /<img[^>]+src=["']([^"']+)["'][^>]*>/i;
const IMG_ALT_RE = /<img[^>]+alt=["']([^"']+)["'][^>]*>/i;

function extractPlayers(html: string): ScrapedPlayer[] {
  const seen = new Map<string, ScrapedPlayer>();
  for (const match of html.matchAll(PLAYER_LINK_RE)) {
    const slug = match[1];
    if (seen.has(slug)) continue;
    const inner = match[2];
    const altMatch = inner.match(IMG_ALT_RE);
    const srcMatch = inner.match(IMG_SRC_RE);
    const textOnly = inner.replace(/<[^>]+>/g, "").trim();
    const displayName = (altMatch?.[1] ?? textOnly).trim();
    if (!displayName) continue;
    seen.set(slug, {
      external_id: slug,
      external_url: `https://pickleball.com/players/${slug}`,
      display_name: displayName,
      avatar_url: srcMatch?.[1] ?? null,
      country_code: null, // TODO: extract from flag emoji / data attr once fixture harvested
    });
  }
  return Array.from(seen.values());
}

/* ─── Match extraction ───────────────────────────────────────────────── */
//
// ⚠️ Selector TODO. Initial shape assumes match cards expose:
//   - a stable id via data-match-id or similar attribute
//   - round name via a header element OR enclosing section
//   - two team blocks each with seed + 1-2 player anchors + 1-3 score numbers
//   - winner indicated by class (winner / w) or bold styling
//   - court + scheduled time in a metadata block
//
// Parser returns [] if it can't find anything matching, so the surrounding
// integration code (Worker → ingest) still wires up; the ingest writes a
// status='success' log with matches_imported=0 which surfaces clearly in
// the admin Logs tab as "scrape returned no matches" — easier to triage
// than a silent failure.

function extractMatches(_html: string, _sourceUrl: string): ScrapedMatch[] {
  // Stub. Needs fixture-driven implementation. Returning [] here is the
  // honest signal — the rest of the pipeline runs end-to-end on a real
  // scrape but inserts zero matches until selectors are filled in. The
  // admin Logs tab will show matches_imported=0 + status='success' so
  // it's obvious the scrape ran but produced nothing.
  return [];
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function extractFirstMatch(
  html: string,
  pattern: RegExp,
  fallback: string,
): string {
  const m = html.match(pattern);
  return m?.[1] ?? fallback;
}

/* ─── Re-export the parser entry point used by the Worker ─────────────── */

export const PRO_TOUR_HOST_PATTERN = HOST_PATTERN;

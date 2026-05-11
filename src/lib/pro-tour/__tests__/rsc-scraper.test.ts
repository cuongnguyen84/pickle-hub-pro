import { describe, it, expect } from "vitest";
import {
  rscScraperAdapter,
  parseTournamentHtml,
  PRO_TOUR_HOST_PATTERN,
} from "../adapters/rsc-scraper";

/**
 * Sprint 6 — parser baseline tests.
 *
 * Covers the URL validator + the player extraction regex (the one piece
 * of the parser whose selectors are stable across DOM revisions because
 * pickleball.com player anchors are external links, not Next.js
 * internals). Match extraction tests stay pending until a captured
 * fixture lands in workers/pro-tour-scraper/__fixtures__ and the
 * SELECTOR_* constants in adapters/rsc-scraper.ts are wired up — see
 * that file's header comment for the harvest checklist.
 */

const VALID_URL =
  "https://brackets.pickleballtournaments.com/tournaments/d7806c39-89b0-4692-970c-b73a835fa60a/events/1B71FDBD-3B56-41EF-A0D6-ADB38837896E/elimination/745D6E6E-5F00-4138-863B-B2BBB8153152";

describe("PRO_TOUR_HOST_PATTERN / validateUrl", () => {
  it("accepts a fully-qualified brackets URL", () => {
    expect(PRO_TOUR_HOST_PATTERN.test(VALID_URL)).toBe(true);
    expect(rscScraperAdapter.validateUrl(VALID_URL)).toBe(true);
  });

  it("rejects unrelated URLs", () => {
    expect(rscScraperAdapter.validateUrl("https://google.com")).toBe(false);
    expect(
      rscScraperAdapter.validateUrl("https://pickleballtournaments.com/"),
    ).toBe(false);
    // Wrong subdomain
    expect(
      rscScraperAdapter.validateUrl(
        "https://other.pickleballtournaments.com/tournaments/abc/events/def/elimination/ghi",
      ),
    ).toBe(false);
  });

  it("rejects truncated paths missing required segments", () => {
    expect(
      rscScraperAdapter.validateUrl(
        "https://brackets.pickleballtournaments.com/tournaments/abc",
      ),
    ).toBe(false);
    expect(
      rscScraperAdapter.validateUrl(
        "https://brackets.pickleballtournaments.com/tournaments/abc/events/def",
      ),
    ).toBe(false);
  });
});

describe("parseTournamentHtml — player extraction", () => {
  it("extracts unique players from pickleball.com anchors", () => {
    const html = `
      <html><body>
        <h1>PPA Tour: 2026 PPA Finals</h1>
        <h2>Mens Doubles Pro Main Draw</h2>
        <a href="https://pickleball.com/players/ben-johns">
          <img src="https://cdn.example.com/bj.jpg" alt="Ben Johns"/>
          Ben Johns
        </a>
        <a href="https://pickleball.com/players/collin-johns">
          <img src="https://cdn.example.com/cj.jpg" alt="Collin Johns"/>
          Collin Johns
        </a>
        <!-- duplicate; should dedupe by slug -->
        <a href="https://pickleball.com/players/ben-johns">Ben Johns</a>
      </body></html>
    `;
    const out = parseTournamentHtml(html, VALID_URL);
    expect(out.source_provider).toBe("ppa_tour");
    expect(out.source_url).toBe(VALID_URL);
    expect(out.tournament_name).toBe("PPA Tour: 2026 PPA Finals");
    expect(out.tournament_event).toBe("Mens Doubles Pro Main Draw");
    expect(out.players).toHaveLength(2);
    const ben = out.players.find((p) => p.external_id === "ben-johns");
    expect(ben?.display_name).toBe("Ben Johns");
    expect(ben?.external_url).toBe("https://pickleball.com/players/ben-johns");
    expect(ben?.avatar_url).toBe("https://cdn.example.com/bj.jpg");
  });

  it("handles www subdomain on pickleball.com anchors", () => {
    const html = `
      <a href="https://www.pickleball.com/players/anna-leigh-waters">
        Anna Leigh Waters
      </a>
    `;
    const out = parseTournamentHtml(html, VALID_URL);
    expect(out.players).toHaveLength(1);
    expect(out.players[0].external_id).toBe("anna-leigh-waters");
  });

  it("falls back to inner text when no <img alt> is present", () => {
    const html = `
      <a href="https://pickleball.com/players/quang-duong">
        <strong>Quang Duong</strong>
      </a>
    `;
    const out = parseTournamentHtml(html, VALID_URL);
    expect(out.players).toHaveLength(1);
    expect(out.players[0].display_name).toBe("Quang Duong");
  });

  it("matches=0 is the honest signal until selectors are filled in", () => {
    // Path B: parser scaffolding returns matches=[] until extractMatches
    // is implemented against a fixture. The end-to-end pipeline (Worker
    // → ingest → log row) still completes; admin Logs tab shows
    // matches_imported=0 + status=success → obvious that scrape ran but
    // produced nothing.
    const html = "<html><body><h1>x</h1></body></html>";
    expect(parseTournamentHtml(html, VALID_URL).matches).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDuprInput, parseDuprProfile } from "../dupr-parser";

// ─── parseDuprInput ─────────────────────────────────────────────────────────
describe("parseDuprInput — accepts URL or bare ID", () => {
  it("URL with trailing slash → returns id", () => {
    expect(parseDuprInput("https://mydupr.com/dupr/players/XYZ123ABC/")).toEqual({
      duprId: "XYZ123ABC",
    });
  });

  it("URL without trailing slash → returns id", () => {
    expect(parseDuprInput("https://mydupr.com/dupr/players/XYZ123ABC")).toEqual({
      duprId: "XYZ123ABC",
    });
  });

  it("URL with www. prefix → returns id", () => {
    expect(parseDuprInput("https://www.mydupr.com/dupr/players/abc123")).toEqual({
      duprId: "abc123",
    });
  });

  it("URL with http (not https) → returns id", () => {
    expect(parseDuprInput("http://mydupr.com/dupr/players/abc123")).toEqual({
      duprId: "abc123",
    });
  });

  it("URL surrounded by whitespace → trimmed + parsed", () => {
    expect(
      parseDuprInput("   https://mydupr.com/dupr/players/abc123   "),
    ).toEqual({ duprId: "abc123" });
  });

  it("Bare ID 4 chars → returns id (min)", () => {
    expect(parseDuprInput("abcd")).toEqual({ duprId: "abcd" });
  });

  it("Bare ID 20 chars → returns id (max)", () => {
    expect(parseDuprInput("a".repeat(20))).toEqual({ duprId: "a".repeat(20) });
  });

  it("Bare ID 3 chars → null (too short)", () => {
    expect(parseDuprInput("abc")).toBeNull();
  });

  it("Bare ID 21 chars → null (too long)", () => {
    expect(parseDuprInput("a".repeat(21))).toBeNull();
  });

  it("ID with hyphen → null (not alphanumeric)", () => {
    expect(parseDuprInput("abc-123")).toBeNull();
  });

  it("Empty string → null", () => {
    expect(parseDuprInput("")).toBeNull();
  });

  it("Whitespace only → null", () => {
    expect(parseDuprInput("   \t\n  ")).toBeNull();
  });

  it("URL invalid path (not /dupr/players/) → null", () => {
    expect(parseDuprInput("https://mydupr.com/players/abc123")).toBeNull();
  });

  it("URL different domain → null", () => {
    expect(
      parseDuprInput("https://example.com/dupr/players/abc123"),
    ).toBeNull();
  });

  it("non-string input (null) → null", () => {
    // @ts-expect-error — runtime safety check
    expect(parseDuprInput(null)).toBeNull();
  });

  it("non-string input (number) → null", () => {
    // @ts-expect-error — runtime safety check
    expect(parseDuprInput(12345)).toBeNull();
  });
});

// ─── Deprecation marker ─────────────────────────────────────────────────────
describe("dupr-parser deprecation (Sprint 3 Phase 2 pivot)", () => {
  it("source file carries DEPRECATED header explaining the pivot", () => {
    // Sprint 3 Phase 2 pivoted away from HTML scrape because DUPR is a
    // pure client-rendered SPA. parseDuprProfile / fetchDuprProfile are
    // preserved for Sprint 5+ revival but must not be silently revived
    // without updating this header — guard via assertion.
    const sourcePath = join(__dirname, "..", "dupr-parser.ts");
    const source = readFileSync(sourcePath, "utf8");
    expect(source).toMatch(/DEPRECATED for Sprint 3 Phase 2/);
    expect(source).toMatch(/parseDuprInput\s+— STILL USED/);
    expect(source).toMatch(/parseDuprProfile\s+— RESERVED/);
  });
});

// ─── parseDuprProfile (SKIPPED — Sprint 3 Phase 2 pivot) ───────────────────
// Kept for Sprint 5+ revival when DUPR partnership lands; until then DUPR's
// SPA renders ratings client-side so there is no HTML to parse.
describe.skip("parseDuprProfile — 3 strategies in order", () => {
  it("strategy 1: __NEXT_DATA__ with singles + doubles + fullName", () => {
    const html = buildNextDataHtml({
      singles: 4.25,
      doubles: 4.5,
      fullName: "Nguyen Van A",
    });
    const r = parseDuprProfile(html);
    expect(r).toEqual({
      singles: 4.25,
      doubles: 4.5,
      displayName: "Nguyen Van A",
    });
  });

  it("strategy 1: __NEXT_DATA__ alt key names (singlesRating / displayName)", () => {
    const html = buildNextDataHtml(
      {
        singlesRating: 3.8,
        doublesRating: 4.0,
        displayName: "Test User",
      },
      "profile",
    );
    const r = parseDuprProfile(html);
    expect(r).toEqual({
      singles: 3.8,
      doubles: 4.0,
      displayName: "Test User",
    });
  });

  it("strategy 1 fallthrough: malformed JSON → falls to strategy 2", () => {
    const malformed = `<html><head></head><body>
      <script id="__NEXT_DATA__" type="application/json">{not valid json</script>
      <span class="rating-doubles">3.55</span>
      ${padHtml()}
    </body></html>`;
    const r = parseDuprProfile(malformed);
    expect(r?.doubles).toBe(3.55);
    expect(r?.singles).toBeNull();
  });

  it("strategy 2: CSS class match singles + title", () => {
    const html = `<html><head><title>Cuong Nguyen — DUPR</title></head><body>
      <span class="rating-singles">4.10</span>
      ${padHtml()}
    </body></html>`;
    const r = parseDuprProfile(html);
    expect(r).toEqual({
      singles: 4.1,
      doubles: null,
      displayName: "Cuong Nguyen",
    });
  });

  it("strategy 2: alt class name (singles-rating)", () => {
    const html = `<html><body>
      <div class="player-stats singles-rating big">4.30</div>
      ${padHtml()}
    </body></html>`;
    const r = parseDuprProfile(html);
    expect(r?.singles).toBe(4.3);
  });

  it("strategy 3: data-* attributes only", () => {
    const html = `<html><body>
      <div data-singles="3.25" data-doubles="3.50">Player Card</div>
      ${padHtml()}
    </body></html>`;
    const r = parseDuprProfile(html);
    expect(r).toEqual({ singles: 3.25, doubles: 3.5, displayName: null });
  });

  it("empty HTML → null", () => {
    expect(parseDuprProfile("")).toBeNull();
  });

  it("HTML too short → null", () => {
    expect(parseDuprProfile("<html></html>")).toBeNull();
  });

  it("HTML with no rating signals → null", () => {
    const html = `<html><body>${padHtml()}<p>No rating here</p></body></html>`;
    expect(parseDuprProfile(html)).toBeNull();
  });

  it("__NEXT_DATA__ with player but null ratings → fall through (returns null overall)", () => {
    const html = buildNextDataHtml({
      singles: null,
      doubles: null,
      fullName: "X",
    });
    // Strategy 1 sees player but skips because both ratings null;
    // no other strategies hit either → overall null.
    expect(parseDuprProfile(html)).toBeNull();
  });
});

// ─── helpers ───────────────────────────────────────────────────────────────
function buildNextDataHtml(
  player: Record<string, unknown>,
  key: "player" | "profile" = "player",
): string {
  const data = { props: { pageProps: { [key]: player } } };
  return `<!doctype html><html><head></head><body>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>
    ${padHtml()}
  </body></html>`;
}

function padHtml(): string {
  // parseDuprProfile rejects html < 100 chars; fixtures need padding.
  return "<!-- padding ".concat("x".repeat(120), " -->");
}
